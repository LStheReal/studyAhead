from app.database import SessionLocal
from app.models import StudyPlan, Flashcard, MaterialSummary

def check_plan_10():
    db = SessionLocal()
    try:
        plan = db.query(StudyPlan).filter(StudyPlan.id == 10).first()
        if not plan:
            print("Plan 10 not found")
            return

        print(f"Plan 10: {plan.name}, Status: {plan.status}")
        
        summary = db.query(MaterialSummary).filter(MaterialSummary.study_plan_id == 10).first()
        if summary:
            print(f"Material Summary: {summary.title}, Category: {summary.category}")
        else:
            print("No Material Summary found")

        flashcards = db.query(Flashcard).filter(Flashcard.study_plan_id == 10).all()
        print(f"Flashcards count: {len(flashcards)}")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_plan_10()
