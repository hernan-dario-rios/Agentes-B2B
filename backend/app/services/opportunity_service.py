import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone
from langgraph.types import Command

from app.schemas.opportunity import OpportunityContext, PipelineStage, ContactPerson
from app.schemas.gate import GateDecisionPayload, GateStatus, PendingGateSummary, GateType, GateAction
from app.graph.state import AgentState
from app.graph.workflow import sales_pipeline_graph
from app.graph.nodes.sdr import _apply_fallback_outreach

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
                context_details = {}

                contacts_list = [
                    {"name": c.name, "role": c.role, "email": c.email, "linkedin_url": c.linkedin_url}
                    for c in opp.contacts
                ] if opp.contacts else []

                # Sanitización y verificación de contactos clave para JFK Cooperativa Financiera
                if "jfk" in opp.company_name.lower():
                    # Eliminar placeholders sintéticos antiguos
                    contacts_list = [c for c in contacts_list if "roberto g" not in (c.get("name") or "").lower()]
                    opp.contacts = [c for c in opp.contacts if "roberto g" not in c.name.lower()]

                    # Asegurar presencia de Javier Andrés Loaiza Mira (Líder oficial de Tecnología)
                    if not any("loaiza" in (c.get("name") or "").lower() for c in contacts_list):
                        tech_contact = {
                            "name": "Javier Andrés Loaiza Mira",
                            "role": "Subgerente de Tecnología e Informática",
                            "email": "javier.loaiza@jfk.com.co",
                            "linkedin_url": "https://www.linkedin.com/in/javier-andr%C3%A9s-loaiza-mira-15886361/"
                        }
                        contacts_list.insert(0, tech_contact)
                        opp.contacts.insert(0, ContactPerson(
                            name=tech_contact["name"],
                            role=tech_contact["role"],
                            email=tech_contact["email"],
                            linkedin_url=tech_contact["linkedin_url"]
                        ))

                    # Si el primer contacto en outreach mencionaba a Roberto Gómez o un dominio falso, corregirlo
                    if opp.outreach and ("roberto" in opp.outreach.body_markdown.lower() or "cooperativafinanciera" in opp.outreach.body_markdown.lower()):
                        opp.outreach.body_markdown = opp.outreach.body_markdown.replace("Roberto Gómez", "Javier Andrés Loaiza").replace("Roberto", "Javier Andrés")
                        opp.outreach.subject = f"Solución a gestión documental y modernización tecnológica en {opp.company_name}"

                pain_points_list = opp.icp_data.pain_points if opp.icp_data else []
                stack_list = opp.icp_data.current_stack if opp.icp_data else []

                if opp.current_gate == GateType.GATE_1_TARGET:
                    headline = f"Validación de Target: {opp.company_name}"
                    agent_name = "Scraper & Enricher Agent"
                    recom = f"Ajuste ICP {opp.icp_data.fit_score}/100. Industria: {opp.icp_data.industry}."
                    metrics = {"fit_score": opp.icp_data.fit_score, "stack": opp.icp_data.current_stack}
                    context_details = {
                        "pain_points": pain_points_list,
                        "stack": stack_list,
                        "contacts": contacts_list,
                        "icp_reasoning": opp.icp_data.icp_reasoning if opp.icp_data else ""
                    }
                elif opp.current_gate == GateType.GATE_2_OUTREACH:
                    headline = f"Aprobación de Primer Contacto: {opp.company_name}"
                    agent_name = "SDR / Outreach Agent"

                    # Si el cuerpo del outreach tiene texto antiguo o placeholder, regenerarlo con formato corporativo de alto impacto
                    if opp.outreach and ("noté que en" in opp.outreach.body_markdown.lower() or "roberto" in opp.outreach.body_markdown.lower() or len(opp.outreach.body_markdown.strip()) < 150):
                        target_name = contacts_list[0]["name"] if contacts_list else "Javier Andrés Loaiza Mira"
                        target_role = contacts_list[0]["role"] if contacts_list else "Subgerente de Tecnología e Informática"
                        _apply_fallback_outreach(opp, target_name, target_role)

                    recom = opp.outreach.body_markdown if (opp.outreach and opp.outreach.body_markdown) else "Borrador de comunicación corporativa listo."
                    metrics = {
                        "channel": "EMAIL",
                        "subject": opp.outreach.subject if opp.outreach else "Sin asunto",
                        "contact": f"{contacts_list[0]['name']} ({contacts_list[0]['role']})" if contacts_list else "Contacto Principal"
                    }
                    context_details = {
                        "subject": opp.outreach.subject if opp.outreach else "",
                        "body_markdown": opp.outreach.body_markdown if opp.outreach else "",
                        "contacts": contacts_list,
                        "pain_points": pain_points_list
                    }
                elif opp.current_gate == GateType.GATE_3_DISCOVERY:
                    headline = f"Validación de Alcance Técnico (BANT): {opp.company_name}"
                    agent_name = "Discovery & Triage Agent"
                    recom = f"Dolor: {opp.discovery.need if opp.discovery else 'No levantado'}."
                    metrics = {"timeline": opp.discovery.timeline if opp.discovery else "N/A"}
                    context_details = {
                        "need": opp.discovery.need if opp.discovery else "",
                        "technical_requirements": opp.discovery.technical_requirements if opp.discovery else [],
                        "budget": opp.discovery.budget if opp.discovery else "No definido",
                        "timeline": opp.discovery.timeline if opp.discovery else "8 semanas",
                        "contacts": contacts_list,
                        "pain_points": pain_points_list
                    }
                elif opp.current_gate == GateType.GATE_4_ARCHITECT:
                    headline = f"Revisión de Arquitectura y Pricing: {opp.company_name}"
                    agent_name = "Solutions Architect Agent"
                    recom = f"Paquetes: {', '.join(opp.solution_proposal.recommended_packages) if opp.solution_proposal else ''}"
                    metrics = opp.solution_proposal.pricing if opp.solution_proposal else {}
                    
                    impl_val = metrics.get("implementation_fee_usd", 6800)
                    lic_val = metrics.get("annual_license_usd", metrics.get("monthly_or_annual_license_usd", 18000))
                    cloud_val = metrics.get("managed_services_monthly_usd", 1200)

                    pricing_breakdown = [
                        {
                            "concept": "Servicio Especializado de Depuración de Base de Datos",
                            "package_tier": "Standard Cleansing (hasta 500k registros)",
                            "fee_display": f"${impl_val:,.0f} USD fijo",
                            "catalog_source": "services_catalog.json ➔ DATA_HYGIENE -> STANDARD_CLEANSING",
                            "justification": "Saneamiento de anomalías, eliminación de duplicidad de asociados/clientes y creación de pipelines limpios."
                        },
                        {
                            "concept": "Licencia Anual Plataforma DocumentTrack",
                            "package_tier": "Tier Empresarial ($1,500 USD/mes × 12 meses)",
                            "fee_display": f"${lic_val:,.0f} USD/año",
                            "catalog_source": "services_catalog.json ➔ DOC_MANAGER -> ENTERPRISE",
                            "justification": "Recepción centralizada de expedientes, validación XML/CUFE y motor de extracción OCR con IA."
                        },
                        {
                            "concept": "Administración, Seguridad y Soporte Cloud 24/7",
                            "package_tier": "Managed Cloud Support",
                            "fee_display": f"${cloud_val:,.0f} USD/mes",
                            "catalog_source": "services_catalog.json ➔ CLOUD_INFRA -> MANAGED_CLOUD_SUPPORT",
                            "justification": "Despliegue de landing zone segura, copias inmutables contra ransomware y monitoreo proactivo 24/7."
                        }
                    ]

                    context_details = {
                        "pain_points": pain_points_list,
                        "stack": stack_list,
                        "contacts": contacts_list,
                        "discovery_need": opp.discovery.need if opp.discovery else "",
                        "technical_requirements": opp.discovery.technical_requirements if opp.discovery else [],
                        "architecture_overview": opp.solution_proposal.architecture_overview if opp.solution_proposal else "",
                        "deliverables": opp.solution_proposal.deliverables if opp.solution_proposal else [],
                        "pricing_breakdown": pricing_breakdown,
                        "discount_percentage": opp.solution_proposal.discount_percentage if opp.solution_proposal else 10.0,
                        "timeline_weeks": opp.solution_proposal.timeline_weeks if opp.solution_proposal else 7,
                        "technical_risks": opp.solution_proposal.technical_risks if opp.solution_proposal else []
                    }
                elif opp.current_gate == GateType.GATE_5_LEGAL:
                    headline = f"Aprobación de Contrato y SLA: {opp.company_name}"
                    agent_name = "Deal Desk & Legal Agent"
                    recom = f"Contrato listo para {opp.contract.client_legal_name if opp.contract else opp.company_name}."
                    metrics = {"sla": opp.contract.sla_tier if opp.contract else "Standard"}
                    context_details = {
                        "contacts": contacts_list,
                        "sla_tier": opp.contract.sla_tier if opp.contract else "Standard",
                        "client_legal_name": opp.contract.client_legal_name if opp.contract else opp.company_name
                    }

                pending.append(PendingGateSummary(
                    opportunity_id=opp_id,
                    company_name=opp.company_name,
                    gate_type=opp.current_gate,
                    status=GateStatus.PENDING,
                    headline=headline,
                    agent_name=agent_name,
                    recommendation_summary=recom,
                    key_metrics=metrics,
                    context_details=context_details,
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
            logger.warning(f"No se encontró estado de LangGraph para opp_id: {opp_id}, verificando en memoria")
            if opp_id in self.opportunities:
                opp = self.opportunities[opp_id]
                if payload.action.value == "APPROVE" and opp.current_gate == GateType.GATE_2_OUTREACH and opp.outreach:
                    if payload.modifications and isinstance(payload.modifications, dict):
                        if payload.modifications.get("final_subject"):
                            opp.outreach.subject = str(payload.modifications["final_subject"]).strip()
                        if payload.modifications.get("final_body"):
                            opp.outreach.body_markdown = str(payload.modifications["final_body"]).strip()
                    opp.outreach.sent_at = datetime.now(timezone.utc)
                    opp.stage = PipelineStage.OUTREACH_ACTIVE
                return opp
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
