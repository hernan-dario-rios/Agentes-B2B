import os
import json
from typing import List, Union, Any
from pydantic import field_validator
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
    CORS_ORIGINS: Any = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, list):
            return [str(x).strip() for x in v]
        if isinstance(v, str):
            v = v.strip()
            # Eliminar posibles comillas externas accidentales de bash/sed
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1].strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed]
                except Exception:
                    pass
            if "," in v:
                return [x.strip() for x in v.split(",") if x.strip()]
            if v:
                return [v]
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../backend/.env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )


settings = Settings()
