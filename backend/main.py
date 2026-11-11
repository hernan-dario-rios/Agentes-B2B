import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.opportunities import router as opportunities_router
from app.api.v1.gates import router as gates_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.voice import router as voice_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("innovait.sales")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Orquestador multi-agente para ventas consultivas B2B con Human-in-the-Loop (HITL) en LangGraph",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


@app.on_event("startup")
async def on_startup():
    logger.info("================================================")
    logger.info("🚀 INNOVAIT Backend iniciado exitosamente!")
    logger.info(f"Ambiente: {settings.ENVIRONMENT}")
    logger.info(f"Prefijo API: {settings.API_V1_PREFIX}")
    logger.info("================================================")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*$",
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers
app.include_router(opportunities_router, prefix=settings.API_V1_PREFIX)
app.include_router(gates_router, prefix=settings.API_V1_PREFIX)
app.include_router(catalog_router, prefix=settings.API_V1_PREFIX)
app.include_router(voice_router, prefix=settings.API_V1_PREFIX)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error no controlado en {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno en el orquestador: {str(exc)}"}
    )


@app.get("/")
@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
