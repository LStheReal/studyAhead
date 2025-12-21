from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models import User, UserLearningProfile
from app.schemas import UserResponse, UserUpdate, OnboardingData
from datetime import datetime

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/onboarding")
async def complete_onboarding(
    data: OnboardingData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete the onboarding process and create initial user profile."""
    # Helper to calculate initial strengths based on favorite subjects
    # This is a basic implementation to get started
    
    # Update User model core fields
    current_user.learning_speed = data.learning_speed
    current_user.study_hours_per_week = data.study_hours_per_week
    current_user.preferred_study_modes = data.preferred_study_modes
    
    # Update new Adaptive Learning fields
    current_user.favorite_subjects = data.favorite_subjects
    current_user.school_language = data.school_language
    current_user.study_time_preference = data.study_time_preference
    current_user.onboarding_completed = True
    current_user.onboarding_date = datetime.utcnow()
    
    try:
        # Create UserLearningProfile
        # Check if exists first (idempotency)
        profile = db.query(UserLearningProfile).filter(UserLearningProfile.user_id == current_user.id).first()
        
        if not profile:
            profile = UserLearningProfile(
                user_id=current_user.id,
                self_reported_speed=data.learning_speed,
                subject_learning_speeds={}, # Empty initially
                mode_performance={}, # Empty initially
                subject_strengths={subj: 0.7 for subj in data.favorite_subjects} # Give boost to favorites
            )
            db.add(profile)
        else:
            # Update existing profile
            profile.self_reported_speed = data.learning_speed
            # Update strengths (merge with existing or overwrite?)
            # For now, just ensuring favorites have at least 0.7
            current_strengths = dict(profile.subject_strengths) if profile.subject_strengths else {}
            for subj in data.favorite_subjects:
                current_strengths[subj] = max(current_strengths.get(subj, 0), 0.7)
            profile.subject_strengths = current_strengths
            
        db.commit()
        
        return {"message": "Onboarding completed successfully"}
    except Exception as e:
        db.rollback()
        print(f"Error in onboarding: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Onboarding failed: {str(e)}"
        )

