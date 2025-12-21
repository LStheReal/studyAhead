import sys
import os
from sqlalchemy.orm import Session
# Add the current directory to sys.path so we can import app
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.database import SessionLocal
from app.models import StudyPlan, PreAssessment, Flashcard
from app.services.pre_assessment import PreAssessmentService

def fix_missing():
    print("Checking for plans missing pre-assessments...")
    with SessionLocal() as db:
        # Find plans that don't have a pre-assessment
        plans = db.query(StudyPlan).all()
        service = PreAssessmentService(db)
        
        count = 0
        for plan in plans:
            # Check if has flashcards (can't generate assessment without cards)
            if not plan.flashcards:
                print(f"  Plan {plan.id} has no flashcards, skipping.")
                continue
                
            # Check if assessment exists
            if not plan.pre_assessment:
                print(f"  Generating assessment for plan {plan.id} ('{plan.name}')...")
                service.generate_pre_assessment(plan.id)
                count += 1
            else:
                print(f"  Plan {plan.id} already has an assessment.")

    print(f"Done. Generated {count} missing assessments.")

if __name__ == "__main__":
    fix_missing()
