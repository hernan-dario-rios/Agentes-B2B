from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.opportunity import OpportunityContext
from app.schemas.gate import GateAction, GateType


class AgentState(BaseModel):
    """
    Estado compartido (Shared State) que viaja a través del grafo de LangGraph.
    Es serializable y persistido en PostgreSQL por el Checkpointer.
    """
    opportunity: OpportunityContext
    current_gate: Optional[GateType] = None
    human_action: Optional[GateAction] = None
    human_feedback: Optional[str] = None
    human_modifications: Optional[Dict[str, Any]] = None
    
    # Registro de pasos y logs de razonamiento
    reasoning_logs: List[str] = Field(default_factory=list)
    next_step: Optional[str] = None
