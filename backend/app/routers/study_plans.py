from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, StudyPlanStatus, MaterialCategory, Flashcard
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
    try:
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
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create study plan: {str(e)}"
        )

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
    
    # Check if flashcards exist - need to query explicitly to get count
    flashcard_count = db.query(Flashcard).filter(Flashcard.study_plan_id == plan_id).count()
    if flashcard_count == 0:
        raise HTTPException(
            status_code=400, 
            detail="No flashcards found. Please ensure materials were processed successfully. You may need to upload materials again."
        )
    
    # Update status and create pre-assessment task
    try:
        from app.models import Task, TaskType, StudyMode
        from datetime import datetime, timezone
        
        # Check if task already exists (in case of retry)
        existing_task = db.query(Task).filter(
            Task.study_plan_id == plan_id,
            Task.title == "Pre-Assessment Test"
        ).first()
        
        if existing_task:
            # Task already exists, just update plan status
            plan.status = StudyPlanStatus.ACTIVE
            if plan.tasks_total == 0:
                plan.tasks_total = 1
            db.commit()
            return {"message": "Pre-assessment test already exists. Please complete it to generate your personalized study schedule."}
        
        plan.status = StudyPlanStatus.ACTIVE
        
        # Create pre-assessment test task for day 1
        today = datetime.now(timezone.utc)
        pre_assessment_task = Task(
            study_plan_id=plan_id,
            title="Pre-Assessment Test",
            description="Take this test to assess your current level with the vocabulary. This will help us create a personalized study schedule.",
            type=TaskType.COMPREHENSIVE_TEST,
            mode=StudyMode.SHORT_TEST,  # Using SHORT_TEST mode for pre-assessment
            estimated_minutes=30,
            day_number=1,
            rationale="Pre-assessment to determine your current vocabulary level and adapt the study plan accordingly.",
            scheduled_date=today,
            order=0,
            completion_status=False
        )
        db.add(pre_assessment_task)
        
        plan.tasks_total = 1
        plan.tasks_completed = 0
        db.commit()
        
        # Verify task was created
        created_task = db.query(Task).filter(Task.study_plan_id == plan_id).first()
        if not created_task:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to create pre-assessment task"
            )
        
        return {"message": "Pre-assessment test created. Please complete it to generate your personalized study schedule."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        print(f"Error creating pre-assessment task: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create pre-assessment task: {str(e)}"
        )

