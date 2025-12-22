from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models import LearningSpeed, StudyPlanType, MaterialCategory, StudyPlanStatus, TaskType, StudyMode

# User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class OnboardingData(BaseModel):
    learning_speed: LearningSpeed
    preferred_study_modes: List[str]
    favorite_subjects: List[str]
    school_language: str
    study_hours_per_week: int
    study_time_preference: str

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    profile_image: Optional[str]
    learning_speed: LearningSpeed
    study_hours_per_week: int
    preferred_study_modes: List[str]
    onboarding_completed: bool
    
    favorite_subjects: List[str] = []
    school_language: str = "English"
    study_time_preference: Optional[str] = None
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    learning_speed: Optional[LearningSpeed] = None
    study_hours_per_week: Optional[int] = None
    preferred_study_modes: Optional[List[str]] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Study Plan Schemas
class StudyPlanCreate(BaseModel):
    name: str
    type: StudyPlanType
    exam_date: Optional[datetime] = None
    learning_objectives: Optional[str] = None
    question_language: Optional[str] = None
    answer_language: Optional[str] = None
    category: Optional[str] = "vocabulary"  # Default to vocabulary
    plan_mode: Optional[str] = "full"  # "full" or "simple"

class StudyPlanResponse(BaseModel):
    id: int
    name: str
    type: StudyPlanType
    category: Optional[MaterialCategory]
    exam_date: Optional[datetime]
    learning_objectives: Optional[str]
    question_language: Optional[str]
    answer_language: Optional[str]
    status: StudyPlanStatus
    plan_mode: Optional[str] = "full"  # "full" or "simple"
    error_type: Optional[str] = None
    detected_languages: Optional[List[str]] = None
    progress_percentage: float
    tasks_total: int
    tasks_completed: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Material Schemas
class MaterialUpload(BaseModel):
    study_plan_id: int
    text_content: Optional[str] = None

class MaterialSummaryResponse(BaseModel):
    id: int
    title: str
    category: MaterialCategory
    main_topics: List[str]
    learning_goals: List[str]
    recommended_study_approach: Optional[str]
    checklist_items: List[str]
    content_structure: Optional[Dict[str, Any]]
    difficulty_assessment: Optional[str]
    
    class Config:
        from_attributes = True

# Flashcard Schemas
class FlashcardCreate(BaseModel):
    front_text: str
    back_text: str
    difficulty: Optional[str] = "medium"

class FlashcardResponse(BaseModel):
    id: int
    front_text: str
    back_text: str
    difficulty: str
    mastery_level: float
    times_studied: int
    
    class Config:
        from_attributes = True

class FlashcardUpdate(BaseModel):
    front_text: Optional[str] = None
    back_text: Optional[str] = None
    difficulty: Optional[str] = None

class MCQQuestionResponse(BaseModel):
    id: int
    flashcard_id: int
    question_text: str
    options: List[str]
    correct_answer_index: int
    rationale: Optional[str]
    question_type: str
    
    class Config:
        from_attributes = True

class FlashcardWithQuestions(FlashcardResponse):
    mcq_questions: List[MCQQuestionResponse] = []
    
    class Config:
        from_attributes = True

# Task Schemas
class TaskResponse(BaseModel):
    id: int
    study_plan_id: int
    title: str
    description: Optional[str]
    type: TaskType
    mode: StudyMode
    estimated_minutes: int
    day_number: Optional[int]
    rationale: Optional[str]
    completion_status: bool
    scheduled_date: Optional[datetime]
    order: int
    
    class Config:
        from_attributes = True

class TaskComplete(BaseModel):
    time_spent: Optional[int] = None
    results: Optional[Dict[str, Any]] = None

# Study Session Schemas
class StudySessionCreate(BaseModel):
    tasks_completed: int

class StudySessionResponse(BaseModel):
    id: int
    date: datetime
    tasks_available: int
    tasks_completed: int
    is_complete_day: bool
    
    class Config:
        from_attributes = True

# Test Result Schemas
class TestResultCreate(BaseModel):
    test_type: str
    score: float
    total_questions: int
    correct_answers: int
    user_answers: Optional[Dict[str, Any]] = None
    vocab_details: Optional[Dict[str, Any]] = None
    time_spent: Optional[int] = None

class TestResultResponse(BaseModel):
    id: int
    test_type: str
    score: float
    total_questions: int
    correct_answers: int
    time_spent: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Analytics Schemas
class DashboardStats(BaseModel):
    total_study_plans: int
    average_test_score: float
    overall_progress: float
    study_streak: int
    tests_rocked: int
    active_study_plan: Optional[StudyPlanResponse]
    today_tasks: List[TaskResponse]
    upcoming_exams: List[StudyPlanResponse]
    learning_efficiency: float = 1.0
    subject_strengths: Dict[str, float] = {}

# Pre-Assessment Schemas
class PreAssessmentCreate(BaseModel):
    study_plan_id: int

class PreAssessmentResponseSubmit(BaseModel):
    flashcard_id: int
    is_correct: bool
    response_time_ms: int

class PreAssessmentSubmit(BaseModel):
    responses: List[PreAssessmentResponseSubmit]

class PreAssessmentResponseModel(BaseModel):
    id: int
    total_questions: int
    status: str
    questions_data: Optional[List[Dict[str, Any]]]
    
    class Config:
        from_attributes = True

# Tracking Schemas
class TrackingLog(BaseModel):
    study_plan_id: int
    mode: str
    flashcard_id: Optional[int]
    is_correct: bool
    response_time_ms: int
    attempts_needed: int = 1

class TrackingResponse(BaseModel):
    status: str = "logged"

