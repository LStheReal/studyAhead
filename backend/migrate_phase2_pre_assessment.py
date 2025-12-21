import sqlite3
import os

# Database path - using the one confirmed in previous steps
DB_PATH = "backend/studyahead.db"

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"Database file {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Migrating database for Pre-Assessment System...")
    
    # 1. Create pre_assessments table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pre_assessments'")
    if cursor.fetchone():
        print("Table pre_assessments already exists.")
    else:
        print("Creating table pre_assessments...")
        cursor.execute('''
            CREATE TABLE pre_assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                study_plan_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                total_questions INTEGER DEFAULT 0,
                correct_score FLOAT DEFAULT 0.0,
                questions_data JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (study_plan_id) REFERENCES study_plans(id)
            )
        ''')
        print("Table pre_assessments created.")

    # 2. Create pre_assessment_responses table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pre_assessment_responses'")
    if cursor.fetchone():
        print("Table pre_assessment_responses already exists.")
    else:
        print("Creating table pre_assessment_responses...")
        cursor.execute('''
            CREATE TABLE pre_assessment_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pre_assessment_id INTEGER NOT NULL,
                flashcard_id INTEGER NOT NULL,
                is_correct BOOLEAN NOT NULL,
                response_time_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pre_assessment_id) REFERENCES pre_assessments(id),
                FOREIGN KEY (flashcard_id) REFERENCES flashcards(id)
            )
        ''')
        print("Table pre_assessment_responses created.")

    conn.commit()
    conn.close()
    print("Pre-Assessment migration completed successfully.")

if __name__ == "__main__":
    run_migration()
