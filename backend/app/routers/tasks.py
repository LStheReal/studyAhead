from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, Task, TaskType, StudyMode, StudyPlanStatus
from app.schemas import TaskResponse, TaskComplete
from app.ai_service import ai_service

router = APIRouter()

async def generate_schedule_background(study_plan_id: int, user_id: int):
    """Background task to generate study schedule."""
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if not plan or not plan.flashcards:
            return
        
        # Get user preferences
        user = db.query(User).filter(User.id == user_id).first()
        
        # Prepare data for AI
        plan_data = {
            "name": plan.name,
            "exam_date": plan.exam_date.isoformat() if plan.exam_date else None,
            "type": plan.type.value
        }
        
        flashcards_data = [
            {
                "front_text": fc.front_text,
                "back_text": fc.back_text,
                "difficulty": fc.difficulty,
                "mastery_level": fc.mastery_level
            }
            for fc in plan.flashcards
        ]
        
        user_prefs = {
            "learning_speed": user.learning_speed.value,
            "study_hours_per_week": user.study_hours_per_week
        }
        
        # Generate schedule
        tasks_data = ai_service.generate_study_schedule(plan_data, flashcards_data, user_prefs)
        
        # Delete existing tasks
        db.query(Task).filter(Task.study_plan_id == study_plan_id).delete()
        
        # Create tasks
        today = datetime.utcnow().date()
        for task_data in tasks_data:
            day_num = task_data.get("day_number", 1)
            scheduled_date = today + timedelta(days=day_num - 1)
            
            task = Task(
                study_plan_id=study_plan_id,
                title=task_data.get("title", "Study Task"),
                description=None,
                type=TaskType(task_data.get("type", "flashcard_review")),
                mode=StudyMode(task_data.get("mode", "learn")),
                estimated_minutes=task_data.get("estimated_minutes", 20),
                day_number=day_num,
                rationale=task_data.get("rationale"),
                scheduled_date=scheduled_date,
                order=task_data.get("order", 0)
            )
            db.add(task)
        
        # Update plan
        plan.tasks_total = len(tasks_data)
        plan.status = StudyPlanStatus.ACTIVE
        db.commit()
        
    except Exception as e:
        print(f"Error generating schedule: {e}")
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if plan:
            plan.status = StudyPlanStatus.ACTIVE
            db.commit()
    finally:
        db.close()

@router.get("/study-plan/{plan_id}", response_model=List[TaskResponse])
async def get_tasks(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks for a study plan."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    tasks = db.query(Task).filter(Task.study_plan_id == plan_id).order_by(
        Task.scheduled_date, Task.order
    ).all()
    
    return tasks

@router.get("/today", response_model=List[TaskResponse])
async def get_today_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks due today for current user."""
    today = datetime.utcnow().date()
    
    tasks = db.query(Task).join(StudyPlan).filter(
        StudyPlan.user_id == current_user.id,
        Task.scheduled_date == today,
        Task.completion_status == False
    ).order_by(Task.order).all()
    
    return tasks

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific task."""
    task = db.query(Task).join(StudyPlan).filter(
        Task.id == task_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task

@router.post("/{task_id}/complete")
async def complete_task(
    task_id: int,
    completion_data: TaskComplete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a task as complete."""
    task = db.query(Task).join(StudyPlan).filter(
        Task.id == task_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.completion_status = True
    task.completed_at = datetime.utcnow()
    
    # Update study plan progress
    plan = task.study_plan
    plan.tasks_completed += 1
    if plan.tasks_total > 0:
        plan.progress_percentage = (plan.tasks_completed / plan.tasks_total) * 100
        
        # Mark plan as completed if all tasks are done
        if plan.tasks_completed >= plan.tasks_total and plan.status != StudyPlanStatus.COMPLETED:
            plan.status = StudyPlanStatus.COMPLETED
    
    db.commit()
    return {"message": "Task completed"}

