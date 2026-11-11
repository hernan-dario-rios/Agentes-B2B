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
        Actúa como un Director Comercial y Consultor Senior de INNOVAIT especializado en prospección y ventas B2B de tecnología en Colombia.
        
        Nuestras soluciones empresariales son:
        - DocumentTrack (Plataforma Insignia de Gestión Documental Inteligente, motor OCR con IA, validación XML/CUFE y radicación electrónica)
        - Orden y Depuración de Bases de Datos (Data Hygiene, deduplicación algorítmica y saneamiento de registros)
        - Infraestructuras Cloud y Modernización (AWS/Azure, alta disponibilidad, respaldos inmutables y monitoreo 24/7)
        - Automatización de Procesos con IA

        Prospecto:
        - Empresa: {opp.company_name} (Sitio Web: {opp.website or 'No posee página web - Empresa PyME / Comercio Tradicional'})
        - Contacto: {contact_name} ({contact_role})
        - Dolores detectados: {', '.join(opp.icp_data.pain_points)}
        - Stack técnico detectado: {', '.join(opp.icp_data.current_stack)}
        {feedback_note}

        Genera un Kit Completo de Prospección Multicanal (Cold Outreach B2B adaptado a empresas grandes y PyMEs):
        1. subject (línea de asunto ejecutiva, formal y atractiva de 6 a 10 palabras)
        2. body_markdown (cuerpo completo del correo formal con espaciado profesional, viñetas limpias y propuesta de valor)
        3. whatsapp_message (mensaje persuasivo, directo y conciso para WhatsApp Business, adaptado a gerentes y dueños de empresas en Colombia)
        4. call_script (guion telefónico estructurado en 3 pasos: Paso 1 Filtro de recepción, Paso 2 Pitch al Gerente/Dueño de 30 segundos, Paso 3 Cierre para agendar demo de 15 minutos de DocumentTrack, y manejo de objeciones típicas)
        5. followup_variants (lista de 2 strings con opciones de seguimiento profesional a los 5 y 10 días)

        Responde ÚNICAMENTE en formato JSON estricto con las claves: subject, body_markdown, whatsapp_message, call_script, followup_variants.
        """
        try:
            response = llm.invoke(prompt)
            content = response.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            preferred_channel = "WHATSAPP / LLAMADA" if (not opp.website or not contact or not contact.email) else "EMAIL"
            opp.outreach = OutreachSequence(
                channel=preferred_channel,
                subject=data.get("subject", f"INNOVAIT | Eficiencia operativa y modernización documental en {opp.company_name}"),
                body_markdown=data.get("body_markdown", ""),
                whatsapp_message=data.get("whatsapp_message"),
                call_script=data.get("call_script"),
                followup_variants=data.get("followup_variants", [])
            )
            # Si el LLM omitió whatsapp_message o call_script, rellenarlos con fallback
            if not opp.outreach.whatsapp_message or not opp.outreach.call_script:
                _fill_sme_fallbacks_if_missing(opp, contact_name, contact_role)
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


def _build_sme_whatsapp_message(opp, contact_name: str) -> str:
    return (
        f"Hola {contact_name}, cordial saludo. Le saluda el equipo de Soluciones Corporativas de INNOVAIT.\n\n"
        f"Le escribimos porque sabemos que en empresas con el dinamismo y operación de *{opp.company_name}*, "
        f"uno de los mayores dolores de cabeza diarios es la acumulación de remisiones, facturas y carpetas de archivo físico, "
        f"además del desorden de datos de clientes entre sedes.\n\n"
        f"Con nuestra plataforma *DocumentTrack*, ayudamos a gerentes y directores de operaciones a digitalizar de forma automática con IA "
        f"todos sus expedientes con búsqueda instantánea en segundos, liberando espacio en bodegas y asegurando sus respaldos "
        f"en la nube sin costos desproporcionados.\n\n"
        f"¿Tendría 5 a 10 minutos esta semana para una breve demostración por computador? Quedo muy atento a su respuesta."
    )


def _build_sme_call_script(opp, contact_name: str) -> str:
    return (
        f"📞 GUION DE LLAMADA TELEFÓNICA (PROSPECCIÓN PYME / EMPRESAS SIN SITIO WEB)\n\n"
        f"[PASO 1: FILTRO DE RECEPCIÓN / ASISTENTE]\n"
        f"\"Buenos días / tardes, ¿me comunica por favor con la gerencia o despacho de don(ña) {contact_name}? "
        f"De parte de INNOVAIT sobre un asunto de modernización documental y control de sedes de {opp.company_name}.\"\n"
        f"• Si preguntan el motivo: \"Estamos coordinando una presentación de digitalización y respaldo cloud para la operación.\"\n\n"
        f"[PASO 2: CONEXIÓN CON EL GERENTE / TOMADOR DE DECISIÓN]\n"
        f"\"Don(ña) {contact_name}, qué tal, un saludo cordial. Le habla el equipo de Soluciones de INNOVAIT.\n"
        f"Lo llamo muy puntualmente porque apoyamos a empresas como {opp.company_name} a resolver el problema de acumulación "
        f"de carpetas, facturas físicas y remisiones en bodegas mediante nuestra plataforma DocumentTrack.\n"
        f"Además, les ayudamos a que su información contable y de clientes quede blindada y respaldada en la nube, y no en "
        f"computadores locales vulnerables a daños o virus.\"\n\n"
        f"[PASO 3: PREGUNTA DE CALIFICACIÓN Y CIERRE (15 MINUTOS)]\n"
        f"\"¿Ustedes actualmente tienen dolor de cabeza con el archivo físico o con documentos que se embolatan entre puntos de atención?\n"
        f"Me gustaría mostrarle en 10 o 15 minutos por computador cómo opera DocumentTrack y cómo les ahorra tiempo y costos de bodega. "
        f"¿Le queda mejor el martes en la mañana o el miércoles en la tarde?\"\n\n"
        f"[MANEJO DE OBJECIONES TÍPICAS]:\n"
        f"• 'Ya tenemos un software contable (Siigo / World Office / etc.)': -> 'Excelente, DocumentTrack no reemplaza su contabilidad, se integra para custodiar y extraer con OCR inteligente todos los papeles y facturas de soporte.'\n"
        f"• 'Envíeme la información por WhatsApp o correo': -> 'Con todo gusto don(ña) {contact_name}, ¿me confirma a qué número o correo se lo despacho hoy mismo? Y le pego una timbradita corta mañana para verificar que lo haya recibido bien.'"
    )


def _fill_sme_fallbacks_if_missing(opp, contact_name: str, contact_role: str):
    if not opp.outreach:
        return
    if not opp.outreach.whatsapp_message:
        opp.outreach.whatsapp_message = _build_sme_whatsapp_message(opp, contact_name)
    if not opp.outreach.call_script:
        opp.outreach.call_script = _build_sme_call_script(opp, contact_name)


def _apply_fallback_outreach(opp, contact_name, contact_role):
    subject = f"INNOVAIT | Transformación digital y eficiencia operativa en {opp.company_name}"
    
    body = f"""Estimado(a) {contact_name},
{contact_role} — {opp.company_name}

Es un placer saludarle.

Desde **INNOVAIT Transformación Digital**, hemos seguido de cerca la destacada trayectoria y el crecimiento de **{opp.company_name}** en el sector, reconociendo su continuo compromiso con la excelencia operativa y la calidad en el servicio a sus usuarios y asociados.

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
INNOVAIT Transformación Digital
contacto@innovait.co | www.innovait.co"""

    whatsapp_msg = _build_sme_whatsapp_message(opp, contact_name)
    call_script = _build_sme_call_script(opp, contact_name)
    preferred_channel = "WHATSAPP / LLAMADA" if (not opp.website or (opp.contacts and not opp.contacts[0].email)) else "EMAIL"

    opp.outreach = OutreachSequence(
        channel=preferred_channel,
        subject=subject,
        body_markdown=body,
        whatsapp_message=whatsapp_msg,
        call_script=call_script,
        followup_variants=[
            "Seguimiento por WhatsApp compartiendo caso de éxito en reducción de tiempos de búsqueda documental y costos de bodegaje",
            "Llamada telefónica corta de seguimiento para validar si recibió el mensaje y coordinar demo de 10 minutos"
        ]
    )
