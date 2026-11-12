from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timezone
from langgraph.types import Command

from app.schemas.opportunity import (
    OpportunityContext,
    PipelineStage,
    ContactPerson,
    ICPData,
    ServiceCategory,
)
from app.schemas.gate import GateDecisionPayload, GateStatus, PendingGateSummary, GateType, GateAction, GateHistoryRecord
from app.graph.state import AgentState
from app.graph.workflow import sales_pipeline_graph
from app.graph.nodes.enricher import enricher_agent_node
from app.graph.nodes.sdr import sdr_agent_node, _apply_fallback_outreach
from app.graph.nodes.discovery import discovery_agent_node
from app.graph.nodes.architect import solutions_architect_agent_node
from app.graph.nodes.legal import legal_agent_node

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "knowledge" / "opportunities_db.json"


class OpportunityService:
    def __init__(self):
        # Repositorio sincronizado en memoria y persistido en archivo JSON permanente
        self.opportunities: Dict[str, OpportunityContext] = {}
        self.graph_states: Dict[str, AgentState] = {}
        self._last_mtime: float = 0.0
        self._load_db()

    def _check_and_reload(self):
        """Verifica si el archivo JSON cambió en disco y sincroniza en memoria automáticamente"""
        try:
            if not DB_PATH.exists():
                return
            mtime = DB_PATH.stat().st_mtime
            if mtime != self._last_mtime:
                self._load_db()
        except Exception as e:
            logger.debug(f"[OpportunityService] Excepción menor verificando mtime: {e}")

    def _load_db(self):
        """Carga permanente de las oportunidades desde el archivo JSON del backend"""
        if not DB_PATH.exists():
            return
        try:
            self._last_mtime = DB_PATH.stat().st_mtime
            with open(DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    try:
                        opp = OpportunityContext.model_validate(item)
                        self.opportunities[opp.opportunity_id] = opp
                    except Exception as err:
                        logger.warning(f"Error parseando oportunidad desde DB JSON: {err}")
            logger.info(f"[OpportunityService] Se cargaron {len(self.opportunities)} oportunidades persistidas desde {DB_PATH.name}")
        except Exception as e:
            logger.error(f"[OpportunityService] Error leyendo {DB_PATH}: {e}")

    def _save_db(self):
        """Persistencia atómica de oportunidades en disco para prevenir pérdidas por reinicios"""
        try:
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            serializable = [opp.model_dump(mode="json") for opp in self.opportunities.values()]
            with open(DB_PATH, "w", encoding="utf-8") as f:
                json.dump(serializable, f, indent=2, ensure_ascii=False)
            logger.info(f"[OpportunityService] Guardadas {len(serializable)} oportunidades en {DB_PATH.name}")
        except Exception as e:
            logger.error(f"[OpportunityService] Error guardando {DB_PATH}: {e}")

    def create_opportunity(
        self,
        company_name: str,
        website: Optional[str] = None,
        country: str = "Colombia",
        tax_id: Optional[str] = None,
        address: Optional[str] = None,
        initial_contacts: Optional[List[ContactPerson]] = None,
        initial_icp: Optional[ICPData] = None,
        target_services: Optional[List[ServiceCategory]] = None
    ) -> OpportunityContext:
        opp_id = f"opp_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{len(self.opportunities)+1:03d}"
        opp = OpportunityContext(
            opportunity_id=opp_id,
            company_name=company_name,
            website=website,
            country=country,
            tax_id=tax_id,
            address=address,
            target_services=target_services or [],
            stage=PipelineStage.LEAD_DISCOVERED,
            current_gate=GateType.GATE_1_TARGET,
            contacts=initial_contacts or []
        )
        if initial_icp:
            opp.icp_data = initial_icp

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
            self._save_db()
            return latest_opp
        self._save_db()
        return opp

    def seed_demo_opportunity(self) -> OpportunityContext:
        """
        Crea o reinicia una oportunidad de prueba integral ('opp_demo_e2e') en Gate 1
        para permitir demostraciones completas del ciclo de ventas y llamadas con Sara.
        """
        opp_id = "opp_demo_e2e"
        demo_opp = OpportunityContext(
            opportunity_id=opp_id,
            company_name="[DEMO E2E] Soluciones Andinas Logística S.A.S.",
            website="https://andinaslogistica.com",
            country="Colombia",
            tax_id="901.442.889-3",
            address="Zona Industrial Guayabal, Medellín, Antioquia",
            target_services=[
                ServiceCategory.DOC_MANAGER,
                ServiceCategory.DATA_HYGIENE,
                ServiceCategory.CLOUD_INFRA,
                ServiceCategory.AI_AUTOMATION,
            ],
            stage=PipelineStage.WAITING_HUMAN_APPROVAL,
            current_gate=GateType.GATE_1_TARGET,
            icp_data=ICPData(
                industry="Logística, Transporte & Comercio B2B",
                size_employees=350,
                annual_revenue_range="10M - 25M USD",
                current_stack=[
                    "ERP Contable Local / SQL Server",
                    "Planillas Excel Compartidas en Red",
                    "Archivo Físico de Remesas en Bodega",
                ],
                pain_points=[
                    "Descentralización y pérdida de remesas físicas y facturas CUFE",
                    "Duplicidad en bases de datos de clientes y remitentes entre sedes",
                    "Servidores locales sin respaldo seguro en nube ni contingencia",
                ],
                fit_score=94,
                icp_reasoning="Ajuste ideal para DocumentTrack + Data Hygiene + Cloud Infra con alto retorno de inversión.",
            ),
            contacts=[
                ContactPerson(
                    name="Hernán Ríos",
                    role="Director de Operaciones & TI",
                    email="hernan.rios@andinaslogistica.co",
                    phone="+57 (604) 480 9000",
                    linkedin_url="https://www.linkedin.com/in/hernan-rios",
                    status="PENDING_CONTACT",
                )
            ],
            outreach=None,
            discovery=None,
            solution_proposal=None,
            contract=None,
            gate_history=[],
            last_human_feedback=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self.opportunities[opp_id] = demo_opp
        self._save_db()
        logger.info(f"[OpportunityService] Oportunidad demo sembrada/reiniciada: {opp_id}")
        return demo_opp

    def get_opportunity(self, opp_id: str) -> Optional[OpportunityContext]:
        self._check_and_reload()
        # Consultar estado actual del hilo en LangGraph
        config = {"configurable": {"thread_id": opp_id}}
        state_snapshot = sales_pipeline_graph.get_state(config)
        if state_snapshot and state_snapshot.values:
            return state_snapshot.values.get("opportunity", self.opportunities.get(opp_id))
        return self.opportunities.get(opp_id)

    def list_opportunities(self) -> List[OpportunityContext]:
        self._check_and_reload()
        return list(self.opportunities.values())

    def update_contacts(self, opp_id: str, contacts: List[ContactPerson]) -> OpportunityContext:
        """Actualiza la lista de personas de contacto de una oportunidad y persiste los cambios."""
        opp = self.opportunities.get(opp_id)
        if not opp:
            raise ValueError(f"Oportunidad {opp_id} no encontrada.")
        opp.contacts = contacts
        opp.updated_at = datetime.now(timezone.utc)
        self.opportunities[opp_id] = opp
        self._save_db()
        return opp

    def _clean_contact_metric(self, c_dict: Optional[dict]) -> Optional[str]:
        if not c_dict:
            return None
        c_n = (c_dict.get("name") or "").strip()
        c_r = (c_dict.get("role") or "").strip()
        from app.api.v1.voice import is_generic_or_unknown_contact
        name_is_valid = bool(c_n) and not is_generic_or_unknown_contact(c_n)
        role_is_valid = bool(c_r) and not is_generic_or_unknown_contact(c_r)
        if not name_is_valid and not role_is_valid:
            return None
        if name_is_valid and role_is_valid:
            return f"{c_n} ({c_r})"
        return c_n if name_is_valid else c_r

    def get_pending_gates(self) -> List[PendingGateSummary]:
        self._check_and_reload()
        pending = []
        for opp_id, opp in self.opportunities.items():
            if opp.stage == PipelineStage.WAITING_HUMAN_APPROVAL and opp.current_gate:
                headline = f"Revisión requerida: {opp.current_gate.value}"
                agent_name = "Agente Especializado"
                recom = ""
                metrics = {}
                context_details = {}

                contacts_list = [
                    {
                        "name": c.name,
                        "role": c.role,
                        "email": c.email,
                        "phone": c.phone,
                        "linkedin_url": c.linkedin_url,
                        "status": c.status
                    }
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

                # Sanitización y verificación de contactos para Óptica Colombiana
                if "optica" in opp.company_name.lower():
                    # Eliminar el correo conjetural tecnologia@opticacolombiana.com que rebota por DBEB (550 5.4.1)
                    contacts_list = [c for c in contacts_list if "tecnologia@" not in (c.get("email") or "").lower()]
                    opp.contacts = [c for c in opp.contacts if "tecnologia@" not in (c.email or "").lower()]

                    if opp.outreach and "tecnologia@opticacolombiana.com" in opp.outreach.body_markdown:
                        opp.outreach.body_markdown = opp.outreach.body_markdown.replace(
                            "tecnologia@opticacolombiana.com", "comunicaciones@opticacolombiana.com"
                        )

                pain_points_list = opp.icp_data.pain_points if opp.icp_data else []
                stack_list = opp.icp_data.current_stack if opp.icp_data else []

                if opp.current_gate == GateType.GATE_1_TARGET:
                    headline = f"Validación de Target: {opp.company_name}"
                    agent_name = "Scraper & Enricher Agent"
                    first_c = contacts_list[0] if contacts_list else None
                    contact_val = self._clean_contact_metric(first_c)
                    contact_summary = f" • Contacto: {contact_val}" if contact_val else ""
                    recom = f"Ajuste ICP {opp.icp_data.fit_score}/100. Industria: {opp.icp_data.industry}.{contact_summary}"
                    metrics = {
                        "fit_score": opp.icp_data.fit_score,
                        "stack": opp.icp_data.current_stack,
                        "contact": contact_val,
                        "phone": first_c.get("phone") if first_c else None,
                        "email": first_c.get("email") if first_c else None,
                        "address": opp.address,
                        "tax_id": opp.tax_id
                    }
                    context_details = {
                        "pain_points": pain_points_list,
                        "stack": stack_list,
                        "contacts": contacts_list,
                        "address": opp.address,
                        "tax_id": opp.tax_id,
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

                    # Asegurar presencia de whatsapp_message y call_script (Kit multicanal PyME)
                    if opp.outreach and (not getattr(opp.outreach, "whatsapp_message", None) or not getattr(opp.outreach, "call_script", None)):
                        target_name = contacts_list[0]["name"] if contacts_list else "Gerente General"
                        target_role = contacts_list[0]["role"] if contacts_list else "Representante Legal"
                        from app.graph.nodes.sdr import _fill_sme_fallbacks_if_missing
                        _fill_sme_fallbacks_if_missing(opp, target_name, target_role)

                    recom = opp.outreach.body_markdown if (opp.outreach and opp.outreach.body_markdown) else "Borrador de comunicación corporativa listo."
                    channel_label = opp.outreach.channel if (opp.outreach and opp.outreach.channel) else ("WHATSAPP / LLAMADA" if not opp.website else "EMAIL")
                    first_c = contacts_list[0] if contacts_list else {}
                    contact_val = self._clean_contact_metric(first_c)
                    metrics = {
                        "channel": channel_label,
                        "subject": opp.outreach.subject if opp.outreach else "Sin asunto",
                        "contact": contact_val,
                        "phone": first_c.get("phone"),
                        "email": first_c.get("email"),
                        "address": opp.address
                    }
                    context_details = {
                        "subject": opp.outreach.subject if opp.outreach else "",
                        "body_markdown": opp.outreach.body_markdown if opp.outreach else "",
                        "whatsapp_message": getattr(opp.outreach, "whatsapp_message", None),
                        "call_script": getattr(opp.outreach, "call_script", None),
                        "channel": channel_label,
                        "contacts": contacts_list,
                        "address": opp.address,
                        "tax_id": opp.tax_id,
                        "pain_points": pain_points_list,
                        "is_sme": not bool(opp.website)
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
        if opp_id not in self.opportunities:
            logger.error(f"[OpportunityService] Oportunidad {opp_id} no encontrada en DB")
            return None

        opp = self.opportunities[opp_id]
        config = {"configurable": {"thread_id": opp_id}}
        state_snapshot = sales_pipeline_graph.get_state(config)

        # Si el hilo en memoria de LangGraph está vivo y detenido en una compuerta activa
        has_active_interrupt = bool(state_snapshot and state_snapshot.values and state_snapshot.next)

        if has_active_interrupt:
            try:
                resume_payload = {
                    "action": payload.action.value,
                    "feedback": payload.feedback,
                    "modifications": payload.modifications,
                    "user_name": payload.user_name
                }
                logger.info(f"Reanudando grafo activo para {opp_id} con acción {payload.action.value}...")
                sales_pipeline_graph.invoke(Command(resume=resume_payload), config=config)

                new_state = sales_pipeline_graph.get_state(config)
                if new_state and new_state.values:
                    updated_opp = new_state.values.get("opportunity")
                    if updated_opp:
                        self.opportunities[opp_id] = updated_opp
                        self._save_db()
                        return updated_opp
            except Exception as e:
                logger.warning(f"Excepción al reanudar LangGraph en memoria ({e}). Aplicando avance determinístico seguro...")

        # Avance determinístico tolerante a caídas de memoria o reinicios del proceso
        updated_opp = self._advance_gate_deterministic(opp, payload)
        self.opportunities[opp_id] = updated_opp
        self._save_db()
        return updated_opp

    def regress_opportunity_gate(
        self,
        opp_id: str,
        target_gate: GateType,
        reason: str,
        user_name: str = "Director Comercial (Comando Central)"
    ) -> OpportunityContext:
        """Devuelve un prospecto a una compuerta previa con registro de auditoría."""
        self._check_and_reload()
        if opp_id not in self.opportunities:
            raise ValueError(f"Oportunidad con ID '{opp_id}' no encontrada.")
        opp = self.opportunities[opp_id]
        payload = GateDecisionPayload(
            action=GateAction.REGRESS,
            target_gate=target_gate,
            feedback=reason,
            user_name=user_name
        )
        return self._advance_gate_deterministic(opp, payload)

    def _advance_gate_deterministic(
        self,
        opp: OpportunityContext,
        payload: GateDecisionPayload
    ) -> OpportunityContext:
        action = payload.action
        current_gate = opp.current_gate
        user_name = payload.user_name or "Director Comercial (Comando Central)"
        feedback = payload.feedback
        modifications = payload.modifications or {}

        # 1. Registrar decisión humana en el historial inmutable de la oportunidad
        opp.gate_history.append(
            GateHistoryRecord(
                gate_type=current_gate or GateType.GATE_1_TARGET,
                action=action,
                user_name=user_name,
                feedback=feedback,
                timestamp=datetime.now(timezone.utc)
            )
        )
        opp.updated_at = datetime.now(timezone.utc)

        # 2. OVERRIDE: Toma de control manual del flujo
        if action == GateAction.OVERRIDE:
            opp.stage = PipelineStage.MANUAL_TAKEOVER
            return opp

        # 3. REGRESS: Devolver la oportunidad a una compuerta previa
        if action == GateAction.REGRESS:
            target = payload.target_gate
            if not target and modifications and modifications.get("target_gate"):
                try:
                    target = GateType(modifications["target_gate"])
                except Exception:
                    pass
            if not target:
                raise ValueError("Se requiere especificar 'target_gate' para la acción REGRESS")
            
            logger.info(f"[OpportunityService] Devolviendo {opp.opportunity_id} de {current_gate} a {target} (Motivo: {feedback})")
            opp.current_gate = target
            opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
            opp.last_human_feedback = feedback
            self._save_db()
            return opp

        # 3. MODIFY: Aplicar feedback y re-ejecutar el agente actual
        if action == GateAction.MODIFY:
            opp.last_human_feedback = feedback
            state = AgentState(
                opportunity=opp,
                human_action=action,
                human_feedback=feedback,
                human_modifications=modifications
            )
            if current_gate == GateType.GATE_1_TARGET:
                new_state = enricher_agent_node(state)
                return new_state.opportunity
            elif current_gate == GateType.GATE_2_OUTREACH:
                new_state = sdr_agent_node(state)
                return new_state.opportunity
            elif current_gate == GateType.GATE_3_DISCOVERY:
                new_state = discovery_agent_node(state)
                return new_state.opportunity
            elif current_gate == GateType.GATE_4_ARCHITECT:
                if opp.solution_proposal and "discount_percentage" in modifications:
                    try:
                        opp.solution_proposal.discount_percentage = float(modifications["discount_percentage"])
                    except (ValueError, TypeError):
                        pass
                new_state = solutions_architect_agent_node(state)
                return new_state.opportunity
            elif current_gate == GateType.GATE_5_LEGAL:
                new_state = legal_agent_node(state)
                return new_state.opportunity
            return opp

        # 4. APPROVE: Avanzar la oportunidad hacia la siguiente fase
        state = AgentState(
            opportunity=opp,
            human_action=action,
            human_feedback=feedback,
            human_modifications=modifications
        )

        if current_gate == GateType.GATE_1_TARGET:
            # Gate 1 Aprobado -> SDR Agent redacta comunicación personalizada -> Pausar en Gate 2
            new_state = sdr_agent_node(state)
            opp = new_state.opportunity
            opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
            opp.current_gate = GateType.GATE_2_OUTREACH

        elif current_gate == GateType.GATE_2_OUTREACH:
            # Gate 2 Aprobado (Confirmar Envío Outlook / WhatsApp / Teléfono) -> Discovery Agent -> Pausar en Gate 3
            if modifications and isinstance(modifications, dict):
                if modifications.get("final_subject") and opp.outreach:
                    opp.outreach.subject = str(modifications["final_subject"]).strip()
                if modifications.get("final_body") and opp.outreach:
                    opp.outreach.body_markdown = str(modifications["final_body"]).strip()
                if modifications.get("channel") and opp.outreach:
                    opp.outreach.channel = str(modifications["channel"]).strip()
                if modifications.get("recipient") and opp.contacts:
                    val = str(modifications["recipient"]).strip()
                    if "@" in val:
                        opp.contacts[0].email = val
                    elif val:
                        opp.contacts[0].phone = val
            if opp.outreach:
                opp.outreach.sent_at = datetime.now(timezone.utc)
            opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
            opp.current_gate = GateType.GATE_3_DISCOVERY
            new_state = discovery_agent_node(state)
            opp = new_state.opportunity
            opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
            opp.current_gate = GateType.GATE_3_DISCOVERY

        elif current_gate == GateType.GATE_3_DISCOVERY:
            # Gate 3 Aprobado -> Solutions Architect -> Propuesta Técnica y Pricing -> Pausar en Gate 4
            new_state = solutions_architect_agent_node(state)
            opp = new_state.opportunity
            opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
            opp.current_gate = GateType.GATE_4_ARCHITECT

        elif current_gate == GateType.GATE_4_ARCHITECT:
            # Gate 4 Aprobado -> Deal Desk & Legal Agent -> Contrato y SLA -> Pausar en Gate 5
            new_state = legal_agent_node(state)
            opp = new_state.opportunity
            opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
            opp.current_gate = GateType.GATE_5_LEGAL

        elif current_gate == GateType.GATE_5_LEGAL:
            # Gate 5 Aprobado -> Acuerdo Firmado y Venta Ganada (WON)
            opp.stage = PipelineStage.WON
            opp.current_gate = None

        return opp


# Singleton
opportunity_service = OpportunityService()
