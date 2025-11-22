# StudyAhead Setup Guide

## Prerequisites

- Python 3.9+
- Node.js 18+
- OpenAI API key

## Backend Setup

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

4. Create `.env` file:
```bash
cp .env.example .env
```

5. Edit `.env` and add your configuration:
```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview
SECRET_KEY=your-secret-key-change-in-production-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_URL=sqlite:///./studyahead.db
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIR=./uploads
```

6. Create uploads directory:
```bash
mkdir -p uploads
```

7. Start the server:
```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional, defaults to localhost):
```env
VITE_API_URL=http://localhost:8000/api
```

4. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## First Run

1. Start both backend and frontend servers
2. Open the app in your browser
3. Register a new account
4. Create your first study plan
5. Upload materials (PDF, images, or paste text)
6. Wait for AI processing
7. Review and approve flashcards
8. Start studying!

## Changing AI Provider

The AI service is abstracted in `backend/app/ai_service.py`. To change providers:

1. Update the `AIService` class initialization
2. Modify the API calls to match your provider's SDK
3. Update environment variables in `.env`
4. The rest of the application will work without changes

## Database Migration

The app uses SQLite by default. To migrate to PostgreSQL:

1. Update `DATABASE_URL` in `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost/studyahead
```

2. Install PostgreSQL adapter:
```bash
pip install psycopg2-binary
```

3. The SQLAlchemy ORM will handle the migration automatically

## Production Deployment

### Backend
- Use a production ASGI server like Gunicorn with Uvicorn workers
- Set up proper environment variables
- Use a production database (PostgreSQL recommended)
- Configure CORS for your frontend domain
- Set up file storage (S3, Cloudinary, etc.) for uploads

### Frontend
- Build for production: `npm run build`
- Deploy the `dist` folder to a static host (GitHub Pages, Netlify, Vercel)
- Update API URL in environment variables
- Configure PWA settings in `vite.config.js`

## Troubleshooting

### Backend Issues
- **Import errors**: Make sure virtual environment is activated
- **Database errors**: Check database file permissions
- **OpenAI errors**: Verify API key is correct and has credits
- **File upload errors**: Check upload directory exists and is writable

### Frontend Issues
- **API connection errors**: Check backend is running and CORS is configured
- **Build errors**: Clear `node_modules` and reinstall
- **PWA not working**: Check service worker registration in browser console

## Features Implemented

✅ User authentication (JWT)
✅ Study plan creation
✅ Material upload (PDF, images, text)
✅ AI-powered material analysis
✅ Flashcard generation
✅ Study schedule generation
✅ Multiple study modes (Learn, Quiz, Match, Write, Fill Gaps, Tests)
✅ Progress tracking
✅ Dashboard with statistics
✅ Profile management
✅ Dark mode support
✅ PWA support

## Next Steps

- Add more study modes (matching game, writing practice, etc.)
- Implement test mode with multiple question types
- Add social features (sharing study plans)
- Implement spaced repetition algorithm
- Add export/import functionality
- Add more AI model options

