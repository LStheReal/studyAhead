from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date, timedelta
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudySession, Task
from app.schemas import StudySessionCreate, StudySessionResponse

router = APIRouter()

@router.post("/", response_model=StudySessionResponse)
async def create_study_session(
    session_data: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update today's study session."""
    today = datetime.utcnow().date()
    
    # Check if session exists for today
    session = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.date == today
    ).first()
    
    if not session:
        # Get tasks available today
        tasks_available = db.query(Task).join(StudyPlan).filter(
            StudyPlan.user_id == current_user.id,
            Task.scheduled_date == today
        ).count()
        
        session = StudySession(
            user_id=current_user.id,
            date=today,
            tasks_available=tasks_available,
            tasks_completed=session_data.tasks_completed
        )
        db.add(session)
    else:
        session.tasks_completed = session_data.tasks_completed
    
    # Check if all tasks completed
    if session.tasks_available > 0 and session.tasks_completed >= session.tasks_available:
        session.is_complete_day = True
    
    db.commit()
    db.refresh(session)
    return session

@router.get("/streak")
async def get_study_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate study streak (consecutive days with completed tasks)."""
    sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.is_complete_day == True
    ).order_by(StudySession.date.desc()).all()
    
    if not sessions:
        return {"streak": 0}
    
    # Check if today or yesterday has a session
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    streak = 0
    current_date = today
    
    for session in sessions:
        if session.date.date() == current_date or session.date.date() == current_date - timedelta(days=1):
            streak += 1
            current_date = session.date.date() - timedelta(days=1)
        else:
            break
    
    return {"streak": streak}

