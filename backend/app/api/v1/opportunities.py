from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.schemas.opportunity import (
    ContactPerson,
    HuntLeadsRequest,
    HuntLeadsResponse,
    OpportunityContext,
)
from app.services.opportunity_service import opportunity_service
from app.services.hunter_service import hunter_service

router = APIRouter(prefix="/opportunities", tags=["Oportunidades"])


class CreateOpportunityRequest(BaseModel):
    company_name: str = Field(..., examples=["Transportes Interandinos S.A."])
    website: Optional[str] = Field(None, examples=["https://www.transportesinterandinos.com"])
    country: str = Field(default="Colombia", examples=["Colombia"])


@router.get("/hunt/presets", response_model=Dict[str, Any])
def get_hunter_presets():
    """
    Retorna la configuración preestablecida de sectores, ciudades y tipos de empresa
    disponibles para el Radar de Prospección Autónoma.
    """
    return hunter_service.get_presets()


@router.post("/hunt", response_model=HuntLeadsResponse)
def hunt_opportunities(req: HuntLeadsRequest):
    """
    Dispara el Radar de Prospección Autónoma (Lead Hunter Agent).
    Descubre empresas reales, las califica por potencial ICP y crea automáticamente
    las oportunidades en Gate 1 (Validación de Target).
    """
    return hunter_service.hunt_leads(req)


@router.post("/", response_model=OpportunityContext, status_code=201)
def create_opportunity(req: CreateOpportunityRequest):
    """
    Crea una nueva oportunidad manual y dispara el primer agente autónomo (Scraper & Enricher).
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


@router.put("/{opp_id}/contacts", response_model=OpportunityContext)
def update_opportunity_contacts(opp_id: str, contacts: List[ContactPerson]):
    """
    Actualiza la lista de personas de contacto (nombre, cargo, correo, teléfono, linkedin)
    de una oportunidad específica y persiste los cambios.
    """
    try:
        return opportunity_service.update_contacts(opp_id, contacts)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

