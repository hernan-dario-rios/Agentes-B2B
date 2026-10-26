import os
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_chat_model(model_name: Optional[str] = None, temperature: float = 0.2):
    """
    Retorna una instancia de ChatGoogleGenerativeAI para interactuar con Gemini.
    Si no hay GEMINI_API_KEY configurada, advierte y permite fallback controlado para desarrollo local.
    """
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    target_model = model_name or settings.DEFAULT_FAST_MODEL
    
    if not api_key:
        logger.warning(
            "GEMINI_API_KEY no detectada. Las llamadas directas al LLM requerirán configurar la llave en .env"
        )
        return None

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=target_model,
            google_api_key=api_key,
            temperature=temperature
        )
    except Exception as e:
        logger.error(f"Error instanciando ChatGoogleGenerativeAI: {e}")
        return None
