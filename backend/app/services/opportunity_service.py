import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone
from langgraph.types import Command

from app.schemas.opportunity import OpportunityContext, PipelineStage
from app.schemas.gate import GateDecisionPayload, GateStatus, PendingGateSummary, GateType, GateAction
from app.graph.state import AgentState
from app.graph.workflow import sales_pipeline_graph

logger = logging.getLogger(__name__)


class OpportunityService:
    def __init__(self):
        # Repositorio en memoria sincronizado para pruebas y persistencia en dev
        self.opportunities: Dict[str, OpportunityContext] = {}
        self.graph_states: Dict[str, AgentState] = {}

    def create_opportunity(
        self,
        company_name: str,
        website: Optional[str] = None,
        country: str = "Colombia"
    ) -> OpportunityContext:
        opp_id = f"opp_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{len(self.opportunities)+1:03d}"
        opp = OpportunityContext(
            opportunity_id=opp_id,
            company_name=company_name,
            website=website,
            country=country,
            stage=PipelineStage.LEAD_DISCOVERED,
            current_gate=GateType.GATE_1_TARGET
        )
        self.opportunities[opp_id] = opp

        # Iniciar ejecución inicial del grafo en LangGraph (thread_id = opp_id)
        config = {"configurable": {"thread_id": opp_id}}
        initial_state = AgentState(opportunity=opp)
        
        logger.info(f"Iniciando flujo en LangGraph para la oportunidad {opp_id}...")
        # Correr hasta la primera interrupción (Gate 1)
        res = sales_pipeline_graph.invoke(initial_state, config=config)
        
        # El grafo se interrumpe y guarda el estado
        updated_state = sales_pipeline_graph.get_state(config)
        if updated_state and updated_state.values:
            latest_opp = updated_state.values.get("opportunity", opp)
            self.opportunities[opp_id] = latest_opp
            return latest_opp
        return opp

    def get_opportunity(self, opp_id: str) -> Optional[OpportunityContext]:
        # Consultar estado actual del hilo en LangGraph
        config = {"configurable": {"thread_id": opp_id}}
        state_snapshot = sales_pipeline_graph.get_state(config)
        if state_snapshot and state_snapshot.values:
            return state_snapshot.values.get("opportunity", self.opportunities.get(opp_id))
        return self.opportunities.get(opp_id)

    def list_opportunities(self) -> List[OpportunityContext]:
        return list(self.opportunities.values())

    def get_pending_gates(self) -> List[PendingGateSummary]:
        pending = []
        for opp_id, opp in self.opportunities.items():
            if opp.stage == PipelineStage.WAITING_HUMAN_APPROVAL and opp.current_gate:
                headline = f"Revisión requerida: {opp.current_gate.value}"
                agent_name = "Agente Especializado"
                recom = ""
                metrics = {}

                if opp.current_gate == GateType.GATE_1_TARGET:
                    headline = f"Validación de Target: {opp.company_name}"
                    agent_name = "Scraper & Enricher Agent"
                    recom = f"Ajuste ICP {opp.icp_data.fit_score}/100. Industria: {opp.icp_data.industry}."
                    metrics = {"fit_score": opp.icp_data.fit_score, "stack": opp.icp_data.current_stack}
                elif opp.current_gate == GateType.GATE_2_OUTREACH:
                    headline = f"Aprobación de Primer Contacto: {opp.company_name}"
                    agent_name = "SDR / Outreach Agent"
                    recom = f"Correo redactado: '{opp.outreach.subject if opp.outreach else 'Sin asunto'}'"
                    metrics = {"channel": "EMAIL", "variants": len(opp.outreach.followup_variants) if opp.outreach else 0}
                elif opp.current_gate == GateType.GATE_3_DISCOVERY:
                    headline = f"Validación de Alcance Técnico (BANT): {opp.company_name}"
                    agent_name = "Discovery & Triage Agent"
                    recom = f"Dolor: {opp.discovery.need if opp.discovery else 'No levantado'}."
                    metrics = {"timeline": opp.discovery.timeline if opp.discovery else "N/A"}
                elif opp.current_gate == GateType.GATE_4_ARCHITECT:
                    headline = f"Revisión de Arquitectura y Pricing: {opp.company_name}"
                    agent_name = "Solutions Architect Agent"
                    recom = f"Paquetes: {', '.join(opp.solution_proposal.recommended_packages) if opp.solution_proposal else ''}"
                    metrics = opp.solution_proposal.pricing if opp.solution_proposal else {}
                elif opp.current_gate == GateType.GATE_5_LEGAL:
                    headline = f"Aprobación de Contrato y SLA: {opp.company_name}"
                    agent_name = "Deal Desk & Legal Agent"
                    recom = f"Contrato listo para {opp.contract.client_legal_name if opp.contract else opp.company_name}."
                    metrics = {"sla": opp.contract.sla_tier if opp.contract else "Standard"}

                pending.append(PendingGateSummary(
                    opportunity_id=opp_id,
                    company_name=opp.company_name,
                    gate_type=opp.current_gate,
                    status=GateStatus.PENDING,
                    headline=headline,
                    agent_name=agent_name,
                    recommendation_summary=recom,
                    key_metrics=metrics,
                    waiting_since=opp.updated_at
                ))
        return pending

    def submit_gate_decision(
        self,
        opp_id: str,
        payload: GateDecisionPayload
    ) -> Optional[OpportunityContext]:
        config = {"configurable": {"thread_id": opp_id}}
        state_snapshot = sales_pipeline_graph.get_state(config)
        
        if not state_snapshot:
            logger.error(f"No se encontró estado de LangGraph para opp_id: {opp_id}")
            return None

        # Reanudar la ejecución en LangGraph usando Command(resume=...)
        resume_payload = {
            "action": payload.action.value,
            "feedback": payload.feedback,
            "modifications": payload.modifications,
            "user_name": payload.user_name
        }
        
        logger.info(f"Reanudando grafo para {opp_id} con acción {payload.action.value}...")
        sales_pipeline_graph.invoke(Command(resume=resume_payload), config=config)
        
        # Leer el nuevo estado tras avanzar o re-ejecutar
        new_state = sales_pipeline_graph.get_state(config)
        if new_state and new_state.values:
            updated_opp = new_state.values.get("opportunity")
            if updated_opp:
                self.opportunities[opp_id] = updated_opp
                return updated_opp
        return self.opportunities.get(opp_id)


# Singleton
opportunity_service = OpportunityService()
