import logging
from typing import Literal
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.graph.state import AgentState
from app.schemas.gate import GateAction
from app.schemas.opportunity import PipelineStage

from app.graph.nodes.enricher import enricher_agent_node
from app.graph.nodes.sdr import sdr_agent_node
from app.graph.nodes.discovery import discovery_agent_node
from app.graph.nodes.architect import solutions_architect_agent_node
from app.graph.nodes.legal import legal_agent_node
from app.graph.nodes.gate_interrupter import human_gate_node

logger = logging.getLogger(__name__)


def finalize_node(state: AgentState) -> AgentState:
    """Nodo final tras aprobación de Gate 5: marca la oportunidad como ganada/contratada."""
    opp = state.opportunity
    opp.stage = PipelineStage.WON
    state.reasoning_logs.append(
        f"¡Ciclo completado con éxito! Contrato listo y despachado para {opp.company_name}."
    )
    return state


def route_gate_1(state: AgentState) -> Literal["sdr_agent", "enricher_agent", "__end__"]:
    action = state.human_action
    if action == GateAction.APPROVE:
        return "sdr_agent"
    elif action == GateAction.MODIFY:
        return "enricher_agent"
    return "__end__"


def route_gate_2(state: AgentState) -> Literal["discovery_agent", "sdr_agent", "__end__"]:
    action = state.human_action
    if action == GateAction.APPROVE:
        return "discovery_agent"
    elif action == GateAction.MODIFY:
        return "sdr_agent"
    return "__end__"


def route_gate_3(state: AgentState) -> Literal["architect_agent", "discovery_agent", "__end__"]:
    action = state.human_action
    if action == GateAction.APPROVE:
        return "architect_agent"
    elif action == GateAction.MODIFY:
        return "discovery_agent"
    return "__end__"


def route_gate_4(state: AgentState) -> Literal["legal_agent", "architect_agent", "__end__"]:
    action = state.human_action
    if action == GateAction.APPROVE:
        return "legal_agent"
    elif action == GateAction.MODIFY:
        return "architect_agent"
    return "__end__"


def route_gate_5(state: AgentState) -> Literal["finalize", "legal_agent", "__end__"]:
    action = state.human_action
    if action == GateAction.APPROVE:
        return "finalize"
    elif action == GateAction.MODIFY:
        return "legal_agent"
    return "__end__"


def build_sales_graph(checkpointer=None):
    """
    Construye la máquina de estados de ventas B2B en LangGraph con compuertas de interrupción HITL.
    """
    workflow = StateGraph(AgentState)

    # 1. Registro de nodos
    workflow.add_node("enricher_agent", enricher_agent_node)
    workflow.add_node("gate_1", human_gate_node)
    
    workflow.add_node("sdr_agent", sdr_agent_node)
    workflow.add_node("gate_2", human_gate_node)
    
    workflow.add_node("discovery_agent", discovery_agent_node)
    workflow.add_node("gate_3", human_gate_node)
    
    workflow.add_node("architect_agent", solutions_architect_agent_node)
    workflow.add_node("gate_4", human_gate_node)
    
    workflow.add_node("legal_agent", legal_agent_node)
    workflow.add_node("gate_5", human_gate_node)
    
    workflow.add_node("finalize", finalize_node)

    # 2. Conexiones secuenciales hacia las compuertas
    workflow.add_edge(START, "enricher_agent")
    workflow.add_edge("enricher_agent", "gate_1")
    
    workflow.add_edge("sdr_agent", "gate_2")
    workflow.add_edge("discovery_agent", "gate_3")
    workflow.add_edge("architect_agent", "gate_4")
    workflow.add_edge("legal_agent", "gate_5")
    workflow.add_edge("finalize", END)

    # 3. Compuertas condicionales HITL (Approve -> siguiente, Modify -> reintentar, Override -> END)
    workflow.add_conditional_edges("gate_1", route_gate_1)
    workflow.add_conditional_edges("gate_2", route_gate_2)
    workflow.add_conditional_edges("gate_3", route_gate_3)
    workflow.add_conditional_edges("gate_4", route_gate_4)
    workflow.add_conditional_edges("gate_5", route_gate_5)

    # Usar checkpointer en memoria si no se provee uno externo (ej. PostgresSaver)
    active_checkpointer = checkpointer or MemorySaver()
    return workflow.compile(checkpointer=active_checkpointer)


# Instancia singleton precompilada en memoria para desarrollo y pruebas rápidas
sales_pipeline_graph = build_sales_graph()
