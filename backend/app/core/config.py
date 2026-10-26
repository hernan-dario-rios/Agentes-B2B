import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "INNOVAIT B2B Multi-Agent Sales System"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # LLM Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DEFAULT_FAST_MODEL: str = "gemini-2.5-flash"
    DEFAULT_REASONING_MODEL: str = "gemini-2.5-pro"
    
    # Enrichment APIs (Agente 1: Scraper & Enricher)
    APOLLO_API_KEY: str = os.getenv("APOLLO_API_KEY", "")
    HUNTER_API_KEY: str = os.getenv("HUNTER_API_KEY", "")
    LINKEDIN_PROXY_API_KEY: str = os.getenv("LINKEDIN_PROXY_API_KEY", "")
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://innovait_user:innovait_password@localhost:5432/innovait_sales"
    SYNC_DATABASE_URL: str = "postgresql://innovait_user:innovait_password@localhost:5432/innovait_sales"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )


settings = Settings()
