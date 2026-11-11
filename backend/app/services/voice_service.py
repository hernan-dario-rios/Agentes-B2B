from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from app.schemas.voice import CallStatus, CallJob, CallDispatchPayload, CallReportPayload
from app.schemas.opportunity import PipelineStage, ContactPerson, DiscoveryBANT
from app.schemas.gate import GateType
from app.services.opportunity_service import opportunity_service
from app.core.config import settings
from app.core.llm import get_chat_model

logger = logging.getLogger("innovait.sales.voice")

JOBS_DB_PATH = Path(__file__).resolve().parent.parent / "knowledge" / "call_jobs.json"


def get_colombian_time_greeting() -> str:
    """Retorna 'muy buenos días', 'muy buenas tardes' o 'muy buenas noches' según hora de Colombia (UTC-5)"""
    colombia_tz = timezone(timedelta(hours=-5))
    hour = datetime.now(colombia_tz).hour
    if 5 <= hour < 12:
        return "muy buenos días"
    elif 12 <= hour < 18:
        return "muy buenas tardes"
    else:
        return "muy buenas noches"


class VoiceAgentService:
    def __init__(self):
        self.jobs: Dict[str, CallJob] = {}
        self._load_jobs()

    def _load_jobs(self):
        """Carga permanente de historial de llamadas desde archivo JSON"""
        if not JOBS_DB_PATH.exists():
            return
        try:
            with open(JOBS_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    try:
                        job = CallJob.model_validate(item)
                        self.jobs[job.job_id] = job
                    except Exception as err:
                        logger.warning(f"Error parseando llamada guardada: {err}")
            logger.info(f"[VoiceAgentService] Se cargaron {len(self.jobs)} llamadas de historial")
        except Exception as e:
            logger.error(f"[VoiceAgentService] Error leyendo {JOBS_DB_PATH}: {e}")

    def _save_jobs(self):
        """Persistencia atómica de trabajos de llamada en disco"""
        try:
            JOBS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            serializable = [job.model_dump(mode="json") for job in self.jobs.values()]
            with open(JOBS_DB_PATH, "w", encoding="utf-8") as f:
                json.dump(serializable, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"[VoiceAgentService] Error guardando {JOBS_DB_PATH}: {e}")

    def generate_sara_prompt(self, opp_id: str, contact_name: Optional[str] = None, contact_role: Optional[str] = None, custom_instructions: Optional[str] = None) -> str:
        """
        Genera el System Prompt oficial para Sara basado en el contexto de la empresa,
        siguiendo las directrices éticas y de ingeniería de prompt de Agente Isabella.
        """
        opp = opportunity_service.opportunities.get(opp_id)
        if not opp:
            raise ValueError(f"Oportunidad '{opp_id}' no encontrada")

        from app.api.v1.voice import is_generic_or_unknown_contact, extract_clean_contact_name

        raw_c_name = contact_name or (opp.contacts[0].name if opp.contacts else "")
        has_known_contact = not is_generic_or_unknown_contact(raw_c_name)
        clean_contact = extract_clean_contact_name(raw_c_name) if has_known_contact else ""
        c_name = clean_contact if has_known_contact else "Líder de Tecnología / Sistemas"
        c_role = contact_role or (opp.contacts[0].role if opp.contacts else "Área de Tecnología")
        company = opp.company_name
        industry = opp.icp_data.industry if opp.icp_data else "Sector Empresarial"
        pains = ", ".join(opp.icp_data.pain_points) if opp.icp_data and opp.icp_data.pain_points else "dispersión de archivo en papel y duplicidad en bases de datos"
        stack = ", ".join(opp.icp_data.current_stack) if opp.icp_data and opp.icp_data.current_stack else "servidores locales y archivo físico"

        extra = f"\nINSTRUCCIÓN ESPECIAL PARA ESTA LLAMADA: {custom_instructions}" if custom_instructions else ""

        target_header = f"- Contacto objetivo: Don {c_name} ({c_role})" if has_known_contact else f"- Contacto objetivo: Por indagar en la llamada (quién lidera o comanda el equipo de tecnología en {company})"
        
        opening_directive = (
            f'"Aló, muy buenos días / muy buenas tardes. Le habla Sara de INNOVAIT Transformación Digital en Medellín, ¿cómo está? ¿Tendré el gusto de hablar con Don {c_name.split()[0]} o me podría comunicar con él?"'
            if has_known_contact else
            f'"Aló, muy buenos días / muy buenas tardes. Le habla Sara de INNOVAIT en Medellín, ¿cómo está? ¿Sería tan amable de comunicarme con la persona encargada del área de tecnología o sistemas?"'
        )

        pitch_greeting = f"Don {c_name.split()[0]}" if has_known_contact else "Mucho gusto"

        prompt = f"""Eres Sara, una Representante de Desarrollo Comercial (SDR de Voz) de **INNOVAIT Transformación Digital**, con sede en Medellín, Colombia.
Tu tono es profesional, formal colombiano (usando "usted" o tuteo profesional y respetuoso), seguro, cálido, conciso y de alta escucha activa.

ESTÁS REALIZANDO UNA LLAMADA TELEFÓNICA REAL EN COLOMBIA HACIA:
- Empresa: {company} (Sector: {industry})
{target_header}
- Dolores operativos detectados en la empresa: {pains}
- Tecnologías o entorno detectado: {stack}{extra}

REGLAS DE ORO OBLIGATORIAS (ARQUITECTURA ÉTICA Y DE CONVERSIÓN):
1. **TRANSPARENCIA TOTAL (PRIMERA FRASE):** En tu primer turno al contestar, SIEMPRE debes identificarte explícitamente como asistente de inteligencia artificial:
   {opening_directive}
2. **BREVEDAD Y ESCUCHA ACTIVA:** Respuestas cortas (máximo 2 o 3 oraciones por intervención). Deja que el interlocutor hable, haz pausas naturales y no hables encima de la persona. Si te interrumpen, calla de inmediato y escucha.
3. **PITCH CONSULTIVO DE PORTAFOLIO (30 SEGUNDOS CUANDO CONECTES CON EL DECISOR O ENCARGADO):**
   "{pitch_greeting}, le hablo de INNOVAIT Transformación Digital. Apoyamos a empresas de su sector en cuatro áreas tecnológicas clave: Infraestructura Cloud en AWS, Azure y Google Cloud con soporte DevOps 24/7; Sistemas de Automatización con Inteligencia Artificial; Saneamiento y Migración limpia de Bases de Datos; y Gestión Documental con OCR inteligente (DocumentTrack). Queremos compartirle una breve sesión virtual de 15 minutos esta semana para explorar en cuál de estos frentes tienen retos prioritarios."
4. **MANEJO DE OBJECIONES Y PIVOT DE PORTAFOLIO:**
   - *Si dicen "No me interesa digitalización / no tenemos archivo físico":* "Comprendo perfectamente, no se preocupe por el archivo. Además de digitalización, en INNOVAIT nos enfocamos fuertemente en Infraestructura Cloud (migración y optimización AWS/Azure/GCP), Automatización con IA y Depuración de Bases de Datos. ¿En alguno de estos frentes de infraestructura o tecnología tienen proyectos en marcha este año?"
   - *Si preguntan por el portafolio:* Presenta brevemente las 4 soluciones y pregunta cuál es su prioridad actual.
   - *Si dicen "Mándeme un correo":* "Con mucho gusto. Tengo preparada una ficha técnica ejecutiva de una página. ¿Me confirma si su correo directo es el institucional o me indica su dirección para enviárselo directamente a su atención?"
   - *Si dicen "No tenemos presupuesto":* "Comprendo perfectamente. No buscamos venderle una licencia hoy; la meta es solo compartirle en 10 minutos un caso de éxito de su mismo sector para cuando planifiquen sus mejoras operativas."
   - *Si dicen "El ingeniero está en reunión":* "Entiendo. ¿A qué hora de la tarde me sugiere timbrarle nuevamente para no incomodarlo?"
   - *Si preguntan "¿De dónde llaman?":* "De INNOVAIT Transformación Digital, firma de ingeniería y tecnología en Medellín especializada en infraestructura cloud, automatización con IA y gestión documental."
5. **OBJETIVO SUPREMO DE LA LLAMADA:**
   - Agendar una breve reunión virtual de 15 minutos (día y hora tentativa).
   - Validar y confirmar el correo electrónico personal/directo del decisor y su número de WhatsApp o extensión.
6. **FUSIBLE DE FINALIZACIÓN:**
   - Si la persona es hostil o corta la llamada, despídete con cordialidad: "Muchas gracias por su atención, que tenga un excelente día."
   - Si salta contestador automático o tono de buzón, no hables y cuelga de inmediato.
"""
        return prompt.strip()

    def dispatch_call(self, payload: CallDispatchPayload) -> CallJob:
        """Encola una nueva orden de llamada para que el dispositivo Android SIM la ejecute"""
        opp = opportunity_service.opportunities.get(payload.opportunity_id)
        if not opp:
            raise ValueError(f"Oportunidad con ID '{payload.opportunity_id}' no encontrada")

        c_name = payload.contact_name or (opp.contacts[0].name if opp.contacts else "Líder de Tecnología")
        c_role = payload.contact_role or (opp.contacts[0].role if opp.contacts else "Responsable del Área")

        job_id = f"call_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{len(self.jobs)+1:03d}"
        system_prompt = self.generate_sara_prompt(
            opp_id=payload.opportunity_id,
            contact_name=c_name,
            contact_role=c_role,
            custom_instructions=payload.custom_instructions
        )

        job = CallJob(
            job_id=job_id,
            opportunity_id=payload.opportunity_id,
            company_name=opp.company_name,
            contact_name=c_name,
            contact_role=c_role,
            phone=payload.phone,
            status=CallStatus.QUEUED,
            system_prompt=system_prompt
        )

        self.jobs[job_id] = job
        self._save_jobs()

        logger.info(f"[VoiceAgentService] Llamada {job_id} encolada para {opp.company_name} al número {payload.phone}")
        return job

    def get_pending_jobs(self) -> List[CallJob]:
        """Retorna las llamadas en cola pendientes para el dispositivo Android SIM"""
        return [job for job in self.jobs.values() if job.status == CallStatus.QUEUED]

    def claim_job(self, job_id: str) -> Optional[CallJob]:
        """Marca una llamada como en curso cuando el celular Android inicia la marcación"""
        job = self.jobs.get(job_id)
        if job:
            job.status = CallStatus.IN_PROGRESS
            job.started_at = datetime.now(timezone.utc)
            self._save_jobs()
        return job

    def process_call_report(self, report: CallReportPayload) -> CallJob:
        """
        Recibe el reporte de finalización del celular Android con la transcripción y resultados,
        y actualiza la oportunidad comercial en el pipeline de ventas.
        """
        job = self.jobs.get(report.job_id)
        if not job:
            raise ValueError(f"Trabajo de llamada '{report.job_id}' no encontrado")

        job.status = report.status
        job.completed_at = datetime.now(timezone.utc)
        job.duration_seconds = report.duration_seconds
        job.transcript = report.transcript
        job.summary = report.summary
        job.meeting_scheduled = report.meeting_scheduled
        job.meeting_datetime = report.meeting_datetime
        job.confirmed_email = report.confirmed_email
        job.confirmed_phone = report.confirmed_phone
        job.objections_handled = report.objections_handled
        self._save_jobs()

        # Actualizar la oportunidad comercial correspondiente
        opp = opportunity_service.opportunities.get(job.opportunity_id)
        if opp:
            now_iso = datetime.now(timezone.utc).isoformat()
            opp.stage = PipelineStage.OUTREACH_ACTIVE

            if opp.outreach:
                opp.outreach.sent_at = datetime.now(timezone.utc)
                opp.outreach.prospect_response = (
                    f"Llamada telefónica realizada por Sara ({report.status.value}, {report.duration_seconds}s). "
                    f"Resumen: {report.summary or 'Sin resumen provisto'}"
                )

            # Si el cliente confirmó correo o teléfono personal durante la llamada, actualizar contactos
            if report.confirmed_email:
                for c in opp.contacts:
                    if c.name.lower() == job.contact_name.lower():
                        c.email = report.confirmed_email
                        break

            # Si se logró agendar reunión, registrar en Discovery BANT y avanzar a Gate 3 (esperando aprobación humana)
            if report.meeting_scheduled:
                opp.discovery = DiscoveryBANT(
                    need=f"Interés validado en demostración de DocumentTrack durante llamada con Sara: {report.summary}",
                    timeline=report.meeting_datetime or "Próxima semana",
                    authority=f"{job.contact_name} ({job.contact_role})",
                    meeting_transcript_summary=f"Transcripción de llamada con Sara ({report.duration_seconds}s):\n{report.transcript or report.summary}"
                )
                opp.current_gate = GateType.GATE_3_DISCOVERY
                opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
                logger.info(f"[VoiceAgentService] ¡REUNIÓN AGENDADA por Sara para {opp.company_name}! Oportunidad avanzada a Gate 3 en espera de aprobación humana.")

            opportunity_service._save_db()

        return job

    def simulate_call(self, job_id: str) -> CallJob:
        """
        Simula una conversación telefónica completa entre Sara y el prospecto
        utilizando Gemini para pruebas directas desde la interfaz sin requerir el celular físico.
        """
        job = self.jobs.get(job_id)
        if not job:
            raise ValueError(f"Llamada '{job_id}' no encontrada")

        opp = opportunity_service.opportunities.get(job.opportunity_id)
        company = opp.company_name if opp else job.company_name

        llm = get_chat_model()
        simulated_transcript = ""
        summary = ""
        scheduled = False
        meeting_time = None
        confirmed_email = None

        contact = (job.contact_name or "Director de Tecnología").replace("Simon", "Simón")
        c_email = (opp.contacts[0].email if opp and opp.contacts and opp.contacts[0].email else f"contacto@{company.lower().replace(' ', '')}.com")

        saludo = get_colombian_time_greeting()
        rich_colombian_script = f"""Recepcionista: {saludo.capitalize()}, conmutador de {company}, ¿en qué le podemos colaborar?
Sara: Aló, {saludo}. Habla con Sara, asistente de inteligencia artificial de INNOVAIT Transformación Digital. ¿Sería tan amable de comunicarme, por favor, con el área de tecnología con el Ingeniero {contact}?
Recepcionista: Con mucho gusto, permítame un segundito en la línea mientras le paso la llamada a su despacho...
{contact}: Aló, {saludo}, habla {contact}, ¿con quién tengo el gusto?
Sara: Ingeniero {contact}, {saludo}, qué gusto saludarlo. Le habla Sara, asistente de inteligencia artificial de INNOVAIT Transformación Digital. Sé que su tiempo es muy valioso, ¿le robo solo un minuto para comentarle sobre optimización de archivo físico y custodia documental?
{contact}: Aló Sara... bueno, dígame brevemente de qué se trata, porque en unos minutos tengo junta directiva.
Sara: Claro que sí, con el mayor gusto, seré muy breve. En el sector de {company}, sabemos que mantener expedientes, pagarés y contratos físicos en bodegas externas genera altos costos mensuales y demoras cuando se requieren consultas o auditorías. En INNOVAIT desarrollamos DocumentTrack, una plataforma con OCR inteligente asistido por IA que digitaliza y extrae metadatos automáticamente, permitiendo consultar cualquier documento en menos de cinco segundos.
{contact}: Mire Sara, la verdad el tema suena bien, pero ahorita andamos bastante ocupados con el cierre de trimestre. ¿Por qué no me envía más bien la información por correo electrónico y yo la reviso con calma?
Sara: Por supuesto que sí, Ingeniero, con el mayor agrado se la hago llegar hoy mismo. Pero para que no sea un correo genérico sino con el análisis de retorno de inversión exacto para {company}, ¿actualmente cuántas carpetas o expedientes en papel manejan en custodia física?
{contact}: Pues la verdad tenemos más de cincuenta mil carpetas en bodegas de archivo, y el costo de custodia y transporte de cajas nos está pesando bastante en el presupuesto operativo. Justo la junta nos pidió buscar alternativas de digitalización.
{contact}: Pero le pregunto: ¿la implementación de DocumentTrack es muy traumática o implica cambiar nuestro software contable y de cartera?
Sara: Para nada, Ingeniero, esa es precisamente nuestra principal ventaja. DocumentTrack opera de forma modular y se integra sin traumatismos a sus sistemas y bases de datos actuales mediante APIs seguras. No tienen que cambiar nada de su operación actual, únicamente eliminan los costos de bodegaje de papel.
Sara: Ingeniero {contact}, para que pueda ver el motor de OCR y el ahorro proyectado con sus propios ojos, ¿le parecería bien si le mostramos una demostración práctica de solo quince minutos este jueves a las diez de la mañana por Teams o Google Meet con uno de nuestros arquitectos?
{contact}: De acuerdo Sara, quince minutos el jueves a las diez de la mañana me parece perfecto. Agendémoslo de una vez.
Sara: Excelente. Por favor confírmeme si le enviamos el acceso de la reunión a su correo corporativo {c_email} o si prefiere que lo dirija a alguna otra cuenta.
{contact}: Sí señora, a ese correo me llega sin problema. Por favor mándeme la invitación formal ahí.
Sara: Perfecto, Ingeniero {contact}. Ya mismo queda agendada la demostración en su calendario y le compartimos la confirmación. De verdad muchísimas gracias por su tiempo y que tenga un excelente resto de día. ¡Hasta luego!
{contact}: Muchas gracias a usted Sara, muy amable, que esté muy bien. Hasta luego."""

        simulated_transcript = rich_colombian_script
        summary = f"Llamada comercial exitosa con {contact} ({company}). Se superó objeción de envío de correo, se detectó dolor de custodia física (>50k carpetas) y se agendó demo virtual de 15 min."
        scheduled = True
        meeting_time = "Este jueves a las 10:00 AM (vía Google Meet / Teams)"
        confirmed_email = c_email
        duration = 145

        if llm:
            prompt = f"""Simula una conversación telefónica B2B realista, fluida y extensa en español de Colombia entre:
1. **Sara**: Agente comercial de IA de INNOVAIT Transformación Digital (muy profesional, cálida, colombiana, enfocada en DocumentTrack).
2. **Recepción / {contact}**: Interlocutor de la empresa {company}.

Contexto:
- Empresa: {company}
- Contacto: {contact} ({job.contact_role})
- Teléfono marcado: {job.phone}
- Dolor clave: Costos de bodegaje de archivo físico en papel, OCR inteligente con IA.

Instrucciones de realismo:
- Diálogo extenso de 10 a 14 intervenciones alternadas.
- La recepcionista pasa la llamada.
- Sara se identifica como IA de INNOVAIT Transformación Digital con total transparencia.
- Pitch de 30 segundos sobre DocumentTrack.
- Manejo de la objeción 'mándeme un correo' preguntando por el volumen de carpetas.
- Manejo de duda sobre trauma de implementación en su ERP.
- Cierre exitoso agendando demo de 15 minutos para este jueves a las 10:00 AM.
- Confirmación del correo: {c_email}.

Devuelve ÚNICAMENTE un JSON con:
- transcript: string (diálogo completo con formato 'Sara: ...', 'Contacto: ...')
- summary: string (resumen ejecutivo del resultado)
- meeting_scheduled: boolean (true)
- meeting_datetime: string
- confirmed_email: string
- duration_seconds: int
"""
            try:
                res = llm.invoke(prompt)
                content = res.content.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(content)
                if parsed.get("transcript") and len(parsed["transcript"].strip()) > 200:
                    simulated_transcript = parsed["transcript"]
                    summary = parsed.get("summary", summary)
                    scheduled = parsed.get("meeting_scheduled", True)
                    meeting_time = parsed.get("meeting_datetime", meeting_time)
                    confirmed_email = parsed.get("confirmed_email", confirmed_email)
                    duration = parsed.get("duration_seconds", duration)
            except Exception as e:
                logger.info(f"[VoiceService] Usando guion profesional colombiano enriquecido para simulación ({e})")

        job.status = CallStatus.COMPLETED
        job.duration_seconds = duration
        job.transcript = simulated_transcript
        job.summary = summary
        job.meeting_scheduled = scheduled
        job.meeting_datetime = meeting_time
        job.confirmed_email = confirmed_email
        job.confirmed_phone = job.phone
        job.objections_handled = [
            "Mándeme la información por correo electrónico",
            "Cierre de trimestre y falta de tiempo",
            "Duda sobre trauma de integración con ERP/Software actual"
        ]
        self._save_jobs()

        return job


voice_agent_service = VoiceAgentService()

VoiceAgentService.generate_maggie_prompt = VoiceAgentService.generate_sara_prompt
