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
    
    # Initialize variables before try block to avoid UnboundLocalError
    success = False
    flashcard_count = 0
    error_message = None
    
    # 1. Initial Check & Setup (Quick DB op)
    print(f"[STEP 1/7] Starting material processing for plan {study_plan_id}")
    with SessionLocal() as db:
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if not plan:
            print(f"Plan {study_plan_id} not found, aborting.")
            return
        # We don't keep the plan object bound to session after this block
        # but we might need some info like languages.
        question_language = plan.question_language or "English"
        answer_language = plan.answer_language or "English"

    try:
        # 2. Extract Text (No DB)
        combined_text = text_content or ""
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
                        print(f"  Extracted {len(pdf_text)} characters from PDF")
                
                elif file_ext in [".jpg", ".jpeg", ".png", ".heic"]:
                    # Extract text from image using AI
                    try:
                        image_text = ai_service.extract_text_from_image(file_path)
                        combined_text += "\n\n" + image_text
                        print(f"  Extracted {len(image_text)} characters from image")
                    except Exception as e:
                        import traceback
                        print(f"  Error processing image {file_path}: {e}")
                        print(traceback.format_exc())
        
        print(f"  Total combined text length: {len(combined_text)}")
        
        if not combined_text.strip():
            print(f"  Warning: No text content extracted for plan {study_plan_id}")
            with SessionLocal() as db:
                plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
                if plan:
                    plan.status = StudyPlanStatus.AWAITING_APPROVAL
                    db.commit()
            return
        
        # 3. Analyze Material (AI - Slow, No DB)
        print("[STEP 3/7] Analyzing material with AI...")
        analysis = ai_service.analyze_material(combined_text)
        
        # Check category
        category = analysis.get("category", "other")
        if category != "vocabulary":
            print(f"  ERROR: Category '{category}' not supported. Only vocabulary is supported.")
            with SessionLocal() as db:
                plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
                if plan:
                    plan.status = StudyPlanStatus.AWAITING_APPROVAL
                    # We could store the error in a field if we had one, or rely on the category check in status endpoint
                    # But we need to save the summary to show the error
                    db.commit()
            raise ValueError(f"Category '{category}' not supported")
        
        print(f"  Category: {category}")
        print(f"  Flashcard count: {len(analysis.get('flashcards', []))}")
        
        # 4. Save Material Summary (Quick DB op)
        print("[STEP 4/7] Creating material summary...")
        with SessionLocal() as db:
            # Check if summary already exists (for idempotency)
            existing_summary = db.query(MaterialSummary).filter(
                MaterialSummary.study_plan_id == study_plan_id
            ).first()
            
            if existing_summary:
                print(f"  Material summary already exists for plan {study_plan_id}, reusing it")
                summary_id = existing_summary.id
            else:
                summary = MaterialSummary(
                    study_plan_id=study_plan_id,
                    category=MaterialCategory(category),
                    topic=analysis.get("topic", ""),
                    key_concepts=analysis.get("key_concepts", []),
                    difficulty_level=analysis.get("difficulty_level", "intermediate"),
                    estimated_study_time=analysis.get("estimated_study_time", 60)
                )
                db.add(summary)
                db.commit()
                db.refresh(summary)
                summary_id = summary.id
                print(f"  Created material summary with ID: {summary_id}")
            
            # Update plan category
            plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
            if plan:
                plan.category = MaterialCategory(category)
                db.commit()
        
        # 5. Check if flashcards already exist (for idempotency)
        print("[STEP 5/7] Checking for existing flashcards...")
        with SessionLocal() as db:
            existing_flashcards = db.query(Flashcard).filter(
                Flashcard.study_plan_id == study_plan_id
            ).count()
            
            if existing_flashcards > 0:
                print(f"  Flashcards already exist for plan {study_plan_id} (count: {existing_flashcards}), skipping generation")
                flashcard_count = existing_flashcards
                success = True
                return
        
        # 6. Generate Flashcards with MCQs and Sentences (AI - Slow, then DB)
        print("[STEP 6/7] Generating flashcards with MCQs and sentences...")
        flashcard_data = analysis.get("flashcards", [])
        
        if flashcard_data:
            for idx, card_data in enumerate(flashcard_data, 1):
                front = card_data.get("front", "").strip()
                back = card_data.get("back", "").strip()
                
                if not front or not back:
                    print(f"  Skipping empty flashcard {idx}")
                    continue
                
                print(f"  Processing flashcard {idx}/{len(flashcard_data)}: '{front}' -> '{back}'")
                
                with SessionLocal() as db:
                    # Create flashcard
                    flashcard = Flashcard(
                        study_plan_id=study_plan_id,
                        front=front,
                        back=back,
                        difficulty=card_data.get("difficulty", "medium")
                    )
                    db.add(flashcard)
                    db.commit()
                    db.refresh(flashcard)
                    
                    # Generate MCQs
                    print(f"    Generating MCQs for flashcard {idx}...")
                    mcqs = ai_service.generate_mcq_for_flashcard(
                        front, back, question_language, answer_language
                    )
                    
                    for mcq_data in mcqs[:3]:  # Limit to 3 MCQs
                        mcq = MCQQuestion(
                            flashcard_id=flashcard.id,
                            question_text=mcq_data.get("question_text", ""),
                            options=mcq_data.get("options", []),
                            correct_answer=mcq_data.get("correct_answer", 0),
                            question_type=mcq_data.get("question_type", "standard")
                        )
                        db.add(mcq)
                    
                    # Generate sentences
                    print(f"    Generating example sentences for flashcard {idx}...")
                    sentences = ai_service.generate_sentences_for_flashcard(
                        front, back, answer_language
                    )
                    
                    for sent_data in sentences[:5]:  # Limit to 5 sentences
                        sentence = VocabularySentence(
                            flashcard_id=flashcard.id,
                            sentence_text=sent_data.get("sentence_text", ""),
                            highlighted_words=sent_data.get("highlighted_words", [])
                        )
                        db.add(sentence)
                    
                    db.commit()
                    flashcard_count += 1
        
        if flashcard_count == 0:
            print(f"  Warning: All flashcards were empty for plan {study_plan_id}")
            # Fall through to final status update
            
        print(f"[STEP 7/7] Successfully created {flashcard_count} flashcards with MCQs and sentences for plan {study_plan_id}")
        success = True
        
    except ValueError as e:
        # Category not supported error
        error_message = str(e)
        import traceback
        print(f"Category error in background processing: {e}")
        print(traceback.format_exc())
    except Exception as e:
        error_message = str(e)
        import traceback
        print(f"Error in background processing: {e}")
        print(traceback.format_exc())
    finally:
        # ALWAYS update status, even if there was an error
        print(f"[FINAL] Updating final status for plan {study_plan_id} (success={success}, flashcards={flashcard_count})")
        try:
            with SessionLocal() as db:
                plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
                if plan:
                    plan.status = StudyPlanStatus.AWAITING_APPROVAL
                    db.commit()
                    print(f"  Status updated to AWAITING_APPROVAL")
                else:
                    print(f"  ERROR: Plan {study_plan_id} not found for final status update")
        except Exception as final_error:
            print(f"  CRITICAL ERROR updating final status: {final_error}")
            import traceback
            traceback.print_exc()

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

