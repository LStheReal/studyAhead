import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "StudyAhead"
    PROJECT_VERSION: str = "1.0.0"
    
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "studyahead")
    
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    
    # Mock AI Configuration
    # Always default to True as requested to unblock usage
    USE_MOCK_AI: bool = os.getenv("USE_MOCK_AI", "True").lower() == "true"

    @property
    def database_url(self) -> str:
        return os.getenv("DATABASE_URL", "sqlite:///./studyahead.db")

    @property
    def upload_dir(self) -> str:
        return os.getenv("UPLOAD_DIR", "./uploads")

settings = Settings()
