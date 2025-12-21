from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudySessionTracking, StudyPlan, Flashcard
from app.schemas import TrackingLog, TrackingResponse
from datetime import datetime

from app.services.analytics_service import AnalyticsService

router = APIRouter()

@router.post("/log", response_model=TrackingResponse)
async def log_study_activity(
    log_data: TrackingLog,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log a micro-interaction during a study session (e.g. answering a flashcard).
    """
    # Simply record the data
    tracking_entry = StudySessionTracking(
        user_id=current_user.id,
        study_plan_id=log_data.study_plan_id,
        mode=log_data.mode,
        flashcard_id=log_data.flashcard_id,
        is_correct=log_data.is_correct,
        response_time_ms=log_data.response_time_ms,
        attempts_needed=log_data.attempts_needed
    )
    
    db.add(tracking_entry)
    
    # Also update Flashcard real-time stats
    if log_data.flashcard_id:
        flashcard = db.query(Flashcard).filter(Flashcard.id == log_data.flashcard_id).first()
        if flashcard:
            flashcard.times_studied += 1
            flashcard.last_studied = datetime.utcnow()

    db.commit()
    
    # TRIGGER ANALYTICS UPDATE (Lite version / sampling)
    # Only update every 5th log to save resources, or check if user is completing a session
    # For now, simplistic approach: call it.
    analytics_service = AnalyticsService(db)
    analytics_service.update_profile_after_session(current_user.id)
    
    return {"status": "logged"}
