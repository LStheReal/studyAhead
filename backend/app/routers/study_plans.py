from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, StudyPlanStatus, MaterialCategory
from app.schemas import StudyPlanCreate, StudyPlanResponse
from app.ai_service import ai_service

router = APIRouter()

@router.post("/", response_model=StudyPlanResponse)
async def create_study_plan(
    plan_data: StudyPlanCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new study plan. If materials are provided, start background processing."""
    db_plan = StudyPlan(
        user_id=current_user.id,
        name=plan_data.name,
        type=plan_data.type,
        exam_date=plan_data.exam_date,
        learning_objectives=plan_data.learning_objectives,
        question_language=plan_data.question_language,
        answer_language=plan_data.answer_language,
        status=StudyPlanStatus.GENERATING
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    return db_plan

@router.get("/", response_model=List[StudyPlanResponse])
async def get_study_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all study plans for current user."""
    plans = db.query(StudyPlan).filter(StudyPlan.user_id == current_user.id).all()
    return plans

@router.get("/{plan_id}", response_model=StudyPlanResponse)
async def get_study_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific study plan."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    return plan

@router.put("/{plan_id}", response_model=StudyPlanResponse)
async def update_study_plan(
    plan_id: int,
    plan_update: StudyPlanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a study plan."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    for field, value in plan_update.dict(exclude_unset=True).items():
        setattr(plan, field, value)
    
    db.commit()
    db.refresh(plan)
    return plan

@router.delete("/{plan_id}")
async def delete_study_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a study plan (cascades to flashcards, tasks, etc.)."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    db.delete(plan)
    db.commit()
    return {"message": "Study plan deleted"}

@router.post("/{plan_id}/approve")
async def approve_study_plan(
    plan_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve study plan and generate schedule."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    if plan.status != StudyPlanStatus.AWAITING_APPROVAL:
        raise HTTPException(status_code=400, detail="Plan not in approval state")
    
    # Check if flashcards exist
    if not plan.flashcards:
        raise HTTPException(status_code=400, detail="No flashcards to create schedule")
    
    # Update status and generate schedule in background
    plan.status = StudyPlanStatus.GENERATING
    db.commit()
    
    # Generate schedule in background
    from app.routers.tasks import generate_schedule_background
    background_tasks.add_task(generate_schedule_background, plan_id, current_user.id)
    
    return {"message": "Schedule generation started"}

