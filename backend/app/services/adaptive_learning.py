from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import math
from app.models import (
    StudyPlan, Flashcard, UserLearningProfile, Task, TaskType, StudyMode, 
    PreAssessment, MaterialCategory, User
)

class AdaptiveLearningService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_personalized_speed(self, user_id: int, plan_category: str, pre_assessment_score: float = 0):
        """
        Calculates Items Per Hour based on:
        1. Base speed (self-reported)
        2. Subject strength (historical or favorites)
        3. Pre-assessment score (current knowledge)
        """
        profile = self.db.query(UserLearningProfile).filter(UserLearningProfile.user_id == user_id).first()
        
        # 1. Base Speed
        base_speed = 20 # Moderate default
        if profile and profile.self_reported_speed == "fast":
            base_speed = 30
        elif profile and profile.self_reported_speed == "slow":
            base_speed = 12
            
        # 2. Subject Modifier
        subject_modifier = 1.0
        if profile and profile.subject_strengths:
            # Check if category matches any favorite subject loosely
            # For now simplified direct match or default
            strength = profile.subject_strengths.get(plan_category, 0.5) 
            if strength > 0.7:
                subject_modifier = 1.25 # Strong subject
            elif strength < 0.3:
                subject_modifier = 0.8 # Weak subject

        # 3. Pre-Assessment Modifier
        # High score means they grasp this specific material quickly or know it
        # We increase speed because there is less "new" cognitive load
        assessment_modifier = 1.0
        if pre_assessment_score > 80:
            assessment_modifier = 1.5
        elif pre_assessment_score > 50:
            assessment_modifier = 1.2
            
        final_speed = base_speed * subject_modifier * assessment_modifier
        return round(final_speed, 1)

    def generate_adaptive_schedule(self, study_plan_id: int):
        """
        Regenerates tasks for the study plan based on adaptive logic.
        Progressive Difficulty: Quiz (Easy) -> Flashcard (Med) -> Write (Hard)
        """
        plan = self.db.query(StudyPlan).filter(StudyPlan.id == study_plan_id).first()
        if not plan:
            return None
            
        user = self.db.query(User).filter(User.id == plan.user_id).first()
        if not user:
            return None

        # 1. Get filtered items (exclude mastered items 70%+)
        # Items with >70% mastery don't need intense study right now, maybe just review later
        all_flashcards = self.db.query(Flashcard).filter(Flashcard.study_plan_id == study_plan_id).all()
        learning_items = [f for f in all_flashcards if f.mastery_level < 70]
        
        items_count = len(learning_items)
        if items_count == 0:
            return # Nothing to schedule? Or maybe just review tasks.
            
        # 2. Calculate Deadline constraints
        if not plan.exam_date:
            # Default to 7 days if no date
            days_available = 7
        else:
            days_available = (plan.exam_date.replace(tzinfo=None) - datetime.utcnow()).days
            days_available = max(1, days_available)
            
        # 3. Calculate Daily Load
        # Get personalized speed
        # Check pre-assessment score
        pa = self.db.query(PreAssessment).filter(PreAssessment.study_plan_id == plan.id).first()
        pa_score = pa.correct_score if pa else 0
        category = plan.category.value if plan.category else "general"
        
        speed_items_per_hour = self.calculate_personalized_speed(user.id, category, pa_score)
        
        # User constraint: hours per week -> hours per day
        daily_hours = (user.study_hours_per_week or 10) / 7.0
        daily_capacity = speed_items_per_hour * daily_hours
        
        # 4. Generate Phases
        # Clear existing tasks (except completed ones? For now simplified: clear all incomplete)
        self.db.query(Task).filter(
            Task.study_plan_id == study_plan_id, 
            Task.completion_status == False
        ).delete()
        
        tasks_to_create = []
        
        # Phase 1: Recognition (First 30% of days) - Quiz & Match
        phase1_days = max(1, int(days_available * 0.3))
        # Phase 2: Recall (Next 40%) - Flashcards & Fill Gaps
        phase2_days = max(1, int(days_available * 0.4))
        # Phase 3: Production (Final 30%) - Write & Test
        phase3_days = days_available - phase1_days - phase2_days
        
        current_day = 1
        
        # Helper to create daily tasks
        def create_daily_task(day, mode, title, duration, rationale):
            return Task(
                study_plan_id=study_plan_id,
                title=title,
                description=f"Adaptive session focusing on {len(learning_items)} items.",
                type=TaskType.FLASHCARD_REVIEW, # Generic type mapping for now
                mode=mode,
                priority=1,
                estimated_minutes=int(duration),
                day_number=day,
                rationale=rationale,
                completion_status=False,
                scheduled_date=datetime.utcnow() + timedelta(days=day-1)
            )

        # Generate Phase 1
        for d in range(phase1_days):
            mode = StudyMode.QUIZ
            tasks_to_create.append(create_daily_task(
                current_day, mode, "Rapid Recognition", 20, 
                "Phase 1: Build recognition speed with multiple choice."
            ))
            current_day += 1
            
        # Generate Phase 2
        for d in range(phase2_days):
            mode = StudyMode.LEARN # Flashcards
            tasks_to_create.append(create_daily_task(
                current_day, mode, "Active Recall", 30, 
                "Phase 2: Strengthen memory connections with flashcards."
            ))
            current_day += 1
            
        # Generate Phase 3
        for d in range(phase3_days):
            mode = StudyMode.WRITE
            tasks_to_create.append(create_daily_task(
                current_day, mode, "Deep Mastery", 40, 
                "Phase 3: Prove mastery by writing answers."
            ))
            current_day += 1

        self.db.add_all(tasks_to_create)
        self.db.commit()
        
        return len(tasks_to_create)
