"""Fix stuck plans by resetting them and re-running background processing."""
import asyncio
import sys
sys.path.insert(0, '/Users/louiseschule/Documents/studyahead/backend')

from app.database import SessionLocal
from app.models import StudyPlan, StudyPlanStatus
from app.routers.materials import process_materials_background

async def main():
    print("Fixing stuck plans...")
    
    # Get plan 11 (Vocabulary Test)
    with SessionLocal() as db:
        plan = db.query(StudyPlan).filter(StudyPlan.id == 11).first()
        if plan:
            print(f"Plan 11: {plan.name}, Status: {plan.status}")
            print(f"Flashcards: {len(plan.flashcards)}")
            
            # Re-run background processing
            print("\nRe-running background processing for plan 11...")
            await process_materials_background(
                study_plan_id=11,
                user_id=plan.user_id,
                text_content="Hello - Hola\nGoodbye - Adios\nThank you - Gracias\nPlease - Por favor\nYes - Si\nNo - No\nWater - Agua\nFood - Comida\nFriend - Amigo\nHouse - Casa",
                file_paths=None
            )
    
    # Check results
    with SessionLocal() as db:
        plan = db.query(StudyPlan).filter(StudyPlan.id == 11).first()
        if plan:
            print(f"\nAfter processing:")
            print(f"Plan 11: {plan.name}, Status: {plan.status}")
            print(f"Flashcards: {len(plan.flashcards)}")
            
            if len(plan.flashcards) > 0:
                print(f"\nFirst flashcard:")
                fc = plan.flashcards[0]
                print(f"  Front: {fc.front_text}")
                print(f"  Back: {fc.back_text}")
                print(f"  MCQs: {len(fc.mcq_questions)}")
                print(f"  Sentences: {len(fc.vocabulary_sentences)}")

if __name__ == "__main__":
    asyncio.run(main())
