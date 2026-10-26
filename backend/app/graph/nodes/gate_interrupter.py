import logging
from datetime import datetime, timezone
from typing import Dict, Any
from langgraph.types import interrupt
from app.graph.state import AgentState
from app.schemas.gate import GateAction, GateHistoryRecord
from app.schemas.opportunity import PipelineStage

logger = logging.getLogger(__name__)


def human_gate_node(state: AgentState) -> AgentState:
    """
    Nodo de Compuerta Humana (Approval Gate).
    Pausa la ejecución del grafo usando `interrupt()`, esperando la decisión del humano:
    - APPROVE: Continúa al siguiente agente
    - MODIFY: Re-ejecuta el agente actual con la retroalimentación
    - OVERRIDE: Detiene la automatización y pasa a MANUAL_TAKEOVER
    """
    opp = state.opportunity
    current_gate = opp.current_gate or state.current_gate
    
    logger.info(f"[HITL Gate] Pausando grafo en {current_gate} para {opp.company_name}")
    
    # Preparamos el payload que la UI de Command Center o el webhook de n8n consume
    gate_payload = {
        "gate": current_gate.value if current_gate else "UNKNOWN_GATE",
        "opportunity_id": opp.opportunity_id,
        "company_name": opp.company_name,
        "current_stage": opp.stage.value,
        "waiting_since": datetime.now(timezone.utc).isoformat(),
        "prompt": f"Revisión humana requerida en {current_gate}. Opciones: APPROVE, MODIFY, OVERRIDE."
    }
    
    # interrupt() congela el grafo en el Checkpointer y espera la llamada Command(resume=...)
    human_decision: Dict[str, Any] = interrupt(gate_payload)
    
    # Procesar la decisión inyectada
    action_str = human_decision.get("action", "APPROVE")
    action = GateAction(action_str)
    feedback = human_decision.get("feedback")
    modifications = human_decision.get("modifications")
    user_name = human_decision.get("user_name", "Revisor Humano")
    
    state.human_action = action
    state.human_feedback = feedback
    state.human_modifications = modifications
    
    # Registrar en historial inmutable de la oportunidad
    opp.gate_history.append(
        GateHistoryRecord(
            gate_type=current_gate,
            action=action,
            user_name=user_name,
            feedback=feedback,
            timestamp=datetime.now(timezone.utc)
        )
    )
    
    if action == GateAction.OVERRIDE:
        opp.stage = PipelineStage.MANUAL_TAKEOVER
        state.reasoning_logs.append(
            f"El humano tomó el control manual (OVERRIDE) en {current_gate}. Flujo automatizado detenido."
        )
    elif action == GateAction.MODIFY:
        opp.last_human_feedback = feedback
        state.reasoning_logs.append(
            f"El humano solicitó modificaciones (MODIFY) en {current_gate}: '{feedback}'. Re-ejecutando agente."
        )
    else:  # APPROVE
        state.reasoning_logs.append(
            f"El humano aprobó con éxito (APPROVE) la compuerta {current_gate}. Continuando a siguiente fase."
        )
        
    opp.updated_at = datetime.now(timezone.utc)
    return state
