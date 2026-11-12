from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class GateType(str, Enum):
    GATE_1_TARGET = "GATE_1_TARGET"
    GATE_2_OUTREACH = "GATE_2_OUTREACH"
    GATE_3_DISCOVERY = "GATE_3_DISCOVERY"
    GATE_4_ARCHITECT = "GATE_4_ARCHITECT"
    GATE_5_LEGAL = "GATE_5_LEGAL"


class GateAction(str, Enum):
    APPROVE = "APPROVE"
    MODIFY = "MODIFY"
    OVERRIDE = "OVERRIDE"
    REGRESS = "REGRESS"


class GateStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    MODIFIED = "MODIFIED"
    OVERRIDDEN = "OVERRIDDEN"
    REGRESSED = "REGRESSED"


class GateDecisionPayload(BaseModel):
    action: GateAction = Field(..., description="Acción seleccionada por el humano: APPROVE, MODIFY, OVERRIDE o REGRESS")
    target_gate: Optional[GateType] = Field(None, description="Compuerta de destino (requerido si action es REGRESS)")
    feedback: Optional[str] = Field(
        None, 
        description="Instrucciones o retroalimentación humana para regenerar la tarea (requerido si action es MODIFY o REGRESS)"
    )
    modifications: Optional[Dict[str, Any]] = Field(
        None, 
        description="Ajustes explícitos directos (ej. descuento manual, cambio de fecha o término)"
    )
    user_name: str = Field(default="Comercial / Revisor Humano")


class RegressGateRequest(BaseModel):
    target_gate: GateType = Field(..., description="Compuerta previa hacia la cual retroceder la oportunidad")
    reason: str = Field(..., description="Motivo comercial o técnico de la devolución")
    user_name: str = Field(default="Director Comercial (Comando Central)")


class GateHistoryRecord(BaseModel):
    gate_type: GateType
    action: GateAction
    user_name: str
    feedback: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    snapshot: Optional[Dict[str, Any]] = None


class PendingGateSummary(BaseModel):
    opportunity_id: str
    company_name: str
    gate_type: GateType
    status: GateStatus
    headline: str
    agent_name: str
    recommendation_summary: str
    key_metrics: Dict[str, Any] = Field(default_factory=dict)
    context_details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Sustentación detallada, contactos, dolores y desglose de precios")
    waiting_since: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
