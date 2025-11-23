from app.database import SessionLocal
from app.models import StudyPlan, Flashcard, MCQQuestion, VocabularySentence

def verify_plan_content(plan_id):
    db = SessionLocal()
    try:
        plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
        if not plan:
            print(f"Plan {plan_id} not found")
            return

        print(f"Plan: {plan.name} (ID: {plan.id})")
        print(f"Flashcards: {len(plan.flashcards)}")
        
        mcq_count = 0
        sentence_count = 0
        
        for fc in plan.flashcards:
            mcqs = db.query(MCQQuestion).filter(MCQQuestion.flashcard_id == fc.id).all()
            sentences = db.query(VocabularySentence).filter(VocabularySentence.flashcard_id == fc.id).all()
            
            mcq_count += len(mcqs)
            sentence_count += len(sentences)
            
            if len(mcqs) != 3:
                print(f"Warning: Flashcard {fc.id} has {len(mcqs)} MCQs (expected 3)")
            if len(sentences) != 5:
                print(f"Warning: Flashcard {fc.id} has {len(sentences)} Sentences (expected 5)")
                
        print(f"Total MCQs: {mcq_count}")
        print(f"Total Sentences: {sentence_count}")
        
        if mcq_count > 0:
            print("\nSample MCQ:")
            mcq = db.query(MCQQuestion).filter(MCQQuestion.flashcard_id == plan.flashcards[0].id).first()
            print(f"Question: {mcq.question_text}")
            print(f"Options: {mcq.options}")
            print(f"Type: {mcq.question_type}")
            
        if sentence_count > 0:
            print("\nSample Sentence:")
            sent = db.query(VocabularySentence).filter(VocabularySentence.flashcard_id == plan.flashcards[0].id).first()
            print(f"Sentence: {sent.sentence_text}")
            
    finally:
        db.close()

if __name__ == "__main__":
    # Check the latest plan
    db = SessionLocal()
    latest_plan = db.query(StudyPlan).order_by(StudyPlan.id.desc()).first()
    db.close()
    
    if latest_plan:
        verify_plan_content(latest_plan.id)
    else:
        print("No plans found")
