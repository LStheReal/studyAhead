from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, Task, TaskType, StudyMode, StudyPlanStatus
from app.schemas import TaskResponse, TaskComplete
from app.ai_service import ai_service

router = APIRouter()

async def generate_schedule_background_with_results(
    study_plan_id: int, 
    user_id: int,
    test_result_id: Optional[int] = None
):
    """Background task to generate study schedule using pre-assessment test results."""
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if not plan or not plan.flashcards:
            return
        
        # Get user preferences
        user = db.query(User).filter(User.id == user_id).first()
        
        # Get test results if available
        test_results = None
        vocab_mastery = {}
        if test_result_id:
            from app.models import TestResult
            test_results = db.query(TestResult).filter(TestResult.id == test_result_id).first()
            if test_results and test_results.vocab_details:
                # Extract mastery levels from test results
                vocab_mastery = test_results.vocab_details
        
        # Prepare data for AI
        plan_data = {
            "name": plan.name,
            "exam_date": plan.exam_date.isoformat() if plan.exam_date else None,
            "type": plan.type.value
        }
        
        flashcards_data = []
        for fc in plan.flashcards:
            fc_data = {
                "id": fc.id,
                "front_text": fc.front_text,
                "back_text": fc.back_text,
                "difficulty": fc.difficulty,
                "mastery_level": fc.mastery_level
            }
            # Update mastery from test results if available
            if vocab_mastery and str(fc.id) in vocab_mastery:
                fc_data["mastery_level"] = vocab_mastery[str(fc.id)].get("mastery", fc.mastery_level)
            flashcards_data.append(fc_data)
        
        user_prefs = {
            "learning_speed": user.learning_speed.value,
            "study_hours_per_week": user.study_hours_per_week
        }
        
        # Generate schedule with test results
        tasks_data = ai_service.generate_study_schedule(
            plan_data, 
            flashcards_data, 
            user_prefs,
            test_results=test_results.vocab_details if test_results else None
        )
        
        # Delete existing tasks (except pre-assessment if it exists)
        db.query(Task).filter(
            Task.study_plan_id == study_plan_id,
            Task.title != "Pre-Assessment Test"
        ).delete()
        
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
        existing_tasks = db.query(Task).filter(Task.study_plan_id == study_plan_id).count()
        plan.tasks_total = existing_tasks
        plan.status = StudyPlanStatus.ACTIVE
        db.commit()
        
    except Exception as e:
        print(f"Error generating schedule with results: {e}")
        import traceback
        print(traceback.format_exc())
        plan = db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if plan:
            plan.status = StudyPlanStatus.ACTIVE
            db.commit()
    finally:
        db.close()

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
    background_tasks: BackgroundTasks,
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
    
    # Check if this is a pre-assessment test
    is_pre_assessment = (
        task.type == TaskType.COMPREHENSIVE_TEST and 
        task.title == "Pre-Assessment Test" and
        task.day_number == 1
    )
    
    if is_pre_assessment:
        # Create or get test result from completion data
        test_result_id = None
        if completion_data.results:
            from app.models import TestResult
            # Extract test result data
            score = completion_data.results.get("score", 0.0)
            total_questions = completion_data.results.get("total_questions", 0)
            correct_answers = completion_data.results.get("correct_answers", 0)
            vocab_details = completion_data.results.get("vocab_details", {})
            
            # Create test result
            test_result = TestResult(
                study_plan_id=plan.id,
                test_type="pre_assessment",
                score=score,
                total_questions=total_questions,
                correct_answers=correct_answers,
                user_answers=completion_data.results.get("user_answers"),
                vocab_details=vocab_details,
                time_spent=completion_data.time_spent
            )
            db.add(test_result)
            db.flush()
            test_result_id = test_result.id
            
            # Update flashcard mastery levels based on test results
            from app.models import Flashcard
            for flashcard_id_str, result_data in vocab_details.items():
                try:
                    flashcard_id = int(flashcard_id_str)
                    mastery = result_data.get("mastery", 0.0)
                    flashcard = db.query(Flashcard).filter(Flashcard.id == flashcard_id).first()
                    if flashcard:
                        flashcard.mastery_level = mastery
                except (ValueError, KeyError):
                    continue
        
        # Generate full schedule in background using test results
        plan.status = StudyPlanStatus.GENERATING
        db.commit()
        
        from app.routers.tasks import generate_schedule_background_with_results
        background_tasks.add_task(
            generate_schedule_background_with_results,
            plan.id,
            current_user.id,
            test_result_id
        )
        
        return {"message": "Pre-assessment completed. Generating personalized study schedule..."}
    
    # Mark plan as completed if all tasks are done (and not pre-assessment)
    if plan.tasks_total > 0 and plan.tasks_completed >= plan.tasks_total and plan.status != StudyPlanStatus.COMPLETED:
        plan.status = StudyPlanStatus.COMPLETED
    
    db.commit()
    return {"message": "Task completed"}

