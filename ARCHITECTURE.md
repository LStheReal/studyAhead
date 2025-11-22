# StudyAhead Architecture

## Project Structure

```
studyahead/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py        # Configuration settings
│   │   ├── database.py      # Database connection
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── auth.py          # Authentication utilities
│   │   ├── ai_service.py    # AI service abstraction
│   │   └── routers/         # API route handlers
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── study_plans.py
│   │       ├── materials.py
│   │       ├── flashcards.py
│   │       ├── tasks.py
│   │       ├── study_sessions.py
│   │       ├── analytics.py
│   │       └── test_results.py
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── contexts/        # React contexts
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── README.md
├── SETUP.md
└── ARCHITECTURE.md
```

## Backend Architecture

### Database Models

- **User**: User accounts with learning preferences
- **StudyPlan**: Study plans (complete test or flashcard set)
- **MaterialSummary**: AI-generated material analysis
- **Flashcard**: Individual flashcards with mastery tracking
- **VocabularySentence**: Example sentences for vocabulary cards
- **MCQQuestion**: Multiple choice questions
- **Task**: Scheduled study tasks
- **TestResult**: Test completion results
- **StudySession**: Daily study session tracking

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

#### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update user preferences

#### Study Plans
- `POST /api/study-plans/` - Create study plan
- `GET /api/study-plans/` - List all plans
- `GET /api/study-plans/{id}` - Get plan details
- `PUT /api/study-plans/{id}` - Update plan
- `DELETE /api/study-plans/{id}` - Delete plan
- `POST /api/study-plans/{id}/approve` - Approve and generate schedule

#### Materials
- `POST /api/materials/upload` - Upload materials
- `GET /api/materials/{study_plan_id}/summary` - Get material summary
- `GET /api/materials/{study_plan_id}/status` - Get processing status

#### Flashcards
- `GET /api/flashcards/study-plan/{plan_id}` - Get flashcards
- `POST /api/flashcards/study-plan/{plan_id}` - Create flashcard
- `PUT /api/flashcards/{id}` - Update flashcard
- `DELETE /api/flashcards/{id}` - Delete flashcard
- `POST /api/flashcards/{id}/update-mastery` - Update mastery level
- `POST /api/flashcards/{id}/generate-sentences` - Generate vocabulary sentences
- `POST /api/flashcards/{id}/generate-mcq` - Generate MCQ questions

#### Tasks
- `GET /api/tasks/study-plan/{plan_id}` - Get tasks for plan
- `GET /api/tasks/today` - Get today's tasks
- `GET /api/tasks/{id}` - Get task details
- `POST /api/tasks/{id}/complete` - Complete task

#### Analytics
- `GET /api/analytics/dashboard` - Get dashboard statistics

#### Test Results
- `POST /api/test-results/study-plan/{plan_id}` - Save test result
- `GET /api/test-results/study-plan/{plan_id}` - Get test results

### AI Service

The `AIService` class provides an abstraction layer for AI operations:

- `analyze_material()` - Analyze uploaded materials
- `generate_flashcards()` - Generate flashcards from material
- `generate_vocabulary_sentences()` - Generate example sentences
- `generate_mcq_questions()` - Generate multiple choice questions
- `generate_study_schedule()` - Generate adaptive study schedule
- `extract_text_from_image()` - Extract text from images
- `process_pdf_content()` - Process PDF content

Currently uses OpenAI, but can be swapped by changing the implementation.

## Frontend Architecture

### Components

- **Layout**: Main layout with bottom navigation
- **PrivateRoute**: Route protection wrapper

### Pages

- **Login/Register**: Authentication pages
- **Dashboard**: Home page with stats and today's tasks
- **Plans**: List of all study plans
- **StudyPlanDetail**: Detailed view of a study plan
- **CreateStudyPlan**: Multi-step plan creation workflow
- **Profile**: User profile and settings
- **StudyMode**: Study mode interface (currently implements Learn mode)

### Contexts

- **AuthContext**: User authentication state
- **ThemeContext**: Dark mode state

### Services

- **api.js**: Axios instance with authentication

## Data Flow

1. User creates study plan
2. User uploads materials (PDF, images, or text)
3. Backend processes materials in background:
   - Extracts text from files
   - Sends to AI for analysis
   - Generates material summary
   - Generates flashcards
4. User reviews and approves flashcards
5. Backend generates study schedule
6. User studies using various modes
7. Progress is tracked and updated
8. Schedule adapts based on performance

## Key Features

### Material Processing
- PDF text extraction using pdfplumber
- Image text extraction using OpenAI Vision
- HEIC image support via pillow-heif
- Background processing with status polling

### Study Modes
- **Learn**: Flashcard review with swipe gestures
- **Quiz**: Multiple choice questions (structure ready)
- **Match**: Matching game (structure ready)
- **Write**: Typing practice (structure ready)
- **Fill Gaps**: Fill-in-the-blank (structure ready)
- **Tests**: Short and long tests (structure ready)

### Progress Tracking
- Flashcard mastery levels (0-100)
- Task completion tracking
- Study streak calculation
- Test score tracking
- Adaptive scheduling

## Security

- JWT-based authentication
- Password hashing with bcrypt
- User data isolation (users can only access their own data)
- File upload size limits
- Input validation with Pydantic

## Scalability Considerations

- SQLAlchemy ORM allows easy database migration
- AI service abstraction allows provider swapping
- Background task processing for long operations
- File storage can be moved to cloud (S3, etc.)
- CORS configured for frontend domain

## Future Enhancements

- Complete implementation of all study modes
- Spaced repetition algorithm
- Social features (sharing plans)
- Export/import functionality
- Mobile app (React Native)
- Real-time collaboration
- Advanced analytics and insights

