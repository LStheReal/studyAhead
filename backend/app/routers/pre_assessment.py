from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, PreAssessment
from app.schemas import PreAssessmentResponseModel, PreAssessmentSubmit
from app.services.pre_assessment import PreAssessmentService
from app.services.adaptive_learning import AdaptiveLearningService

router = APIRouter()

# ... existing endpoints ...

@router.post("/{plan_id}/submit", response_model=PreAssessmentResponseModel)
async def submit_pre_assessment(
    plan_id: int,
    submission: PreAssessmentSubmit,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit answers for pre-assessment."""
    # Get assessment ID
    assessment = db.query(PreAssessment).join(StudyPlan).filter(
        PreAssessment.study_plan_id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Pre-assessment not found")
        
    if assessment.status == "completed":
        raise HTTPException(status_code=400, detail="Assessment already completed")
        
    service = PreAssessmentService(db)
    result = service.submit_assessment(assessment.id, submission.responses)
    
    # TRIGGER ADAPTIVE SCHEDULE GENERATION (As background task to prevent UI hang)
    from app.models import StudyPlanStatus
    assessment.study_plan.status = StudyPlanStatus.GENERATING
    db.commit()

    from app.routers.tasks import generate_schedule_background
    background_tasks.add_task(
        generate_schedule_background,
        plan_id,
        current_user.id
    )
    
    return result

@router.post("/{plan_id}/generate", response_model=PreAssessmentResponseModel)
async def generate_pre_assessment(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a pre-assessment for a study plan."""
    # Verify ownership
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id, StudyPlan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
        
    service = PreAssessmentService(db)
    assessment = service.generate_pre_assessment(plan_id)
    
    if not assessment:
        raise HTTPException(status_code=400, detail="Could not generate assessment (no flashcards?)")
        
    return assessment

@router.get("/{plan_id}", response_model=PreAssessmentResponseModel)
async def get_pre_assessment(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the existing pre-assessment for a plan."""
    assessment = db.query(PreAssessment).join(StudyPlan).filter(
        PreAssessment.study_plan_id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Pre-assessment not found")
        
    return assessment


