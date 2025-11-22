# StudyAhead - AI-Powered Study Companion

A mobile-first Progressive Web App (PWA) that helps students create personalized study plans, manage learning materials, and track progress toward exams.

## Tech Stack

- **Frontend**: React + Vite (PWA)
- **Backend**: FastAPI (Python)
- **Database**: SQLite (with SQLAlchemy ORM, easily migratable to PostgreSQL)
- **AI**: OpenAI (configurable API key)
- **Authentication**: JWT-based email/password

## Project Structure

```
studyahead/
├── backend/          # FastAPI backend
├── frontend/         # React frontend
├── README.md
└── .gitignore
```

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set environment variables:
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

5. Run migrations:
```bash
python -m alembic upgrade head
```

6. Start the server:
```bash
uvicorn main:app --reload
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

## Features

- User authentication and profile management
- AI-powered study plan creation
- Multiple study modes (Flashcards, Quiz, Matching, Writing, Fill Gaps, Tests)
- Progress tracking and analytics
- Adaptive learning with spaced repetition
- Material upload (PDF, images, text)
- Background AI processing with status updates

