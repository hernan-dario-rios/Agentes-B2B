import json
import logging
import os
from datetime import datetime, timezone
from app.graph.state import AgentState
from app.schemas.gate import GateType
from app.schemas.opportunity import PipelineStage, SolutionProposal, ServiceCategory
from app.core.llm import get_chat_model
from app.core.config import settings
from app.services.rag_service import technical_rag_service

logger = logging.getLogger(__name__)


def solutions_architect_agent_node(state: AgentState) -> AgentState:
    """
    Agente 4: Solutions Architect Agent.
    Cruza los requerimientos validados con el catálogo de servicios y la matriz
    de dimensionamiento técnico de DocumentTrack (RAG), dimensiona la arquitectura,
    estima costos y redacta la propuesta técnico-comercial.
    """
    opp = state.opportunity
    logger.info(f"[Solutions Architect Agent] Diseñando propuesta técnica para {opp.company_name}")
    
    # 1. RAG Context: Dimensionamiento de Infraestructura DocumentTrack
    # Estimar volumen mensual a partir del Discovery o usar promedio de 15,000 docs
    estimated_volume = 15000
    if opp.discovery and opp.discovery.need:
        # Si se menciona volumen en el need
        need_text = opp.discovery.need.lower()
        if "50,000" in need_text or "100,000" in need_text or "masivo" in need_text:
            estimated_volume = 75000
        elif "3,000" in need_text or "5,000" in need_text:
            estimated_volume = 4000

    rag_technical_context = technical_rag_service.retrieve_full_context(
        query=opp.company_name,
        estimated_monthly_docs=estimated_volume
    )
    
    # Cargar catálogo de servicios de INNOVAIT
    catalog_path = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "services_catalog.json")
    catalog_content = "{}"
    if os.path.exists(catalog_path):
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog_content = f.read()

    feedback_note = f" Considerar feedback de pricing/alcance humano: '{state.human_feedback}'" if state.human_feedback else ""
    modifications = state.human_modifications or {}
    
    llm = get_chat_model(settings.DEFAULT_REASONING_MODEL)
    if llm:
        prompt = f"""
        Actúa como el Principal Solutions Architect y Lead Pre-Sales Engineer de INNOVAIT.
        Catálogo oficial de servicios:
        {catalog_content}

        MATRIZ DE DIMENSIONAMIENTO OFICIAL DOCUMENTTRACK (RAG):
        {rag_technical_context}

        Oportunidad:
        - Empresa: {opp.company_name}
        - Requerimientos técnicos: {opp.discovery.technical_requirements if opp.discovery else []}
        - Presupuesto y tiempos: {opp.discovery.budget if opp.discovery else 'No definido'} / {opp.discovery.timeline if opp.discovery else '8 semanas'}
        {feedback_note}
        Ajustes humanos directos: {json.dumps(modifications)}

        Diseña la arquitectura técnica de solución y propuesta comercial basándote ESTRICTAMENTE en la matriz de dimensionamiento de DocumentTrack (las 4 capas lógicas: Web/App, Worker, Data y Storage, y el tier adecuado).
        Responde en formato JSON estricto:
        - target_services (lista con subconjunto de ["DOC_MANAGER", "DATA_HYGIENE", "CLOUD_INFRA", "AI_AUTOMATION"])
        - architecture_overview (descripción técnica detallada con desglose de instancias, PostgreSQL, S3/Glacier y seguridad ISO 27001)
        - recommended_packages (lista de paquetes seleccionados del catálogo y tier de DocumentTrack)
        - pricing: objeto con (implementation_fee_usd, monthly_or_annual_license_usd, managed_services_monthly_usd, currency="USD")
        - timeline_weeks (int)
        - deliverables (lista de 4 entregables clave)
        - discount_percentage (float)
        - technical_risks (lista de 2 riesgos técnicos identificados y su mitigación)
        """
        try:
            response = llm.invoke(prompt)
            content = response.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            
            services = [ServiceCategory(s) for s in data.get("target_services", ["DOC_MANAGER"])]
            opp.solution_proposal = SolutionProposal(
                target_services=services,
                architecture_overview=data.get("architecture_overview", ""),
                recommended_packages=data.get("recommended_packages", []),
                pricing=data.get("pricing", {}),
                timeline_weeks=data.get("timeline_weeks", 8),
                deliverables=data.get("deliverables", []),
                discount_percentage=data.get("discount_percentage", 0.0),
                technical_risks=data.get("technical_risks", [])
            )
        except Exception as e:
            logger.warning(f"Error procesando LLM en Architect, usando fallback heurístico: {e}")
            _apply_fallback_architecture(opp, modifications, estimated_volume)
    else:
        _apply_fallback_architecture(opp, modifications, estimated_volume)

    opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
    opp.current_gate = GateType.GATE_4_ARCHITECT
    opp.updated_at = datetime.now(timezone.utc)
    
    state.reasoning_logs.append(
        f"Solutions Architect completó propuesta técnica basada en dimensionamiento DocumentTrack para {opp.company_name}. Listo para Gate 4."
    )
    return state


def _apply_fallback_architecture(opp, modifications, estimated_volume=15000):
    tier_info = technical_rag_service.retrieve_sizing_tier(estimated_volume)
    tier = tier_info.get("selected_tier", {})
    tier_name = tier.get("tier_name", "Tier 2: Intermedio")
    
    base_impl = modifications.get("implementation_fee_usd", 6800)
    base_license = modifications.get("monthly_or_annual_license_usd", 18000)
    discount = modifications.get("discount_percentage", 10.0)
    
    opp.solution_proposal = SolutionProposal(
        target_services=[ServiceCategory.DOC_MANAGER, ServiceCategory.DATA_HYGIENE, ServiceCategory.CLOUD_INFRA],
        architecture_overview=(
            f"Arquitectura DocumentTrack desplegada en AWS bajo especificación '{tier_name}': "
            f"1) Capa App & Worker: {tier.get('app_worker_spec')}. "
            f"2) Capa Base de Datos: {tier.get('database_spec')}. "
            f"3) Capa de Almacenamiento: {tier.get('storage_policy')}. "
            f"4) Seguridad & Continuidad (ISO 27001): {tier.get('network_security')}, cifrado AES-256 en reposo y TLS 1.2+ en tránsito."
        ),
        recommended_packages=[
            f"INNOVAIT DocumentTrack ({tier_name} - Facturas, OCR & Validación CUFE)",
            "Servicio Especializado de Depuración y Normalización de BD (Standard Cleansing)",
            "Cloud Landing Zone & Managed Cloud Support"
        ],
        pricing={
            "implementation_fee_usd": base_impl,
            "annual_license_usd": base_license,
            "managed_services_monthly_usd": 1200,
            "currency": "USD"
        },
        timeline_weeks=7,
        deliverables=[
            f"Despliegue de plataforma DocumentTrack contenerizada en Docker ({tier_name})",
            "Limpieza y deduplicación de base de datos transaccional previa a la migración",
            "Configuración de almacenamiento S3 con políticas de transición automática a Glacier a 90 días",
            "Garantía de cumplimiento normativo ISO 27001 y capacitación a usuarios"
        ],
        discount_percentage=discount,
        technical_risks=[
            "Riesgo: Picos de concurrencia en recepción de facturas. Mitigación: Desacople asíncrono con colas Redis y Auto-Scaling en nodos worker.",
            "Riesgo: Cuello de botella en validación CUFE/XML. Mitigación: Mecanismo de reintentos exponenciales con trazabilidad estructurada de logs."
        ]
    )
