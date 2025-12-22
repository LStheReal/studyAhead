from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from app.database import Base

class LearningSpeed(str, enum.Enum):
    SLOW = "slow"
    MODERATE = "moderate"
    FAST = "fast"

class StudyPlanType(str, enum.Enum):
    COMPLETE_TEST = "complete_test"
    FLASHCARD_SET = "flashcard_set"

class MaterialCategory(str, enum.Enum):
    VOCABULARY = "vocabulary"
    GRAMMAR_MATH_LOGIC = "grammar_math_logic"
    FACTS = "facts"
    OTHER = "other"

class StudyPlanStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    GENERATING = "generating"
    AWAITING_APPROVAL = "awaiting_approval"

class TaskType(str, enum.Enum):
    FLASHCARD_REVIEW = "flashcard_review"
    MULTIPLE_CHOICE_QUIZ = "multiple_choice_quiz"
    MATCHING_GAME = "matching_game"
    WRITING_PRACTICE = "writing_practice"
    FILL_THE_GAP = "fill_the_gap"
    SHORT_TEST = "short_test"
    COMPREHENSIVE_TEST = "comprehensive_test"
    PRE_ASSESSMENT = "pre_assessment"

class StudyMode(str, enum.Enum):
    LEARN = "learn"
    QUIZ = "quiz"
    MATCH = "match"
    WRITE = "write"
    FILL_GAPS = "fill_gaps"
    SHORT_TEST = "short_test"
    LONG_TEST = "long_test"
    PRE_ASSESSMENT = "pre_assessment"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    profile_image = Column(String, nullable=True)
    
    # Learning preferences
    learning_speed = Column(SQLEnum(LearningSpeed), default=LearningSpeed.MODERATE)
    study_hours_per_week = Column(Integer, default=10)
    preferred_study_modes = Column(JSON, default=list)  # List of study modes
    
    # Adaptive Learning Fields
    favorite_subjects = Column(JSON, default=list) # Array of strings
    school_language = Column(String, default="English")
    study_time_preference = Column(String, nullable=True) # morning, afternoon, evening, night
    onboarding_completed = Column(Boolean, default=False)
    onboarding_date = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    study_plans = relationship("StudyPlan", back_populates="user", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
    learning_profile = relationship("UserLearningProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")

class StudyPlan(Base):
    __tablename__ = "study_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(SQLEnum(StudyPlanType), nullable=False)
    category = Column(SQLEnum(MaterialCategory), nullable=True)
    
    exam_date = Column(DateTime(timezone=True), nullable=True)
    learning_objectives = Column(Text, nullable=True)
    
    # Language settings for vocabulary
    question_language = Column(String, nullable=True)
    answer_language = Column(String, nullable=True)
    
    status = Column(SQLEnum(StudyPlanStatus), default=StudyPlanStatus.GENERATING)
    progress_percentage_static = Column("progress_percentage", Float, default=0.0)
    current_step = Column(String, nullable=True)
    
    tasks_total_static = Column("tasks_total", Integer, default=0)
    tasks_completed_static = Column("tasks_completed", Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    @property
    def tasks_total(self):
        return len(self.tasks)

    @property
    def tasks_completed(self):
        return len([t for t in self.tasks if t.completion_status])

    @property
    def progress_percentage(self):
        total = self.tasks_total
        if total == 0:
            return 0.0
        return (self.tasks_completed / total) * 100

    user = relationship("User", back_populates="study_plans")
    material_summary = relationship("MaterialSummary", back_populates="study_plan", uselist=False, cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="study_plan", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="study_plan", cascade="all, delete-orphan", lazy="select")
    test_results = relationship("TestResult", back_populates="study_plan", cascade="all, delete-orphan")
    pre_assessment = relationship("PreAssessment", back_populates="study_plan", uselist=False, cascade="all, delete-orphan")

class MaterialSummary(Base):
    __tablename__ = "material_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False, unique=True)
    title = Column(String, nullable=False)
    category = Column(SQLEnum(MaterialCategory), nullable=False)
    
    main_topics = Column(JSON, default=list)  # Array of strings
    learning_goals = Column(JSON, default=list)  # Array of strings
    recommended_study_approach = Column(Text, nullable=True)
    checklist_items = Column(JSON, default=list)  # Array of strings
    content_structure = Column(JSON, nullable=True)  # Hierarchical JSON
    difficulty_assessment = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    study_plan = relationship("StudyPlan", back_populates="material_summary")
    flashcards = relationship("Flashcard", back_populates="material_summary", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(Integer, primary_key=True, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False)
    material_summary_id = Column(Integer, ForeignKey("material_summaries.id"), nullable=True)
    
    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    difficulty = Column(String, default="medium")  # easy, medium, hard
    
    mastery_level = Column(Float, default=0.0)  # 0-100
    times_studied = Column(Integer, default=0)
    last_studied = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    study_plan = relationship("StudyPlan", back_populates="flashcards")
    material_summary = relationship("MaterialSummary", back_populates="flashcards")
    vocabulary_sentences = relationship("VocabularySentence", back_populates="flashcard", cascade="all, delete-orphan")
    mcq_questions = relationship("MCQQuestion", back_populates="flashcard", cascade="all, delete-orphan")

class VocabularySentence(Base):
    __tablename__ = "vocabulary_sentences"
    
    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), nullable=False)
    sentence_text = Column(Text, nullable=False)
    highlighted_words = Column(JSON, nullable=True)  # Array of {word, start_index, end_index}
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    flashcard = relationship("Flashcard", back_populates="vocabulary_sentences")

class MCQQuestion(Base):
    __tablename__ = "mcq_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # Array of 4 strings
    correct_answer_index = Column(Integer, nullable=False)  # 0-3
    rationale = Column(Text, nullable=True)
    question_type = Column(String, nullable=True)  # standard, reverse, creative
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    flashcard = relationship("Flashcard", back_populates="mcq_questions")

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False)
    
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(SQLEnum(TaskType), nullable=False)
    mode = Column(SQLEnum(StudyMode), nullable=False)
    
    priority = Column(Integer, default=0)
    estimated_minutes = Column(Integer, default=20)
    
    day_number = Column(Integer, nullable=True)
    rationale = Column(Text, nullable=True)
    
    completion_status = Column(Boolean, default=False)
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    study_plan = relationship("StudyPlan", back_populates="tasks")

class TestResult(Base):
    __tablename__ = "test_results"
    
    id = Column(Integer, primary_key=True, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False)
    test_type = Column(String, nullable=False)  # short_test, long_test
    
    score = Column(Float, nullable=False)  # Percentage
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, nullable=False)
    
    user_answers = Column(JSON, nullable=True)  # Detailed answer data
    vocab_details = Column(JSON, nullable=True)  # Per-flashcard results
    time_spent = Column(Integer, nullable=True)  # Seconds
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    study_plan = relationship("StudyPlan", back_populates="test_results")

class StudySession(Base):
    __tablename__ = "study_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    
    tasks_available = Column(Integer, default=0)
    tasks_completed = Column(Integer, default=0)
    is_complete_day = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="study_sessions")

class UserLearningProfile(Base):
    __tablename__ = "user_learning_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Initial self-reported data
    self_reported_speed = Column(SQLEnum(LearningSpeed), nullable=True)
    
    # Calculated learning speeds per subject
    subject_learning_speeds = Column(JSON, default=dict)  # {"vocabulary": 2.5, "math": 2.0, ...}
    
    # Global calculated learning speed (average across all plans)
    calculated_global_speed = Column(Float, default=2.5)
    
    # Performance history
    completed_plans_count = Column(Integer, default=0)
    average_pre_assessment_score = Column(Float, default=0.0)
    average_final_score = Column(Float, default=0.0)
    
    # Learning efficiency (how much faster/slower than predicted)
    learning_efficiency_factor = Column(Float, default=1.0)
    
    # Mode preferences (updated based on performance)
    mode_performance = Column(JSON, default=dict)  # {"quiz": 0.85, "flashcards": 0.78, ...}
    
    # Subject strengths (0-1 scale)
    subject_strengths = Column(JSON, default=dict)  # {"vocabulary": 0.8, "math": 0.6, ...}
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="learning_profile")

class PreAssessment(Base):
    __tablename__ = "pre_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False)
    
    status = Column(String, default="pending") # pending, completed
    total_questions = Column(Integer, default=0)
    correct_score = Column(Float, default=0.0)
    
    # Store the generated questions snapshot
    questions_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    study_plan = relationship("StudyPlan", back_populates="pre_assessment")
    responses = relationship("PreAssessmentResponse", back_populates="pre_assessment", cascade="all, delete-orphan")

class PreAssessmentResponse(Base):
    __tablename__ = "pre_assessment_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    pre_assessment_id = Column(Integer, ForeignKey("pre_assessments.id"), nullable=False)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), nullable=False)
    
    is_correct = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    pre_assessment = relationship("PreAssessment", back_populates="responses")
    flashcard = relationship("Flashcard")

class StudySessionTracking(Base):
    __tablename__ = "study_session_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    study_plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False)
    
    mode = Column(String, nullable=False) # quiz, learn, write, etc.
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), nullable=True)
    
    is_correct = Column(Boolean, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    attempts_needed = Column(Integer, default=1)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
    study_plan = relationship("StudyPlan")
    flashcard = relationship("Flashcard")

