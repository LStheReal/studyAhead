"""Test full generation flow with a fresh plan."""
import asyncio
import sys
sys.path.insert(0, '/Users/louiseschule/Documents/studyahead/backend')

from app.routers.materials import process_materials_background

async def main():
    print("Testing full generation flow with plan 11...")
    
    # Test with plan 11 (Vocabulary Test)
    await process_materials_background(
        study_plan_id=11,
        user_id=1,
        text_content="Hello - Hola\nGoodbye - Adios\nThank you - Gracias\nPlease - Por favor\nYes - Si\nNo - No\nWater - Agua\nFood - Comida\nFriend - Amigo\nHouse - Casa",
        file_paths=None
    )
    
    # Check results
    from app.database import SessionLocal
    from app.models import StudyPlan
    
    with SessionLocal() as db:
        plan = db.query(StudyPlan).filter(StudyPlan.id == 11).first()
        if plan:
            print(f"\n=== Results ===")
            print(f"Plan: {plan.name}")
            print(f"Status: {plan.status}")
            print(f"Category: {plan.category}")
            print(f"Flashcards: {len(plan.flashcards)}")
            
            if len(plan.flashcards) > 0:
                fc = plan.flashcards[0]
                print(f"\nSample flashcard:")
                print(f"  Front: {fc.front_text}")
                print(f"  Back: {fc.back_text}")
                print(f"  MCQs: {len(fc.mcq_questions)}")
                print(f"  Sentences: {len(fc.vocabulary_sentences)}")
                
                if len(fc.mcq_questions) > 0:
                    mcq = fc.mcq_questions[0]
                    print(f"\nSample MCQ:")
                    print(f"  Question: {mcq.question_text}")
                    print(f"  Options: {mcq.options}")
                    print(f"  Correct: {mcq.correct_answer_index}")
                
                if len(fc.vocabulary_sentences) > 0:
                    sent = fc.vocabulary_sentences[0]
                    print(f"\nSample sentence:")
                    print(f"  {sent.sentence_text}")

if __name__ == "__main__":
    asyncio.run(main())
