import sqlite3
import os

# Database path - assuming default from typical fastapi setups, likely in root or backend folder
# Adjust based on user's workspace
DB_PATH = "backend/studyahead.db" # Updated path found via find

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"Database file {DB_PATH} not found. Migration skipped (fresh install will handle it).")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Migrating database for Adaptive Learning System...")
    
    # 1. Add columns to users table
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN favorite_subjects JSON DEFAULT '[]'")
        print("Added favorite_subjects to users")
    except sqlite3.OperationalError as e:
        print(f"Skipping favorite_subjects (probably exists): {e}")

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN school_language VARCHAR(50) DEFAULT 'English'")
        print("Added school_language to users")
    except sqlite3.OperationalError as e:
        print(f"Skipping school_language: {e}")

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN study_time_preference VARCHAR(20)")
        print("Added study_time_preference to users")
    except sqlite3.OperationalError as e:
        print(f"Skipping study_time_preference: {e}")

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT 0")
        print("Added onboarding_completed to users")
    except sqlite3.OperationalError as e:
        print(f"Skipping onboarding_completed: {e}")

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN onboarding_date DATETIME")
        print("Added onboarding_date to users")
    except sqlite3.OperationalError as e:
        print(f"Skipping onboarding_date: {e}")

    # 2. Create user_learning_profiles table
    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_learning_profiles'")
    if cursor.fetchone():
        print("Table user_learning_profiles already exists.")
    else:
        print("Creating table user_learning_profiles...")
        cursor.execute('''
            CREATE TABLE user_learning_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                self_reported_speed VARCHAR(20),
                subject_learning_speeds JSON DEFAULT '{}',
                calculated_global_speed FLOAT DEFAULT 2.5,
                completed_plans_count INTEGER DEFAULT 0,
                average_pre_assessment_score FLOAT DEFAULT 0.0,
                average_final_score FLOAT DEFAULT 0.0,
                learning_efficiency_factor FLOAT DEFAULT 1.0,
                mode_performance JSON DEFAULT '{}',
                subject_strengths JSON DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        print("Table created.")

    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
