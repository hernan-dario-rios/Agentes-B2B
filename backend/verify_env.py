"""
Script de diagnóstico y verificación de variables de entorno para INNOVAIT B2B Sales System.
Ejecutar en AWS o localmente para confirmar que todos los servicios y APIs están operativos.
Uso: python verify_env.py
"""

import os
import sys
from typing import Dict, Any

# Asegurar path de backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings

def test_gemini():
    print("\n1. Verificando GEMINI_API_KEY...")
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("AIzaSy..."):
        print("   [FALLO] GEMINI_API_KEY no está configurada o tiene el valor de ejemplo.")
        return False
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model=settings.DEFAULT_FAST_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.1
        )
        res = llm.invoke("Responde unicamente con la palabra: OK")
        if "OK" in res.content:
            print(f"   [OK] Conexión exitosa con Google Gemini ({settings.DEFAULT_FAST_MODEL}).")
            return True
        else:
            print(f"   [AVISO] Conectó pero la respuesta fue: {res.content}")
            return True
    except Exception as e:
        print(f"   [ERROR] Falló la llamada a Gemini: {e}")
        return False

def test_database():
    print("\n2. Verificando Conexión a Base de Datos (DATABASE_URL)...")
    db_url = settings.SYNC_DATABASE_URL or settings.DATABASE_URL
    print(f"   URL configurada: {db_url.split('@')[-1] if '@' in db_url else db_url}")
    try:
        import psycopg2
        # Extraer parámetros básicos o probar con sqlalchemy
        from sqlalchemy import create_engine, text
        engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            res = conn.execute(text("SELECT 1;")).fetchone()
            # Verificar pgvector
            vec_res = conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';")).fetchone()
            vec_status = "con extensión pgvector activa" if vec_res else "sin pgvector (requerida para RAG en producción)"
            print(f"   [OK] Conexión a PostgreSQL exitosa ({vec_status}).")
            return True
    except Exception as e:
        print(f"   [AVISO / FALLO] No se pudo conectar a la base de datos: {e}")
        print("   Nota: Si estás usando el repositorio en memoria para demos locales esto es esperado, pero para producción en AWS se requiere PostgreSQL.")
        return False

def test_enrichment():
    print("\n3. Verificando APIs de Enriquecimiento (Apollo & Hunter)...")
    apollo_ok = bool(settings.APOLLO_API_KEY and not settings.APOLLO_API_KEY.startswith("tu_"))
    hunter_ok = bool(settings.HUNTER_API_KEY and not settings.HUNTER_API_KEY.startswith("tu_"))

    if apollo_ok:
        print("   [OK] APOLLO_API_KEY detectada.")
    else:
        print("   [AVISO] APOLLO_API_KEY vacía. El Agente 1 usará heurísticas locales y Gemini para enriquecer.")

    if hunter_ok:
        print("   [OK] HUNTER_API_KEY detectada.")
    else:
        print("   [AVISO] HUNTER_API_KEY vacía. El Agente 1 generará correos corporativos inferidos.")
    return apollo_ok or hunter_ok

def test_cors_and_network():
    print("\n4. Verificando CORS y Entorno...")
    print(f"   ENVIRONMENT: {settings.ENVIRONMENT}")
    print(f"   CORS_ORIGINS: {settings.CORS_ORIGINS}")
    if "*" in settings.CORS_ORIGINS or any("localhost" not in orig for orig in settings.CORS_ORIGINS):
        print("   [OK] CORS configurado para admitir dominios en producción.")
    else:
        print("   [AVISO] CORS_ORIGINS solo tiene localhost. Agrega el dominio de tu frontend en AWS.")

def main():
    print("=" * 65)
    print(" INNOVAIT B2B SALES SYSTEM - DIAGNÓSTICO DE VARIABLES DE ENTORNO")
    print("=" * 65)
    
    test_gemini()
    test_database()
    test_enrichment()
    test_cors_and_network()
    
    print("\n" + "=" * 65)
    print(" Diagnóstico finalizado.")
    print("=" * 65)

if __name__ == "__main__":
    main()
