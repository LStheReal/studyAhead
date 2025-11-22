from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, Flashcard, VocabularySentence, MCQQuestion
from app.schemas import FlashcardCreate, FlashcardResponse, FlashcardUpdate
from app.ai_service import ai_service

router = APIRouter()

@router.get("/study-plan/{plan_id}", response_model=List[FlashcardResponse])
async def get_flashcards(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all flashcards for a study plan."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    return plan.flashcards

@router.post("/study-plan/{plan_id}", response_model=FlashcardResponse)
async def create_flashcard(
    plan_id: int,
    flashcard_data: FlashcardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new flashcard manually."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    flashcard = Flashcard(
        study_plan_id=plan_id,
        front_text=flashcard_data.front_text,
        back_text=flashcard_data.back_text,
        difficulty=flashcard_data.difficulty
    )
    db.add(flashcard)
    db.commit()
    db.refresh(flashcard)
    
    return flashcard

@router.put("/{flashcard_id}", response_model=FlashcardResponse)
async def update_flashcard(
    flashcard_id: int,
    flashcard_update: FlashcardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a flashcard."""
    flashcard = db.query(Flashcard).join(StudyPlan).filter(
        Flashcard.id == flashcard_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    update_data = flashcard_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(flashcard, field, value)
    
    db.commit()
    db.refresh(flashcard)
    return flashcard

@router.delete("/{flashcard_id}")
async def delete_flashcard(
    flashcard_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a flashcard."""
    flashcard = db.query(Flashcard).join(StudyPlan).filter(
        Flashcard.id == flashcard_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    db.delete(flashcard)
    db.commit()
    return {"message": "Flashcard deleted"}

@router.post("/{flashcard_id}/generate-sentences")
async def generate_vocabulary_sentences(
    flashcard_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate example sentences for vocabulary flashcards."""
    flashcard = db.query(Flashcard).join(StudyPlan).filter(
        Flashcard.id == flashcard_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    if flashcard.study_plan.category != "vocabulary":
        raise HTTPException(status_code=400, detail="Sentences only available for vocabulary")
    
    # Generate sentences
    sentences_data = ai_service.generate_vocabulary_sentences(
        flashcard.front_text,
        flashcard.back_text
    )
    
    # Delete existing sentences
    db.query(VocabularySentence).filter(
        VocabularySentence.flashcard_id == flashcard_id
    ).delete()
    
    # Create new sentences
    for sent_data in sentences_data:
        sentence = VocabularySentence(
            flashcard_id=flashcard_id,
            sentence_text=sent_data.get("sentence_text", ""),
            highlighted_words=sent_data.get("highlighted_words", [])
        )
        db.add(sentence)
    
    db.commit()
    return {"message": "Sentences generated", "count": len(sentences_data)}

@router.post("/{flashcard_id}/generate-mcq")
async def generate_mcq_questions(
    flashcard_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate MCQ questions for a flashcard."""
    flashcard = db.query(Flashcard).join(StudyPlan).filter(
        Flashcard.id == flashcard_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    # Generate MCQs
    questions_data = ai_service.generate_mcq_questions(
        {"front_text": flashcard.front_text, "back_text": flashcard.back_text},
        flashcard.study_plan.question_language or "English",
        flashcard.study_plan.answer_language or "English"
    )
    
    # Delete existing questions
    db.query(MCQQuestion).filter(
        MCQQuestion.flashcard_id == flashcard_id
    ).delete()
    
    # Create new questions
    for q_data in questions_data:
        question = MCQQuestion(
            flashcard_id=flashcard_id,
            question_text=q_data.get("question_text", ""),
            options=q_data.get("options", []),
            correct_answer_index=q_data.get("correct_answer_index", 0),
            rationale=q_data.get("rationale"),
            question_type=q_data.get("question_type", "standard")
        )
        db.add(question)
    
    db.commit()
    return {"message": "MCQ questions generated", "count": len(questions_data)}

@router.post("/{flashcard_id}/update-mastery")
async def update_flashcard_mastery(
    flashcard_id: int,
    mastery_level: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update flashcard mastery level after study session."""
    flashcard = db.query(Flashcard).join(StudyPlan).filter(
        Flashcard.id == flashcard_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    flashcard.mastery_level = max(0, min(100, mastery_level))
    flashcard.times_studied += 1
    from datetime import datetime
    flashcard.last_studied = datetime.utcnow()
    
    db.commit()
    return {"message": "Mastery updated"}

