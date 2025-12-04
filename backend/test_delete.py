"""Test delete functionality."""
import sys
sys.path.insert(0, '/Users/louiseschule/Documents/studyahead/backend')

from app.database import SessionLocal
from app.models import StudyPlan, Flashcard, MaterialSummary, Task

# Get a test plan
with SessionLocal() as db:
    # Find plan 10 (one of the test plans)
    plan = db.query(StudyPlan).filter(StudyPlan.id == 10).first()
    
    if plan:
        print(f"Plan {plan.id}: {plan.name}")
        print(f"  Flashcards: {len(plan.flashcards)}")
        print(f"  Tasks: {len(plan.tasks)}")
        print(f"  Material Summary: {plan.material_summary is not None}")
        
        # Try to delete
        print(f"\nDeleting plan {plan.id}...")
        db.delete(plan)
        db.commit()
        print("Delete successful!")
        
        # Verify deletion
        remaining_flashcards = db.query(Flashcard).filter(Flashcard.study_plan_id == 10).count()
        remaining_summary = db.query(MaterialSummary).filter(MaterialSummary.study_plan_id == 10).count()
        remaining_tasks = db.query(Task).filter(Task.study_plan_id == 10).count()
        
        print(f"\nVerification:")
        print(f"  Remaining flashcards: {remaining_flashcards}")
        print(f"  Remaining summaries: {remaining_summary}")
        print(f"  Remaining tasks: {remaining_tasks}")
    else:
        print("Plan 10 not found")
