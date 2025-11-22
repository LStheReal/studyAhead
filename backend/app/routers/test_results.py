from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.auth import get_current_user
from app.models import User, StudyPlan, TestResult
from app.schemas import TestResultCreate, TestResultResponse

router = APIRouter()

@router.post("/study-plan/{plan_id}", response_model=TestResultResponse)
async def create_test_result(
    plan_id: int,
    result_data: TestResultCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save test results."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    test_result = TestResult(
        study_plan_id=plan_id,
        test_type=result_data.test_type,
        score=result_data.score,
        total_questions=result_data.total_questions,
        correct_answers=result_data.correct_answers,
        user_answers=result_data.user_answers,
        vocab_details=result_data.vocab_details,
        time_spent=result_data.time_spent
    )
    db.add(test_result)
    db.commit()
    db.refresh(test_result)
    
    return test_result

@router.get("/study-plan/{plan_id}", response_model=List[TestResultResponse])
async def get_test_results(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all test results for a study plan."""
    plan = db.query(StudyPlan).filter(
        StudyPlan.id == plan_id,
        StudyPlan.user_id == current_user.id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    
    results = db.query(TestResult).filter(
        TestResult.study_plan_id == plan_id
    ).order_by(TestResult.created_at.desc()).all()
    
    return results

