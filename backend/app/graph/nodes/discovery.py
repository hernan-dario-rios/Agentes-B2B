import json
import logging
from datetime import datetime, timezone
from app.graph.state import AgentState
from app.schemas.gate import GateType
from app.schemas.opportunity import PipelineStage, DiscoveryBANT
from app.core.llm import get_chat_model

logger = logging.getLogger(__name__)


def discovery_agent_node(state: AgentState) -> AgentState:
    """
    Agente 3: Discovery & Triage Agent.
    Procesa notas de reunión, extrae requerimientos técnicos y califica criterios BANT/MEDDIC.
    """
    opp = state.opportunity
    logger.info(f"[Discovery Agent] Procesando notas de descubrimiento de {opp.company_name}")
    
    feedback_note = f" Considerar feedback humano: '{state.human_feedback}'" if state.human_feedback else ""
    
    # Supongamos que hay notas o un resumen preliminar
    existing_notes = (
        opp.discovery.meeting_transcript_summary 
        if opp.discovery and opp.discovery.meeting_transcript_summary 
        else "Reunión de exploración técnica inicial con líder de operaciones."
    )
    
    llm = get_chat_model()
    if llm:
        prompt = f"""
        Actúa como un Consultor Preventa y Especialista en Calificación de Oportunidades B2B.
        Analiza las notas y el perfil de la cuenta {opp.company_name}:
        - Stack actual: {', '.join(opp.icp_data.current_stack)}
        - Dolores: {', '.join(opp.icp_data.pain_points)}
        - Notas de interacción: {existing_notes}
        {feedback_note}

        Extrae la calificación BANT y los requerimientos técnicos estructurados.
        Responde en formato JSON:
        - budget (string: rango de presupuesto estimado)
        - authority (string: quién decide y quién firma)
        - need (string: dolor principal cuantificado)
        - timeline (string: plazo esperado para entrar en producción)
        - technical_requirements (lista de 3 requerimientos técnicos concretos)
        - critical_success_factors (lista de 2 factores de éxito)
        - meeting_transcript_summary (resumen ejecutivo de 3 oraciones)
        """
        try:
            response = llm.invoke(prompt)
            content = response.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            opp.discovery = DiscoveryBANT(
                budget=data.get("budget", "Presupuesto CAPEX/OPEX estimado entre 15k y 35k USD"),
                authority=data.get("authority", "Director de Operaciones evalúa; Gerente General aprueba"),
                need=data.get("need", "Centralizar expedientes y sanear base de datos para auditoría"),
                timeline=data.get("timeline", "Puesta en marcha requerida en 6 a 8 semanas"),
                technical_requirements=data.get("technical_requirements", []),
                critical_success_factors=data.get("critical_success_factors", []),
                meeting_transcript_summary=data.get("meeting_transcript_summary", "")
            )
        except Exception as e:
            logger.warning(f"Error procesando LLM en Discovery, usando fallback: {e}")
            _apply_fallback_discovery(opp)
    else:
        _apply_fallback_discovery(opp)

    opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
    opp.current_gate = GateType.GATE_3_DISCOVERY
    opp.updated_at = datetime.now(timezone.utc)
    
    state.reasoning_logs.append(
        f"Discovery Agent completó el diagnóstico técnico BANT de {opp.company_name}. Listo para Gate 3."
    )
    return state


def _apply_fallback_discovery(opp):
    opp.discovery = DiscoveryBANT(
        budget="USD $20,000 - $35,000 (Presupuesto anual asignado para modernización de TI)",
        authority="Carlos Mendoza (Director de TI) lidera comité evaluador técnico; Gerente General firma contrato final",
        need="Urgencia por reemplazar archivo físico de 100,000 expedientes y depurar 250,000 registros duplicados antes de auditoría anual",
        timeline="Plazo máximo de salida a producción: 8 semanas",
        technical_requirements=[
            "OCR multiformato con indexación automática de metadata para cartas de porte y facturas",
            "Módulo de deduplicación con tolerancia a fallas de escritura sobre SQL Server",
            "Alojamiento cloud con alta disponibilidad y respaldo cifrado"
        ],
        critical_success_factors=[
            "Cero pérdida de expedientes históricos durante la migración",
            "Capacitación de 40 usuarios administrativos en menos de 2 semanas"
        ],
        meeting_transcript_summary="El cliente expresó gran frustración por pérdida de documentos en bodegas físicas y duplicidad de facturación. Buscan una solución integral llave en mano que combine la plataforma documental y el orden de su base de datos."
    )
