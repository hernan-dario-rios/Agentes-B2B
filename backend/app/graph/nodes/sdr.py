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
        Actúa como un Director Comercial y Consultor Senior Enterprise de INNOVAIT especializado en ventas consultivas B2B de tecnología.
        
        Nuestras soluciones empresariales son:
        - DocumentTrack (Plataforma Insignia de Gestión Documental Inteligente, motor OCR con IA, validación XML/CUFE y radicación electrónica)
        - Orden y Depuración de Bases de Datos (Data Hygiene, deduplicación algorítmica y saneamiento de registros)
        - Infraestructuras Cloud y Modernización (AWS/Azure, alta disponibilidad, respaldos inmutables y monitoreo 24/7)
        - Automatización de Procesos con IA

        Prospecto:
        - Empresa: {opp.company_name}
        - Contacto: {contact_name} ({contact_role})
        - Dolores detectados: {', '.join(opp.icp_data.pain_points)}
        - Stack técnico detectado: {', '.join(opp.icp_data.current_stack)}
        {feedback_note}

        Genera una comunicación ejecutiva formal y de alto nivel corporativo (Cold Outreach B2B), estructurada de la siguiente manera:
        1. Saludo formal y personalizado al contacto con su cargo corporativo.
        2. Reconocimiento respetuoso del liderazgo y expansión de la empresa en su sector.
        3. Identificación de los 3 dolores críticos que enfrentan en su operación (custodia de archivo físico/pagarés, calidad de datos y modernización tecnológica).
        4. Presentación ejecutiva de cómo INNOVAIT resuelve esos desafíos (destacando DocumentTrack, saneamiento de datos y modernización cloud).
        5. Llamado a la acción (CTA) cordial y consultivo proponiendo una breve sesión virtual de 15 minutos con opciones de agenda.
        6. Despedida formal con firma del Equipo de Soluciones Corporativas de INNOVAIT.

        Responde ÚNICAMENTE en formato JSON con:
        - subject (línea de asunto ejecutiva, formal y atractiva de 6 a 10 palabras)
        - body_markdown (cuerpo completo del correo con espaciado profesional, viñetas limpias y redacción impecable)
        - followup_variants (lista de 2 strings con opciones de seguimiento profesional a los 5 y 10 días)
        """
        try:
            response = llm.invoke(prompt)
            content = response.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            opp.outreach = OutreachSequence(
                channel="EMAIL",
                subject=data.get("subject", f"INNOVAIT | Eficiencia operativa y modernización tecnológica en {opp.company_name}"),
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
    subject = f"INNOVAIT | Transformación digital y eficiencia operativa en {opp.company_name}"
    
    body = f"""Estimado(a) {contact_name},
{contact_role} — {opp.company_name}

Es un placer saludarle.

Desde **INNOVAIT Tech Solutions**, hemos seguido de cerca la destacada trayectoria y el crecimiento de **{opp.company_name}** en el sector, reconociendo su continuo compromiso con la excelencia operativa y la calidad en el servicio a sus usuarios y asociados.

En organizaciones con altos volúmenes de transacciones, custodia de contratos y gestión de créditos como {opp.company_name}, los equipos de Tecnología y Operaciones suelen enfrentarse a desafíos estratégicos recurrentes:

1. **Gestión y Custodia Documental:** Dependencia de archivos físicos o expedientes dispersos en bodegas, con tiempos significativos en localización, validación manual de pagarés/facturas y riesgos en auditorías normativas.
2. **Calidad y Gobierno de Datos:** Inconsistencias, desnormalización y duplicidad de registros en bases de datos legacy, lo cual complejiza la reportería analítica y la toma de decisiones ágiles.
3. **Resiliencia de Infraestructura Tecnológica:** La necesidad imperativa de contar con entornos contenerizados de alta disponibilidad en la nube, con cifrado riguroso, políticas de respaldo inmutable ante ransomware y cumplimiento de estándares de seguridad (ISO 27001).

Para atender de manera integral estas necesidades, en **INNOVAIT** hemos desarrollado un ecosistema de soluciones empresariales especializadas:

• **DocumentTrack (Plataforma Insignia):** Sistema empresarial de gestión documental contenerizado, con motor OCR asistido por Inteligencia Artificial para digitalización inteligente, validación automática de documentos tributarios (XML/CUFE) y control de expedientes con trazabilidad completa.
• **Data Hygiene & Cleansing:** Servicios especializados de auditoría, normalización algorítmica y deduplicación masiva de bases de datos para garantizar información consistente y lista para auditorías.
• **Infraestructuras Cloud & Soporte 24/7:** Diseño, modernización y administración de arquitecturas seguras en la nube (AWS / Azure) con monitoreo proactivo y continuidad operativa garantizada.

Nos gustaría mucho coordinar una breve sesión de **15 minutos** esta semana para presentarnos formalmente, conocer sus prioridades actuales de modernización y evaluar cómo podemos sumar valor a la hoja de ruta tecnológica de **{opp.company_name}**.

¿Tendría disponibilidad este jueves en horas de la mañana o el viernes por la tarde para una breve conversación virtual?

Agradezco de antemano su tiempo y consideración.

Cordialmente,

**Equipo de Soluciones Corporativas**
INNOVAIT Tech Solutions
contacto@innovait.co | www.innovait.co"""

    opp.outreach = OutreachSequence(
        channel="EMAIL",
        subject=subject,
        body_markdown=body,
        followup_variants=[
            "Seguimiento ejecutivo compartiendo caso de éxito en reducción de tiempos de búsqueda documental y costos de bodegaje",
            "Consulta breve sobre si la prioridad actual del área de TI se enfoca en digitalización o en depuración de datos"
        ]
    )
