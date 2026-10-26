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


class GateStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    MODIFIED = "MODIFIED"
    OVERRIDDEN = "OVERRIDDEN"


class GateDecisionPayload(BaseModel):
    action: GateAction = Field(..., description="Acción seleccionada por el humano: APPROVE, MODIFY u OVERRIDE")
    feedback: Optional[str] = Field(
        None, 
        description="Instrucciones o retroalimentación humana para regenerar la tarea (requerido si action es MODIFY)"
    )
    modifications: Optional[Dict[str, Any]] = Field(
        None, 
        description="Ajustes explícitos directos (ej. descuento manual, cambio de fecha o término)"
    )
    user_name: str = Field(default="Comercial / Revisor Humano")


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
    waiting_since: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
