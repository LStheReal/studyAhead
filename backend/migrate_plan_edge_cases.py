"""
Migration script to add plan_mode, error_type, and detected_languages columns to study_plans table.
"""
import sqlite3
import os

DB_PATH = "studyahead.db"

def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"Database file {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Migrating database for Plan Edge Cases...")
    
    # 1. Add plan_mode column
    cursor.execute("PRAGMA table_info(study_plans)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'plan_mode' not in columns:
        print("Adding plan_mode column...")
        cursor.execute("ALTER TABLE study_plans ADD COLUMN plan_mode VARCHAR DEFAULT 'full'")
        print("  plan_mode column added.")
    else:
        print("  plan_mode column already exists.")
    
    # 2. Add error_type column
    if 'error_type' not in columns:
        print("Adding error_type column...")
        cursor.execute("ALTER TABLE study_plans ADD COLUMN error_type VARCHAR")
        print("  error_type column added.")
    else:
        print("  error_type column already exists.")
    
    # 3. Add detected_languages column (JSON stored as TEXT)
    if 'detected_languages' not in columns:
        print("Adding detected_languages column...")
        cursor.execute("ALTER TABLE study_plans ADD COLUMN detected_languages TEXT")
        print("  detected_languages column added.")
    else:
        print("  detected_languages column already exists.")

    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    run_migration()
