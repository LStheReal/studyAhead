from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from app.database import engine, Base
from app.routers import auth, users, study_plans, materials, flashcards, tasks, study_sessions, analytics, test_results, pre_assessment, adaptive_learning, tracking

# Create uploads directory
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="StudyAhead API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],  # Add production URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Expose all headers
)

# Add exception handler to ensure CORS headers are included in error responses
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        }
    )

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(study_plans.router, prefix="/api/study-plans", tags=["study-plans"])
app.include_router(materials.router, prefix="/api/materials", tags=["materials"])
app.include_router(flashcards.router, prefix="/api/flashcards", tags=["flashcards"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(study_sessions.router, prefix="/api/study-sessions", tags=["study-sessions"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(pre_assessment.router, prefix="/api/pre-assessment", tags=["pre-assessment"])
app.include_router(adaptive_learning.router, prefix="/api/adaptive", tags=["adaptive"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["tracking"])
app.include_router(test_results.router, prefix="/api/test-results", tags=["test-results"])

@app.get("/")
async def root():
    return {"message": "StudyAhead API", "version": "1.0.0"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

