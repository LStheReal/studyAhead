from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import List, Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, Task, TestResult, StudyPlanStatus
from app.schemas import DashboardStats, StudyPlanResponse, TaskResponse

router = APIRouter()

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive dashboard statistics."""
    # Total study plans
    total_plans = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id
    ).count()
    
    # Average test score
    avg_score_result = db.query(func.avg(TestResult.score)).join(StudyPlan).filter(
        StudyPlan.user_id == current_user.id
    ).scalar()
    average_test_score = float(avg_score_result) if avg_score_result else 0.0
    
    # Overall progress (average of all active plans)
    active_plans = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id,
        StudyPlan.status.in_([StudyPlanStatus.ACTIVE, StudyPlanStatus.AWAITING_APPROVAL])
    ).all()
    overall_progress = 0.0
    if active_plans:
        overall_progress = sum(p.progress_percentage for p in active_plans) / len(active_plans)
    
    # Study streak
    from app.routers.study_sessions import get_study_streak
    streak_data = await get_study_streak(current_user, db)
    study_streak = streak_data.get("streak", 0)
    
    # Tests rocked (completed study plans - all tasks done)
    # First, mark any plans as completed if all tasks are done
    all_plans = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id
    ).all()
    
    for plan in all_plans:
        if plan.tasks_total > 0 and plan.tasks_completed >= plan.tasks_total:
            if plan.status != StudyPlanStatus.COMPLETED:
                plan.status = StudyPlanStatus.COMPLETED
    
    db.commit()
    
    # Count completed study plans
    tests_rocked = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id,
        StudyPlan.status == StudyPlanStatus.COMPLETED
    ).count()
    
    # Active study plan (most recent active plan)
    active_study_plan = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id,
        StudyPlan.status.in_([StudyPlanStatus.ACTIVE, StudyPlanStatus.AWAITING_APPROVAL])
    ).order_by(StudyPlan.created_at.desc()).first()
    
    active_plan_response = None
    if active_study_plan:
        active_plan_response = StudyPlanResponse.from_orm(active_study_plan)
    
    # Today's tasks
    today = datetime.utcnow().date()
    today_tasks = db.query(Task).join(StudyPlan).filter(
        StudyPlan.user_id == current_user.id,
        func.date(Task.scheduled_date) == today,
        Task.completion_status == False
    ).order_by(Task.order).all()
    
    today_tasks_response = [TaskResponse.from_orm(t) for t in today_tasks]

    # Inject pending Pre-Assessments
    from app.models import PreAssessment, TaskType, StudyMode
    pending_assessments = db.query(PreAssessment).join(StudyPlan).filter(
        StudyPlan.user_id == current_user.id,
        PreAssessment.status == "pending"
    ).all()

    for assessment in pending_assessments:
        # Create a synthetic task for the pre-assessment
        synthetic_task = TaskResponse(
            id=0, # Dummy ID, not used for pre-assessment navigation
            study_plan_id=assessment.study_plan_id,
            title=f"Initial Assessment: {assessment.study_plan.name}",
            description="Complete the initial assessment to personalize your study plan.",
            type=TaskType.PRE_ASSESSMENT,
            mode=StudyMode.PRE_ASSESSMENT,
            estimated_minutes=15,
            day_number=0,
            rationale="Essential for calibrating your learning path.",
            completion_status=False,
            scheduled_date=datetime.utcnow(),
            order=-1
        )
        # Prepend to make sure it's the first thing they see
        today_tasks_response.insert(0, synthetic_task)
    
    # Upcoming exams (active plans with exam dates)
    upcoming_exams = db.query(StudyPlan).filter(
        StudyPlan.user_id == current_user.id,
        StudyPlan.status == StudyPlanStatus.ACTIVE,
        StudyPlan.exam_date.isnot(None),
        StudyPlan.exam_date > datetime.utcnow()
    ).order_by(StudyPlan.exam_date).limit(5).all()
    
    upcoming_exams_response = [StudyPlanResponse.from_orm(p) for p in upcoming_exams]
    
    # Profile Stats
    from app.models import UserLearningProfile
    profile = db.query(UserLearningProfile).filter(UserLearningProfile.user_id == current_user.id).first()
    learning_efficiency = profile.learning_efficiency_factor if profile else 1.0
    subject_strengths = profile.subject_strengths if profile else {}

    return DashboardStats(
        total_study_plans=total_plans,
        average_test_score=average_test_score,
        overall_progress=overall_progress,
        study_streak=study_streak,
        tests_rocked=tests_rocked,
        active_study_plan=active_plan_response,
        today_tasks=today_tasks_response,
        upcoming_exams=upcoming_exams_response,
        learning_efficiency=learning_efficiency,
        subject_strengths=subject_strengths
    )

