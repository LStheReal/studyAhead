import sys
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import VocabularySentence
from app.database import Base

# Setup DB connection
SQLALCHEMY_DATABASE_URL = "sqlite:///./studyahead.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Fetch all sentences for plan 5 (via flashcards)
    # Since we know the IDs are 1296, 1297, 1298 (from previous output)
    sentences = db.query(VocabularySentence).filter(VocabularySentence.id.in_([1296, 1297, 1298])).all()
    
    print(f"Found {len(sentences)} sentences")
    
    for sent in sentences:
        print(f"Processing sentence {sent.id}: {sent.highlighted_words} (type: {type(sent.highlighted_words)})")
        
        # If it's a string, parse it
        if isinstance(sent.highlighted_words, str):
            try:
                parsed = json.loads(sent.highlighted_words)
                sent.highlighted_words = parsed
                print(f"  Fixed: {parsed} (type: {type(parsed)})")
            except json.JSONDecodeError as e:
                print(f"  Failed to parse JSON: {e}")
        elif sent.highlighted_words is None:
             print("  None, skipping")
        else:
            print("  Already correct type")
            
    db.commit()
    print("Committed changes")
    
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
finally:
    db.close()
