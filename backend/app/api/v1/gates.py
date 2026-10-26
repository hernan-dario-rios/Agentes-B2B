from typing import List
from fastapi import APIRouter, HTTPException
from app.schemas.gate import GateDecisionPayload, PendingGateSummary
from app.schemas.opportunity import OpportunityContext
from app.services.opportunity_service import opportunity_service

router = APIRouter(prefix="/gates", tags=["Compuertas de Aprobación (HITL)"])


@router.get("/pending", response_model=List[PendingGateSummary])
def get_pending_gates():
    """
    Retorna la bandeja de entrada (Inbox) de todas las oportunidades
    esperando decisión humana en alguna de las 5 compuertas.
    """
    return opportunity_service.get_pending_gates()


@router.post("/{opp_id}/decision", response_model=OpportunityContext)
def submit_gate_decision(opp_id: str, payload: GateDecisionPayload):
    """
    Inyecta la decisión humana (APPROVE, MODIFY, OVERRIDE) para reanudar el grafo de LangGraph.
    - Si es APPROVE: el flujo avanza al siguiente agente.
    - Si es MODIFY: el agente actual se re-ejecuta con las instrucciones de feedback.
    - Si es OVERRIDE: el flujo se detiene y la oportunidad pasa a control manual.
    """
    updated_opp = opportunity_service.submit_gate_decision(opp_id, payload)
    if not updated_opp:
        raise HTTPException(
            status_code=400, 
            detail="No fue posible aplicar la decisión o la oportunidad no está en espera de aprobación."
        )
    return updated_opp
