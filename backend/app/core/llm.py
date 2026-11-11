import os
import logging
import concurrent.futures
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiDirectWrapper:
    """Wrapper compatible con .invoke() para el SDK oficial de Google GenAI con protección de timeout"""
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash", temperature: float = 0.2):
        self.api_key = api_key
        self.model_name = model_name
        self.temperature = temperature
        try:
            from google import genai
            self.client = genai.Client(api_key=api_key)
            self._mode = "genai"
        except Exception:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=api_key)
            self.model = genai_legacy.GenerativeModel(model_name)
            self._mode = "legacy"

    def invoke(self, prompt: str, timeout: float = 3.0):
        class InvocationResult:
            def __init__(self, content: str):
                self.content = content

        def _call():
            if self._mode == "genai":
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                return InvocationResult(response.text or "")
            else:
                response = self.model.generate_content(prompt)
                return InvocationResult(response.text or "")

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call)
            try:
                return future.result(timeout=timeout)
            except concurrent.futures.TimeoutError:
                logger.warning(f"[GeminiDirectWrapper] Invocación superó timeout de {timeout}s")
                raise TimeoutError("Timeout en llamada a Gemini")
            except Exception as e:
                logger.error(f"[GeminiDirectWrapper] Error invocando modelo: {e}")
                raise e


def get_chat_model(model_name: Optional[str] = None, temperature: float = 0.2):
    """
    Retorna una instancia de modelo para interactuar con Gemini.
    Soporta langchain_google_genai o el SDK oficial google-genai / google-generativeai.
    """
    api_key = (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")).strip().strip('"').strip("'")
    target_model = model_name or settings.DEFAULT_FAST_MODEL
    
    if not api_key:
        logger.info("GEMINI_API_KEY no configurada. Utilizando motor conversacional nativo.")
        return None

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=target_model,
            google_api_key=api_key,
            temperature=temperature
        )
    except Exception:
        try:
            return GeminiDirectWrapper(
                api_key=api_key,
                model_name=target_model,
                temperature=temperature
            )
        except Exception as e2:
            logger.error(f"Error instanciando GeminiDirectWrapper: {e2}")
            return None
