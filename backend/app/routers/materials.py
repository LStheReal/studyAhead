from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
import pdfplumber
from PIL import Image
import pillow_heif
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, MaterialSummary, Flashcard, MaterialCategory, StudyPlanStatus
from app.schemas import MaterialUpload, MaterialSummaryResponse
from app.ai_service import ai_service
from app.config import settings

router = APIRouter()

# Register HEIF opener
pillow_heif.register_heif_opener()

UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(exist_ok=True)

async def process_materials_background(
    study_plan_id: int,
    user_id: int,
    text_content: Optional[str] = None,
    file_paths: Optional[List[str]] = None
):
    """Background task to process materials and generate flashcards."""
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if not plan:
            return
        
        # Combine all text content
        combined_text = text_content or ""
        print(f"Starting material processing for plan {study_plan_id}")
        print(f"Initial text content length: {len(combined_text)}")
        
        if file_paths:
            for file_path in file_paths:
                file_ext = Path(file_path).suffix.lower()
                print(f"Processing file: {file_path} (type: {file_ext})")
                
                if file_ext == ".pdf":
                    # Extract text from PDF
                    with pdfplumber.open(file_path) as pdf:
                        pdf_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
                        combined_text += "\n\n" + pdf_text
                        print(f"Extracted {len(pdf_text)} characters from PDF")
                
                elif file_ext in [".jpg", ".jpeg", ".png", ".heic"]:
                    # Extract text from image
                    try:
                        if file_ext == ".heic":
                            heif_file = pillow_heif.open_heif(file_path)
                            image = Image.frombytes(
                                heif_file.mode,
                                heif_file.size,
                                heif_file.data,
                                "raw"
                            )
                        else:
                            image = Image.open(file_path)
                        
                        print(f"Extracting text from image using AI vision...")
                        # Use AI vision to extract text
                        image_text = ai_service.extract_text_from_image(str(file_path))
                        combined_text += "\n\n" + image_text
                        print(f"Extracted {len(image_text)} characters from image")
                    except Exception as e:
                        import traceback
                        print(f"Error processing image {file_path}: {e}")
                        print(traceback.format_exc())
        
        print(f"Total combined text length: {len(combined_text)}")
        
        if not combined_text.strip():
            print(f"Warning: No text content extracted for plan {study_plan_id}")
            plan.status = StudyPlanStatus.AWAITING_APPROVAL
            db.commit()
            return
        
        # Analyze material
        analysis = ai_service.analyze_material(combined_text)
        
        # Check category - only vocabulary is supported
        category = analysis.get("category", "other")
        if category != "vocabulary":
            # Set error status and save category for error message
            plan.status = StudyPlanStatus.AWAITING_APPROVAL
            db.commit()
            # Don't raise here - let status endpoint handle the error display
            print(f"ERROR: Category '{category}' not supported. Only vocabulary is supported.")
            return
        
        # Create material summary
        summary = MaterialSummary(
            study_plan_id=study_plan_id,
            title=analysis.get("title", "Untitled Material"),
            category=MaterialCategory.VOCABULARY,
            main_topics=analysis.get("main_topics", []),
            learning_goals=analysis.get("learning_goals", []),
            recommended_study_approach=analysis.get("recommended_study_approach"),
            checklist_items=analysis.get("checklist_items", []),
            content_structure=analysis.get("content_structure"),
            difficulty_assessment=analysis.get("difficulty_assessment")
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)
        
        # Get plan to access language settings
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        question_language = plan.question_language or "English"
        answer_language = plan.answer_language or "English"
        
        # Generate vocabulary flashcards with proper language mapping
        flashcard_data = ai_service.generate_vocabulary_flashcards(
            analysis, 
            question_language=question_language,
            answer_language=answer_language,
            count=30
        )
        
        if not flashcard_data or len(flashcard_data) == 0:
            print(f"Warning: No flashcards generated for plan {study_plan_id}")
            plan.status = StudyPlanStatus.AWAITING_APPROVAL
            db.commit()
            return
        
        flashcard_count = 0
        from app.models import MCQQuestion, VocabularySentence
        
        for fc_data in flashcard_data:
            front_text = fc_data.get("front_text", "").strip()
            back_text = fc_data.get("back_text", "").strip()
            
            # Skip empty flashcards
            if not front_text or not back_text:
                continue
                
            # Create flashcard
            flashcard = Flashcard(
                study_plan_id=study_plan_id,
                material_summary_id=summary.id,
                front_text=front_text,
                back_text=back_text,
                difficulty=fc_data.get("difficulty", "medium")
            )
            db.add(flashcard)
            db.flush()  # Flush to get flashcard.id
            
            # Generate 3 MCQ questions for this vocabulary
            mcq_data = ai_service.generate_vocabulary_mcqs(
                front_text, 
                back_text,
                question_language,
                answer_language
            )
            
            for mcq in mcq_data:
                mcq_question = MCQQuestion(
                    flashcard_id=flashcard.id,
                    question_text=mcq.get("question_text", ""),
                    options=mcq.get("options", []),
                    correct_answer_index=mcq.get("correct_answer_index", 0),
                    rationale=mcq.get("rationale", ""),
                    question_type=mcq.get("question_type", "standard")
                )
                db.add(mcq_question)
            
            # Generate 5 example sentences in answer language
            sentences_data = ai_service.generate_vocabulary_sentences(
                front_text,
                back_text,
                answer_language,
                count=5
            )
            
            for sent_data in sentences_data:
                sentence = VocabularySentence(
                    flashcard_id=flashcard.id,
                    sentence_text=sent_data.get("sentence_text", ""),
                    highlighted_words=sent_data.get("highlighted_words", [])
                )
                db.add(sentence)
            
            flashcard_count += 1
        
        if flashcard_count == 0:
            print(f"Warning: All flashcards were empty for plan {study_plan_id}")
            plan.status = StudyPlanStatus.AWAITING_APPROVAL
            db.commit()
            return
        
        db.commit()
        print(f"Successfully created {flashcard_count} flashcards with MCQs and sentences for plan {study_plan_id}")
        
        # Update plan status
        plan.status = StudyPlanStatus.AWAITING_APPROVAL
        plan.category = summary.category
        db.commit()
        
    except ValueError as e:
        # Category not supported error
        import traceback
        print(f"Category error in background processing: {e}")
        print(traceback.format_exc())
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if plan:
            plan.status = StudyPlanStatus.AWAITING_APPROVAL
            db.commit()
        # Re-raise to be caught by status endpoint
        raise
    except Exception as e:
        import traceback
        print(f"Error in background processing: {e}")
        print(traceback.format_exc())
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if plan:
            plan.status = StudyPlanStatus.AWAITING_APPROVAL
            db.commit()
    finally:
        db.close()

@router.post("/upload")
async def upload_materials(
    study_plan_id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(default=[]),
    text_content: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload materials (PDF, images, or text) for processing."""
    try:
        # Verify study plan ownership
        plan = db.query(StudyPlan).filter(
            StudyPlan.id == study_plan_id,
            StudyPlan.user_id == current_user.id
        ).first()
        
        if not plan:
            raise HTTPException(status_code=404, detail="Study plan not found")
        
        # Handle case where files might be empty list
        files_list = files if files else []
        
        if not files_list and not text_content:
            raise HTTPException(status_code=400, detail="Please provide files or text content")
        
        # Save uploaded files
        file_paths = []
        if files_list:
            for file in files_list:
                try:
                    # Check file size
                    contents = await file.read()
                    if len(contents) > settings.max_upload_size:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"File {file.filename} exceeds size limit of {settings.max_upload_size / 1024 / 1024}MB"
                        )
                    
                    # Save file
                    file_path = UPLOAD_DIR / f"{study_plan_id}_{file.filename}"
                    with open(file_path, "wb") as f:
                        f.write(contents)
                    file_paths.append(str(file_path))
                except Exception as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Error processing file {file.filename}: {str(e)}"
                    )
        
        # Start background processing
        background_tasks.add_task(
            process_materials_background,
            study_plan_id,
            current_user.id,
            text_content,
            file_paths
        )
        
        return {"message": "Materials uploaded, processing started"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload materials: {str(e)}"
        )

@router.get("/{study_plan_id}/summary", response_model=MaterialSummaryResponse)
async def get_material_summary(
    study_plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get material summary for a study plan."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == study_plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    if not plan.material_summary:
        raise HTTPException(status_code=404, detail="Material summary not found")
    
    return plan.material_summary

@router.get("/{study_plan_id}/status")
async def get_processing_status(
    study_plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current processing status of materials."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == study_plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    # Check if there's a category error (non-vocabulary material)
    error_message = None
    if plan.status == StudyPlanStatus.AWAITING_APPROVAL and plan.material_summary:
        if plan.material_summary.category != MaterialCategory.VOCABULARY:
            error_message = f"Type not supported yet, only supports vocab. Detected category: {plan.material_summary.category.value}"
    
    return {
        "status": plan.status.value,
        "current_step": plan.current_step,
        "has_summary": plan.material_summary is not None,
        "flashcard_count": len(plan.flashcards),
        "error": error_message
    }

