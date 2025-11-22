from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
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
        
        if file_paths:
            for file_path in file_paths:
                file_ext = Path(file_path).suffix.lower()
                
                if file_ext == ".pdf":
                    # Extract text from PDF
                    with pdfplumber.open(file_path) as pdf:
                        pdf_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
                        combined_text += "\n\n" + pdf_text
                
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
                        
                        # Use AI vision to extract text
                        image_text = ai_service.extract_text_from_image(str(file_path))
                        combined_text += "\n\n" + image_text
                    except Exception as e:
                        print(f"Error processing image {file_path}: {e}")
        
        if not combined_text.strip():
            plan.status = StudyPlanStatus.AWAITING_APPROVAL
            db.commit()
            return
        
        # Analyze material
        analysis = ai_service.analyze_material(combined_text)
        
        # Create material summary
        summary = MaterialSummary(
            study_plan_id=study_plan_id,
            title=analysis.get("title", "Untitled Material"),
            category=MaterialCategory(analysis.get("category", "other")),
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
        
        # Generate flashcards
        flashcard_data = ai_service.generate_flashcards(analysis, count=30)
        
        for fc_data in flashcard_data:
            flashcard = Flashcard(
                study_plan_id=study_plan_id,
                material_summary_id=summary.id,
                front_text=fc_data.get("front_text", ""),
                back_text=fc_data.get("back_text", ""),
                difficulty=fc_data.get("difficulty", "medium")
            )
            db.add(flashcard)
        
        db.commit()
        
        # Update plan status
        plan.status = StudyPlanStatus.AWAITING_APPROVAL
        plan.category = summary.category
        db.commit()
        
    except Exception as e:
        print(f"Error in background processing: {e}")
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
    files: Optional[List[UploadFile]] = File(None),
    text_content: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload materials (PDF, images, or text) for processing."""
    # Verify study plan ownership
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == study_plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    if not files and not text_content:
        raise HTTPException(status_code=400, detail="Please provide files or text content")
    
    # Save uploaded files
    file_paths = []
    if files:
        for file in files:
            # Check file size
            contents = await file.read()
            if len(contents) > settings.max_upload_size:
                raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds size limit")
            
            # Save file
            file_path = UPLOAD_DIR / f"{study_plan_id}_{file.filename}"
            with open(file_path, "wb") as f:
                f.write(contents)
            file_paths.append(str(file_path))
    
    # Start background processing
    background_tasks.add_task(
        process_materials_background,
        study_plan_id,
        current_user.id,
        text_content,
        file_paths
    )
    
    return {"message": "Materials uploaded, processing started"}

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
    
    return {
        "status": plan.status.value,
        "current_step": plan.current_step,
        "has_summary": plan.material_summary is not None,
        "flashcard_count": len(plan.flashcards)
    }

