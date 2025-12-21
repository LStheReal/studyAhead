import sqlite3
import os

DB_PATH = "backend/studyahead.db"

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"Database file {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Migrating database for Phase 4: Tracking...")
    
    # Create study_session_tracking table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='study_session_tracking'")
    if cursor.fetchone():
        print("Table study_session_tracking already exists.")
    else:
        print("Creating table study_session_tracking...")
        cursor.execute('''
            CREATE TABLE study_session_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                study_plan_id INTEGER NOT NULL,
                mode VARCHAR(50) NOT NULL,
                flashcard_id INTEGER,
                is_correct BOOLEAN,
                response_time_ms INTEGER,
                attempts_needed INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (study_plan_id) REFERENCES study_plans(id),
                FOREIGN KEY (flashcard_id) REFERENCES flashcards(id)
            )
        ''')
        print("Table study_session_tracking created.")

    conn.commit()
    conn.close()
    print("Tracking migration completed successfully.")

if __name__ == "__main__":
    run_migration()
