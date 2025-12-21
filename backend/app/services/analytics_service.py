from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import UserLearningProfile, User, StudySessionTracking, StudyPlan

class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def update_profile_after_session(self, user_id: int):
        """
        Recalculates efficiency and strengths based on recent tracking data.
        Should be called asynchronously or periodically, but we'll call it synchronously for now.
        """
        profile = self.db.query(UserLearningProfile).filter(UserLearningProfile.user_id == user_id).first()
        if not profile:
            # Create if missing
            profile = UserLearningProfile(user_id=user_id)
            self.db.add(profile)
            self.db.commit()
            
        # 1. Update Global Speed (Efficiency)
        # Look at last 100 tracking logs
        recent_logs = self.db.query(StudySessionTracking).filter(
            StudySessionTracking.user_id == user_id
        ).order_by(StudySessionTracking.created_at.desc()).limit(100).all()
        
        if not recent_logs:
            return

        correct_count = sum(1 for log in recent_logs if log.is_correct)
        accuracy = correct_count / len(recent_logs)
        
        # Simple heuristic: If accuracy > 90%, they are fast/efficient. If < 60%, slow.
        # Adjust efficiency factor slowly
        current_efficiency = profile.learning_efficiency_factor or 1.0
        
        if accuracy > 0.9:
            current_efficiency = min(2.0, current_efficiency * 1.05)
        elif accuracy < 0.6:
            current_efficiency = max(0.5, current_efficiency * 0.95)
            
        profile.learning_efficiency_factor = current_efficiency
        
        # 2. Update Subject Strengths
        # Group logs by StudyPlan -> Category
        # This is expensive, so maybe simplify. 
        # Just pick the latest log's plan
        latest_log = recent_logs[0]
        plan = self.db.query(StudyPlan).filter(StudyPlan.id == latest_log.study_plan_id).first()
        if plan and plan.category:
            category_key = plan.category.value
            
            # Calculate strength in this category from recent logs
            cat_logs = [l for l in recent_logs if l.study_plan_id == plan.id]
            if cat_logs:
                cat_correct = sum(1 for l in cat_logs if l.is_correct)
                cat_accuracy = cat_correct / len(cat_logs)
                
                current_strengths = dict(profile.subject_strengths or {})
                old_strength = current_strengths.get(category_key, 0.5)
                
                # Blend old and new (Moving Average)
                new_strength = (old_strength * 0.8) + (cat_accuracy * 0.2)
                current_strengths[category_key] = round(new_strength, 2)
                
                profile.subject_strengths = current_strengths
                # Also update specific speed for this subject
                speeds = dict(profile.subject_learning_speeds or {})
                # Base speed * efficiency * strength
                # Not exact but indicative
                speeds[category_key] = round(20 * current_efficiency * new_strength + 5, 1) # Arbitrary formula
                profile.subject_learning_speeds = speeds

        self.db.commit()
