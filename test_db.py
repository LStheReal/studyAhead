from backend.app.database import SessionLocal
from backend.app.models import User
import sys

print("Attempting to connect to DB...")
try:
    db = SessionLocal()
    user_count = db.query(User).count()
    print(f"Success! Found {user_count} users.")
    db.close()
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
