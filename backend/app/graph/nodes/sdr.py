import json
import logging
from datetime import datetime, timezone
from app.graph.state import AgentState
from app.schemas.gate import GateType
from app.schemas.opportunity import PipelineStage, OutreachSequence
from app.core.llm import get_chat_model

logger = logging.getLogger(__name__)


def sdr_agent_node(state: AgentState) -> AgentState:
    """
    Agente 2: SDR / Outreach Agent.
    Redacta secuencias multicanal ultra-personalizadas basadas en los hallazgos técnicos.
    """
    opp = state.opportunity
    contact = opp.contacts[0] if opp.contacts else None
    contact_name = contact.name if contact else "Líder de Tecnología"
    contact_role = contact.role if contact else "Responsable de TI"
    
    logger.info(f"[SDR Agent] Redactando outreach para {contact_name} en {opp.company_name}")
    
    feedback_note = f" Considerar retroalimentación humana previa: '{state.human_feedback}'" if state.human_feedback else ""
    
    llm = get_chat_model()
    if llm:
        prompt = f"""
        Actúa como un SDR Enterprise de INNOVAIT especializado en ventas B2B consultivas.
        Portafolio:
        - Gestión Documental Empresarial (INNOVAIT DocManager)
        - Orden y Depuración de Bases de Datos
        - Infraestructuras Cloud
        - Automatización con IA

        Prospecto:
        - Empresa: {opp.company_name}
        - Contacto: {contact_name} ({contact_role})
        - Dolores detectados: {', '.join(opp.icp_data.pain_points)}
        - Stack técnico: {', '.join(opp.icp_data.current_stack)}
        {feedback_note}

        Genera un correo en frío altamente personalizado, sin sonar a spam, enfocado en resolver uno o dos de sus dolores con cifras e impacto de negocio.
        Responde en JSON con:
        - subject (línea de asunto llamativa de menos de 8 palabras)
        - body_markdown (cuerpo del correo estructurado con saludo, gancho técnico, propuesta de valor y CTA suave de 15 min)
        - followup_variants (lista de 2 strings con ideas para emails de seguimiento)
        """
        try:
            response = llm.invoke(prompt)
            content = response.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            opp.outreach = OutreachSequence(
                channel="EMAIL",
                subject=data.get("subject", f"Optimización documental y operativa en {opp.company_name}"),
                body_markdown=data.get("body_markdown", ""),
                followup_variants=data.get("followup_variants", [])
            )
        except Exception as e:
            logger.warning(f"Error procesando LLM en SDR, usando fallback heurístico: {e}")
            _apply_fallback_outreach(opp, contact_name, contact_role)
    else:
        _apply_fallback_outreach(opp, contact_name, contact_role)

    opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
    opp.current_gate = GateType.GATE_2_OUTREACH
    opp.updated_at = datetime.now(timezone.utc)
    
    state.reasoning_logs.append(
        f"SDR Agent generó propuesta de correo para {contact_name} en {opp.company_name}. Listo para revisión humana."
    )
    return state


def _apply_fallback_outreach(opp, contact_name, contact_role):
    pain = opp.icp_data.pain_points[0] if opp.icp_data.pain_points else "gestión de expedientes críticos"
    opp.outreach = OutreachSequence(
        channel="EMAIL",
        subject=f"Solución a {pain.lower()} en {opp.company_name}",
        body_markdown=f"""Hola {contact_name},

Noté que en {opp.company_name} gestionan operaciones de alta demanda donde mantener el control de contratos y expedientes puede volverse un cuello de botella ({pain.lower()}).

En **INNOVAIT**, ayudamos a empresas con desafíos similares a centralizar expedientes con OCR inteligente y digitalización estructurada (**INNOVAIT DocManager**), reduciendo en más del 70% los tiempos de búsqueda y asegurando cumplimiento total.

¿Tendrías 15 minutos este jueves o viernes para compartirte cómo estructuramos este proceso sin interrumpir su operación actual?

Saludos cordiales,
**Equipo Comercial INNOVAIT**""",
        followup_variants=[
            "Seguimiento breve compartiendo caso de éxito en reducción de costos de almacenamiento",
            "Pregunta sobre si la gestión de expedientes o la calidad de la base de datos es su prioridad este trimestre"
        ]
    )
