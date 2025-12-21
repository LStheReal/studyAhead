from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import (
    StudyPlan, Flashcard, PreAssessment, PreAssessmentResponse, 
    PreAssessmentResponse as PreAssessmentResponseModel, # Alias if needed
    UserLearningProfile
)
import random
from datetime import datetime

class PreAssessmentService:
    def __init__(self, db: Session):
        self.db = db

    def generate_pre_assessment(self, study_plan_id: int):
        """
        Generates a pre-assessment for a given study plan.
        Samples 20-30% of flashcards.
        """
        # Check if already exists
        existing = self.db.query(PreAssessment).filter(
            PreAssessment.study_plan_id == study_plan_id
        ).first()
        if existing:
            return existing

        # Get all flashcards
        flashcards = self.db.query(Flashcard).filter(
            Flashcard.study_plan_id == study_plan_id
        ).all()
        
        if not flashcards:
            return None

        total_cards = len(flashcards)
        # Sample size: 25% or max 20 items to keep it short
        sample_size = min(max(5, int(total_cards * 0.25)), 20)
        sample_size = min(sample_size, total_cards) # Ensure not more than exists
        
        selected_flashcards = random.sample(flashcards, sample_size)
        
        # Create questions structure
        questions_data = []
        for fc in selected_flashcards:
            # Prefer MCQ if available, else Flashcard
            question_type = "flashcard"
            options = []
            
            if fc.mcq_questions:
                # Use the first MCQ question found
                mcq = fc.mcq_questions[0]
                question_type = "mcq"
                options = mcq.options
                question_text = mcq.question_text
            else:
                question_text = fc.front_text
                
            questions_data.append({
                "flashcard_id": fc.id,
                "type": question_type,
                "text": question_text,
                "options": options,
                "back_text": fc.back_text # For checking in frontend if needed, strictly front/back
            })

        # Create Record
        pre_assessment = PreAssessment(
            study_plan_id=study_plan_id,
            status="pending",
            total_questions=len(questions_data),
            questions_data=questions_data
        )
        self.db.add(pre_assessment)
        self.db.commit()
        self.db.refresh(pre_assessment)
        
        return pre_assessment

    def submit_assessment(self, pre_assessment_id: int, responses: list):
        """
        Processes the submission.
        Updates Flashcard mastery based on results.
        """
        assessment = self.db.query(PreAssessment).filter(PreAssessment.id == pre_assessment_id).first()
        if not assessment:
            return None
            
        correct_count = 0
        
        for resp in responses:
            is_correct = resp.is_correct
            if is_correct:
                correct_count += 1
            
            # Record response
            db_response = PreAssessmentResponse(
                pre_assessment_id=assessment.id,
                flashcard_id=resp.flashcard_id,
                is_correct=is_correct,
                response_time_ms=resp.response_time_ms
            )
            self.db.add(db_response)
            
            # UPDATE FLASHCARD MASTERY
            # If correct in pre-assessment -> High Mastery (Skip for a while)
            # If incorrect -> Low Mastery (Need to learn)
            flashcard = self.db.query(Flashcard).filter(Flashcard.id == resp.flashcard_id).first()
            if flashcard:
                if is_correct:
                    flashcard.mastery_level = 80.0  # High mastery
                    flashcard.times_studied = 1
                    flashcard.last_studied = datetime.utcnow()
                    flashcard.difficulty = "easy" # Mark as easy for now
                else:
                    flashcard.mastery_level = 0.0
                    flashcard.times_studied = 1 # We "studied" it by failing
                    flashcard.last_studied = datetime.utcnow()
                    # Keep existing difficulty or set to hard? Keep default "medium" usually.
        
        # Update Assessment Status
        score = (correct_count / assessment.total_questions) * 100 if assessment.total_questions > 0 else 0
        assessment.correct_score = score
        assessment.status = "completed"
        assessment.completed_at = datetime.utcnow()
        
        self.db.commit()
        return assessment
