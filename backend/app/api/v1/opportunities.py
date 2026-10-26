from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.schemas.opportunity import OpportunityContext
from app.services.opportunity_service import opportunity_service

router = APIRouter(prefix="/opportunities", tags=["Oportunidades"])


class CreateOpportunityRequest(BaseModel):
    company_name: str = Field(..., examples=["Transportes Interandinos S.A."])
    website: Optional[str] = Field(None, examples=["https://www.transportesinterandinos.com"])
    country: str = Field(default="Colombia", examples=["Colombia"])


@router.post("/", response_model=OpportunityContext, status_code=201)
def create_opportunity(req: CreateOpportunityRequest):
    """
    Crea una nueva oportunidad y dispara el primer agente autónomo (Scraper & Enricher).
    El flujo se pausará automáticamente en Gate 1 (Validación de Target).
    """
    return opportunity_service.create_opportunity(
        company_name=req.company_name,
        website=req.website,
        country=req.country
    )


@router.get("/", response_model=List[OpportunityContext])
def list_opportunities():
    """Retorna todas las oportunidades activas en el pipeline."""
    return opportunity_service.list_opportunities()


@router.get("/{opp_id}", response_model=OpportunityContext)
def get_opportunity(opp_id: str):
    """Obtiene el contexto completo y estado actual de una oportunidad."""
    opp = opportunity_service.get_opportunity(opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Oportunidad no encontrada")
    return opp
