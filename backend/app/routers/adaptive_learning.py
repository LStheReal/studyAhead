from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan
from app.services.adaptive_learning import AdaptiveLearningService

router = APIRouter()

@router.post("/{plan_id}/generate-schedule")
async def generate_adaptive_schedule_endpoint(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate the study schedule based on adaptive learning logic.
    """
    # Verify ownership
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id, StudyPlan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
        
    service = AdaptiveLearningService(db)
    tasks_count = service.generate_adaptive_schedule(plan_id)
    
    if tasks_count is None:
        raise HTTPException(status_code=400, detail="Could not generate schedule (no items or invalid plan)")
        
    return {"message": "Adaptive schedule generated successfully", "tasks_count": tasks_count}
