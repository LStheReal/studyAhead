from app.database import SessionLocal
from app.models import User
from sqlalchemy import text
import sys
import os

# Add parent directory to path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def reset_db():
    print("Resetting database...")
    db = SessionLocal()
    try:
        # Delete all users (cascading removes plans, flashcards, etc.)
        num_users = db.query(User).delete()
        db.commit()
        print(f"Deleted {num_users} users and their associated data.")
        
        # Verify empty
        remaining_users = db.query(User).count()
        print(f"Remaining users: {remaining_users}")
        
    except Exception as e:
        print(f"Error resetting DB: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_db()
