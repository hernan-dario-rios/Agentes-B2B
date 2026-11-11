from __future__ import annotations

import os
import re
import json
import hashlib
import unicodedata
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.schemas.voice import (
    CallStatus,
    CallJob,
    CallDispatchPayload,
    CallReportPayload
)
from app.services.voice_service import voice_agent_service, get_chat_model
from app.services.opportunity_service import opportunity_service

logger = logging.getLogger("innovait.sales.voice")

TTS_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "knowledge" / "tts_cache"
TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def get_colombian_time_greeting() -> str:
    """
    Retorna el saludo formal en la zona horaria oficial de Colombia (America/Bogota, UTC-5):
    - 05:00 a 11:59 -> 'muy buenos días'
    - 12:00 a 17:59 -> 'muy buenas tardes'
    - 18:00 a 04:59 -> 'muy buenas noches'
    """
    colombia_tz = timezone(timedelta(hours=-5))
    hour = datetime.now(colombia_tz).hour
    if 5 <= hour < 12:
        return "muy buenos días"
    elif 12 <= hour < 18:
        return "muy buenas tardes"
    else:
        return "muy buenas noches"


router = APIRouter(prefix="/voice", tags=["Agente de Voz Sara (Llamadas B2B)"])


@router.post("/dispatch", response_model=CallJob)
def dispatch_call(payload: CallDispatchPayload):
    """
    Despacha una nueva orden de llamada hacia el teléfono móvil Android con SIM dedicada.
    Genera el System Prompt de Sara con el contexto específico de la empresa y dolor detectado.
    """
    try:
        return voice_agent_service.dispatch_call(payload)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"[VoiceRouter] Error despachando llamada: {e}")
        raise HTTPException(status_code=500, detail=f"Error despachando llamada: {str(e)}")


@router.get("/jobs", response_model=List[CallJob])
def list_call_jobs(opportunity_id: Optional[str] = Query(None, description="Filtrar por oportunidad")):
    """Retorna el historial completo de llamadas realizadas o en cola"""
    jobs = list(voice_agent_service.jobs.values())
    if opportunity_id:
        jobs = [j for j in jobs if j.opportunity_id == opportunity_id]
    return sorted(jobs, key=lambda j: j.created_at, reverse=True)


@router.get("/jobs/{job_id}", response_model=CallJob)
def get_call_job(job_id: str):
    """Retorna los detalles, transcripción y estado de una llamada específica"""
    job = voice_agent_service.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Trabajo de llamada '{job_id}' no encontrado")
    return job


@router.get("/pending", response_model=List[CallJob])
def get_pending_calls():
    """
    Endpoint consumido por el celular Android con la app de Sara.
    Devuelve las llamadas en cola listas para marcar por la tarjeta SIM física.
    """
    return voice_agent_service.get_pending_jobs()


@router.post("/claim/{job_id}", response_model=CallJob)
def claim_call_job(job_id: str):
    """El dispositivo Android notifica que empezó a marcar el número"""
    job = voice_agent_service.claim_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Trabajo de llamada '{job_id}' no encontrado")
    return job


@router.post("/report", response_model=CallJob)
def submit_call_report(report: CallReportPayload):
    """
    El dispositivo Android entrega la transcripción, duración y resultados tras colgar.
    Si se logró agendar cita o validar interés, la oportunidad se avanza a Gate 3 (Discovery).
    """
    try:
        return voice_agent_service.process_call_report(report)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"[VoiceRouter] Error procesando reporte de llamada: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando reporte: {str(e)}")


@router.get("/prompt/{opp_id}")
def get_opportunity_prompt(
    opp_id: str,
    contact_name: Optional[str] = Query(None),
    contact_role: Optional[str] = Query(None),
    custom_instructions: Optional[str] = Query(None)
):
    """Permite visualizar el System Prompt exacto con el que Sara abordará la llamada"""
    try:
        prompt_text = voice_agent_service.generate_sara_prompt(
            opp_id=opp_id,
            contact_name=contact_name,
            contact_role=contact_role,
            custom_instructions=custom_instructions
        )
        return {
            "opportunity_id": opp_id,
            "agent_name": "Sara",
            "voice": "Aoede (Gemini Live)",
            "system_prompt": prompt_text
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.post("/simulate/{opp_id}", response_model=CallJob)
def simulate_sara_call(opp_id: str, phone: Optional[str] = Query(None)):
    """
    Simula una llamada completa de Sara con el cliente usando IA para probar el flujo comercial,
    generar la transcripción y avanzar la oportunidad a Gate 3 sin necesidad del teléfono físico.
    """
    try:
        from app.services.opportunity_service import opportunity_service
        opp = opportunity_service.opportunities.get(opp_id)
        if not opp:
            raise HTTPException(status_code=404, detail=f"Oportunidad '{opp_id}' no encontrada")

        target_phone = phone or (opp.contacts[0].phone if opp.contacts and opp.contacts[0].phone else "+57 (604) 444 0000")
        c_name = opp.contacts[0].name if opp.contacts else "Director de Tecnología"
        c_role = opp.contacts[0].role if opp.contacts else "Líder del Área"

        dispatch_payload = CallDispatchPayload(
            opportunity_id=opp_id,
            phone=target_phone,
            contact_name=c_name,
            contact_role=c_role,
            custom_instructions="Simulación de prueba para validación comercial"
        )
        job = voice_agent_service.dispatch_call(dispatch_payload)
        return voice_agent_service.simulate_call(job.job_id)
    except Exception as e:
        logger.error(f"[VoiceRouter] Error en simulación: {e}")
        raise HTTPException(status_code=500, detail=f"Error en simulación: {str(e)}")


def phonetize_for_colombian_tts(text: str) -> str:
    """
    Ajusta nombres y términos técnicos para pronunciación fonética nativa en español de Colombia.
    Conserva el nombre propio 'Sara' fielmente sin sustituirlo por 'Magie' o 'Magi'.
    """
    # Simon -> Simón (enfatiza la tilde aguda en la 'ó' para evitar la pronunciación inglesa 'Saimon')
    text = re.sub(r'\bSimon\b', 'Simón', text)
    text = re.sub(r'\bsimon\b', 'simón', text)
    text = re.sub(r'\bSaimon\b', 'Simón', text)
    # Acrónimos técnicos comunes
    text = re.sub(r'\bOCR\b', 'O-C-R', text)
    text = re.sub(r'\bERP\b', 'E-R-P', text)
    text = re.sub(r'\bB2B\b', 'B dos B', text)
    text = re.sub(r'\bCUFE\b', 'Cúfe', text)
    text = re.sub(r'\bIA\b', 'I-A', text)
    return text


class ChatTurnRequest(BaseModel):
    opportunity_id: str = Field(..., description="ID de la oportunidad en conversación")
    user_message: str = Field(..., description="Lo que el usuario/cliente acaba de decir por voz")
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list, description="Historial de turnos previos")
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    company_name: Optional[str] = None


class DiscoveredContact(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    phone_or_ext: Optional[str] = None


class ChatTurnResponse(BaseModel):
    reply: str
    meeting_scheduled: bool = False
    meeting_datetime: Optional[str] = None
    is_farewell: bool = False
    interlocutor_label: Optional[str] = None
    discovered_contact: Optional[DiscoveredContact] = None


# DICCIONARIOS FONÉTICOS Y LÉXICOS PARA PARSEO RIGUROSO DE IDENTIDAD
NAME_ALIASES = {
    "herland": "Hernán",
    "hernand": "Hernán",
    "hernan": "Hernán",
    "hernando": "Hernando",
    "simon": "Simón",
}

COMMON_MALE_NAMES = {
    "hernan", "hernán", "herland", "hernand", "carlos", "simon", "simón", "wilson", "juan", "andres", "andrés",
    "felipe", "camilo", "jorge", "diego", "mauricio", "santiago", "alejandro", "fernando",
    "gabriel", "pedro", "luis", "david", "ricardo", "alberto", "daniel", "gustavo", "mario",
    "jose", "josé", "manuel", "rodrigo", "oscar", "óscar", "javier", "alvaro", "álvaro"
}

COMMON_FEMALE_NAMES = {
    "marcela", "daniela", "maria", "maría", "paola", "claudia", "sandra", "patricia",
    "carolina", "andrea", "laura", "camila", "valentina", "natalia", "diana", "monica", "mónica",
    "gloria", "adriana", "catalina", "lucia", "lucía", "esperanza", "liliana", "elena"
}

FORBIDDEN_WORDS = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "en", "para", "por", "con", "sin", "sobre",
    "y", "o", "u", "e", "pero", "mas", "que", "qué", "cual", "cuál", "quien", "quién", "como", "cómo", "donde", "dónde",
    "cuando", "cuándo", "cuanto", "cuánto", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas",
    "mi", "mis", "su", "sus", "tu", "tus", "nuestro", "nuestra", "él", "ella", "ellos", "ellas", "usted", "ustedes",
    "yo", "tú", "me", "te", "se", "nos", "le", "les", "lo",
    "hola", "aló", "alo", "buenos", "días", "dias", "tardes", "noches", "gracias",
    "disculpe", "perdón", "perdon", "pena", "mucho", "gusto", "orden", "bien", "bueno", "claro", "listo", "ok",
    "habla", "hablo", "hablan", "hablar", "llama", "llamo", "llaman", "llamar", "dice", "digo", "dicen", "decir",
    "dicho", "dije", "dijeron", "comenta", "comento", "comentar", "comenté", "cuenta", "cuento", "contar", "contó",
    "relata", "relátame", "relatame", "cuénteme", "cuenteme", "dígame", "digame", "coménteme", "comenteme",
    "es", "son", "era", "eran", "fue", "fueron", "sea", "sean", "soy", "eres", "somos", "ser", "estar", "está", "esta",
    "están", "estan", "estaba", "estaban", "ayudar", "ayuda", "ayudo", "colaborar", "colabora", "colaboro",
    "necesita", "necesitas", "necesito", "necesitan", "necesitar", "quiere", "quieres", "quiero", "quieren", "querer",
    "busca", "busco", "buscan", "buscar", "ubicar", "encuentra", "encuentro", "saber", "sé", "conocer", "conozco",
    "vende", "venden", "vendemos", "vender", "ofrece", "ofrecen", "ofrecer", "hace", "hacen", "hacer",
    "pasa", "paso", "pasar", "pásame", "paseme", "comunica", "comunico", "comunicar", "transferir",
    "ya", "he", "has", "ha", "había", "habia", "habíamos", "habian", "repito", "repetir", "reitero", "reiterar",
    "tema", "asunto", "llamada", "software", "sistema", "sistemas", "tecnología", "tecnologia", "empresa", "compañía",
    "plataforma", "programa", "servicio", "servicios", "solución", "solucion", "propuesta", "proyecto", "demo", "reunión",
    "reunion", "cita", "hora", "minuto", "segundo", "tiempo", "costo", "precio", "tarifa", "valor", "cotización",
    "cotizacion", "información", "informacion", "correo", "email", "mail", "teléfono", "telefono", "celular", "número",
    "numero", "contacto", "archivo", "expediente", "expedientes", "papel", "bodega", "bodegas", "caja", "cajas",
    "documento", "documentos", "pagaré", "pagares", "factura", "facturas", "ocr", "erp", "cufe", "b2b", "ia",
    "asistente", "secretaria", "recepcionista", "recepción", "recepcion", "conmutador", "operador", "operadora",
    "portería", "porteria", "seguridad", "vigilancia", "compras", "administración", "administracion", "gerencia",
    "dirección", "direccion", "presidencia", "financiera", "cartera", "tesorería", "tesoreria", "contabilidad",
    "ingeniero", "doctor", "doctora", "señor", "señora", "señorita", "persona", "hombre", "mujer", "compañero",
    "compañera", "socio", "jefe", "gerente", "director", "asesor", "asesora", "ejecutivo", "ejecutiva",
    "nada", "nadie", "ninguno", "ninguna", "algo", "alguien", "todo", "todos", "todas", "aquí", "aqui", "allí", "alli",
    "acá", "aca", "ahí", "ahi", "dentro", "fuera", "lejos", "cerca", "ahora", "hoy", "mañana", "tarde", "ayer",
    "más", "mas", "menos", "mucho", "poco", "bastante", "demasiado", "solo", "solamente", "únicamente", "unicamente",
    "parte", "partes", "lado", "lados", "caso", "momento", "manera", "forma", "razón", "razon", "motivo"
}


def extract_person_name(text: str) -> Optional[str]:
    """
    Extrae con extrema precisión el nombre de una persona si fue declarado,
    sin confundirse NUNCA con sustantivos de negocio, verbos, preguntas ni direcciones de correo electrónico.
    """
    # 0. Limpiar correos electrónicos hablados o escritos para que partes de la dirección (como 'arios' en arios@...) no se confundan con nombres
    txt_clean = re.sub(r'[\w.-]+@[\w.-]+', '', text)
    txt_clean = re.sub(r'\b(?:correo|email|electr[oó]nico|arroba|punto\s+com)\b', '', txt_clean, flags=re.IGNORECASE)
    txt = txt_clean.strip()
    if not txt:
        return None

    # 1. Patrón de Recordatorio / Reclamo:
    # "ya te lo había dicho Hernán Darío Ríos", "ya le dije que soy Hernán", "le repito que habla Carlos"
    m_remind = re.search(
        r'(?:ya\s+(?:te|le)\s+(?:lo\s+)?(?:había|habia|he)?\s*(?:dicho|comentado)|(?:le|te)\s+repito|ya\s+dije)\s+(?:que\s+(?:soy|hablas?|es)\s+)?([A-ZÁÉÍÓÚa-záéíóúñÑ]+(?:\s+[A-ZÁÉÍÓÚa-záéíóúñÑ]+)?)',
        txt, re.IGNORECASE
    )
    if m_remind:
        cand_str = m_remind.group(1).strip()
        first_token = cand_str.split()[0].lower()
        if first_token not in FORBIDDEN_WORDS and len(first_token) > 2:
            cand = cand_str.split()[0].capitalize()
            return NAME_ALIASES.get(cand.lower(), cand)

    # 2. Patrón de Auto-Presentación Explícita:
    # "hablas con Hernán", "habla con Hernán", "hablo con Hernán", "soy Carlos", "mi nombre es Marcela", "me llamo Daniela", "le habla Carlos", "te habla Carlos", "por acá habla Carlos", "con Hernán"
    m_intro = re.search(
        r'\b(?:mi\s+nombre\s+es|me\s+llamo|soy|yo\s+soy|hablas?\s+con|hablas?|hablo\s+con|le\s+habla|te\s+habla|aquí\s+habla|aqui\s+habla|acá\s+habla|aca\s+habla|por\s+acá|por\s+aca|por\s+aquí|por\s+aqui|con|este\s+es|se\s+comunica\s+con|te\s+comunicas\s+con)\s+([A-ZÁÉÍÓÚa-záéíóúñÑ]+(?:\s+[A-ZÁÉÍÓÚa-záéíóúñÑ]+)?)',
        txt, re.IGNORECASE
    )
    if m_intro:
        cand_str = m_intro.group(1).strip()
        first_token = cand_str.split()[0].lower()
        if first_token not in FORBIDDEN_WORDS and len(first_token) > 2:
            cand = cand_str.split()[0].capitalize()
            return NAME_ALIASES.get(cand.lower(), cand)

    # 3. Escaneo directo de nombres propios conocidos en cualquier parte del texto:
    tokens = re.findall(r'[A-ZÁÉÍÓÚa-záéíóúñÑ]+', txt)
    for idx_t, t in enumerate(tokens):
        t_low = t.lower()
        if t_low in COMMON_MALE_NAMES or t_low in COMMON_FEMALE_NAMES:
            prev_token = tokens[idx_t - 1].lower() if idx_t > 0 else ""
            if prev_token not in ["don", "doña", "señor", "señora", "para", "ubicar", "buscar", "a"]:
                cand = t.capitalize()
                return NAME_ALIASES.get(cand.lower(), cand)

    # 4. Respuesta Directa con Nombre Propio (cuando el usuario responde únicamente con su nombre):
    # Ej: "Hernán Darío Ríos", "Marcela Gómez", "Carlos"
    if 1 <= len(tokens) <= 3:
        if not any(t.lower() in FORBIDDEN_WORDS for t in tokens):
            first_token = tokens[0].lower()
            if first_token in COMMON_MALE_NAMES or first_token in COMMON_FEMALE_NAMES or tokens[0][0].isupper():
                cand = tokens[0].capitalize()
                return NAME_ALIASES.get(cand.lower(), cand)

    return None


def extract_or_normalize_email(text: str, default_email: str = "contacto@empresa.com") -> Optional[str]:
    """
    Extrae o normaliza correos electrónicos hablados o dictados por voz en español:
    - 'hernán.ríos@óptica colombiana.com' -> 'hernan.rios@opticacolombiana.com'
    - 'cuando le comente que mi direccion era hernan.rios@opticacolombiana.com' -> 'hernan.rios@opticacolombiana.com'
    - 'hernan punto rios arroba optica colombiana punto com' -> 'hernan.rios@opticacolombiana.com'
    - 'h rios arroba opticacolombiana punto com' -> 'hrios@opticacolombiana.com'
    - 'carlos punto perez arroba coordinadora mercantil punto com punto co' -> 'carlos.perez@coordinadoramercantil.com.co'
    - 'al corporativo' / 'al de la empresa' -> default_email
    """
    if not text:
        return None

    # 0. Eliminación de acentos y tildes para cumplir estrictamente con RFC 5322
    raw_clean = ''.join(c for c in unicodedata.normalize('NFD', text.lower().strip()) if unicodedata.category(c) != 'Mn')

    # 1. Referencia explícita a usar el correo corporativo/registrado en sistema
    if any(w in raw_clean for w in [
        'corporativo', 'de la empresa', 'institucional', 'de siempre',
        'tienen', 'tiene', 'registrado', 'oficial', 'el que le dije',
        'al mismo', 'a ese', 'a ese correo', 'de don simon',
        'aparece', 'pantalla', 'a ese mismo', 'mismo correo'
    ]):
        return default_email

    # 2. Normalización de tokens orales fonéticos en español
    spoken = raw_clean
    spoken = re.sub(r'\b(arroba|a\s+la\s+roba|al\s+roba|aroba|at)\b', '@', spoken)
    spoken = re.sub(r'\s*\b(punto|dot)\b\s*', '.', spoken)
    spoken = re.sub(r'\s*,\s*', ' ', spoken)
    spoken = re.sub(r'\s*\b(guion\s+bajo|guión\s+bajo|piso|subguion|subraya)\b\s*', '_', spoken)
    spoken = re.sub(r'\s*\b(guion\s+al\s+medio|guión\s+al\s+medio|guion\s+medio|guion|raya|menos)\b\s*', '-', spoken)
    spoken = re.sub(r'\ben\s+(gmail|hotmail|outlook|yahoo)\b', r'@\1.com', spoken)

    # 3. Procesamiento cuando contiene '@' (escrito o dictado oralmente)
    if "@" in spoken:
        parts = spoken.split("@", 1)
        raw_user = parts[0].strip()
        raw_domain = parts[1].strip()

        # Limpiar espacios alrededor de puntos, guiones y rayas en el usuario
        raw_user = re.sub(r'\s*\.\s*', '.', raw_user)
        raw_user = re.sub(r'\s*_\s*', '_', raw_user)
        raw_user = re.sub(r'\s*-\s*', '-', raw_user)

        # Extraer el usuario descartando preámbulos ('mi dirección era', 'el correo es', etc.)
        user_tokens = raw_user.split()
        stop_words = {
            "mi", "el", "la", "los", "las", "un", "una", "de", "del", "al", "a", "que",
            "era", "es", "seria", "fue", "correo", "electronico", "direccion", "mail",
            "email", "apunte", "anote", "escriba", "copie", "por", "favor", "le", "lo",
            "te", "me", "doy", "paso", "cuando", "comente", "dije", "nota", "tome",
            "mandelo", "mandalo", "envielo", "envialo", "mandar", "enviar", "escribe",
            "dirigelo", "dirijalo", "copielo", "apuntelo", "anotelo", "contacto"
        }

        clean_user_tokens = []
        for tok in reversed(user_tokens):
            clean_tok = tok.strip(" .,;:")
            if not clean_tok:
                continue
            if clean_tok in stop_words:
                break
            clean_user_tokens.insert(0, clean_tok)
            # Si este token contiene '.' (ej: 'hernan.rios') ya es el usuario completo
            if "." in clean_tok or "_" in clean_tok or "-" in clean_tok:
                break
            # Máximo 2 palabras para el nombre de usuario (ej: 'hernan' 'rios' -> 'hernan.rios')
            if len(clean_user_tokens) >= 2:
                break

        if not clean_user_tokens:
            clean_user_tokens = [user_tokens[-1].strip(" .,;:")] if user_tokens else ["contacto"]

        # Si son 2 palabras sin punto intermedio (ej: 'hernan rios' o 'h rios')
        if len(clean_user_tokens) == 2 and "." not in clean_user_tokens[0] and "." not in clean_user_tokens[1]:
            if len(clean_user_tokens[0]) == 1:
                user_part = f"{clean_user_tokens[0]}{clean_user_tokens[1]}"
            else:
                user_part = f"{clean_user_tokens[0]}.{clean_user_tokens[1]}"
        else:
            user_part = "".join(clean_user_tokens).replace(" ", "")

        # Limpiar dominio concatenando nombres de empresa compuestos (ej: 'optica colombiana.com' -> 'opticacolombiana.com')
        raw_domain = re.sub(r'\s*\.\s*', '.', raw_domain)
        tlds_pattern = r'(?:com\.co|edu\.co|gov\.co|org\.co|net\.co|mil\.co|nom\.co|com|co|net|org|io|ai|dev|app|lat|es|tech|info|biz|me|cloud|agency|digital)'

        # Buscar dominio con TLD con punto: ej: 'optica colombiana.com' o 'opticacolombiana.com.co'
        domain_match = re.search(r'^([a-z0-9\s.-]+?)\.(' + tlds_pattern + r')\b', raw_domain)
        if domain_match:
            dom_name = domain_match.group(1).replace(" ", "").strip(".")
            dom_tld = domain_match.group(2).replace(" ", "")
            domain_part = f"{dom_name}.{dom_tld}"
        else:
            # Buscar dominio con TLD sin punto: ej: 'optica colombiana com'
            domain_match_nopunct = re.search(r'^([a-z0-9\s-]+)\b(' + tlds_pattern + r')\b', raw_domain)
            if domain_match_nopunct:
                dom_name = domain_match_nopunct.group(1).replace(" ", "").strip(".")
                dom_tld = domain_match_nopunct.group(2).replace(" ", "")
                domain_part = f"{dom_name}.{dom_tld}"
            else:
                # Fallback: tomar las primeras palabras del dominio hasta conectores o fin de frase
                dom_tokens = raw_domain.split()
                dom_words = []
                for w in dom_tokens:
                    if w in ["y", "por", "favor", "muchas", "gracias", "para", "que"]:
                        break
                    dom_words.append(w)
                dom_str = "".join(dom_words).replace(" ", "")
                if "." not in dom_str:
                    dom_str += ".com"
                domain_part = dom_str

        # Limpiar cualquier caracter no alfanumérico extraño
        user_part = re.sub(r'[^a-z0-9\._-]', '', user_part).strip(".-_")
        domain_part = re.sub(r'[^a-z0-9\.-]', '', domain_part).strip(".-")

        if user_part and domain_part:
            return f"{user_part}@{domain_part}"

    return None


def is_generic_or_unknown_contact(contact_str: Optional[str]) -> bool:
    """
    Determina con rigor si el nombre del contacto es desconocido, vacío o un cargo genérico
    (evitando que Sara llame al interlocutor 'señor Director de Tecnología / Operaciones' o 'don Director' o 'señor ()').
    """
    if not contact_str:
        return True
    # Limpiar paréntesis y espacios
    clean = re.sub(r'\(.*?\)', '', str(contact_str)).strip()
    if not clean:
        return True
    c = clean.lower()
    if not c or c in ["desconocido", "por definir", "sin contacto", "n/a", "none", "null", "contacto", "principal", "interlocutor"]:
        return True
    if "/" in c or "\\" in c or "barra" in c:
        return True
    
    generic_words = {
        "director", "directora", "gerente", "lider", "líder", "jefe", "jefatura", "responsable",
        "encargado", "encargada", "tecnologia", "tecnología", "operaciones", "sistemas",
        "ti", "it", "de", "del", "la", "el", "y", "o", "en", "para", "area", "área",
        "infraestructura", "desconocido", "contacto", "cargo", "puesto", "soporte",
        "ingenieria", "ingeniería", "coordinador", "coordinadora", "asesor", "consultor",
        "analista", "auxiliar", "administrador", "administradora", "seguridad", "desarrollo", "principal"
    }
    tokens = set(re.findall(r'[a-záéíóúñ]+', c))
    if not tokens:
        return True
    if tokens.issubset(generic_words):
        return True

    return False


def extract_clean_contact_name(contact_str: Optional[str]) -> str:
    """Extrae el nombre limpio de un contacto si es válido y no genérico; si es genérico, retorna ''."""
    if not contact_str:
        return ""
    clean = re.sub(r'\(.*?\)', '', str(contact_str)).strip()
    return "" if is_generic_or_unknown_contact(clean) else clean


def extract_named_tech_leader(text: str) -> Optional[str]:
    """
    Extrae el nombre propio de la persona encargada de tecnología cuando un tercero
    lo menciona en la llamada (ej: 'la persona que comanda el equipo es Carlos Pérez',
    'el director es don Fernando', 'debe hablar con Marcela', 'ya te comenté es Alejandro Ríos').
    """
    raw_txt = text.strip()
    # 0. Limpiar correos electrónicos para que el usuario o prefijo del correo (como arios en arios@...) nunca se confunda con el nombre de una persona
    txt_clean = re.sub(r'[\w.-]+@[\w.-]+', '', raw_txt)
    txt_clean = re.sub(r'\b(?:correo|email|electr[oó]nico|arroba|punto\s+com)\b', '', txt_clean, flags=re.IGNORECASE).strip()
    if not txt_clean:
        return None
    txt = txt_clean
    prefix = r'(?:el\s+ingeniero|la\s+ingeniera|el\s+doctor|la\s+doctora|el\s+señor|la\s+señora|don|doña|senor|senora)\s+'

    # 1. Patrón de Recordatorio / Reclamo de líder:
    # "ya te comenté es Alejandro Ríos", "ya le dije que es Alejandro", "le repito que es Alejandro"
    m_remind = re.search(
        r'(?:ya\s+(?:te|le)\s+(?:lo\s+)?(?:había|habia|he)?\s*(?:dicho|comentado)|(?:le|te)\s+repito|ya\s+dije)\s+(?:que\s+)?(?:es\s+|se\s+llama\s+)?(?:' + prefix + r')?([A-ZÁÉÍÓÚa-záéíóúñÑ]+)',
        txt, re.IGNORECASE
    )
    if m_remind:
        cand = m_remind.group(1).strip()
        first_token = cand.lower()
        if len(first_token) > 2 and first_token not in FORBIDDEN_WORDS and first_token not in {"que", "este", "esta", "sistemas", "tecnologia", "tecnología"}:
            return cand.capitalize()

    # 2. Roles o sustantivos seguidos de 'es' / 'sería':
    # "el encargado es Alejandro", "la persona es Alejandro", "el de sistemas es Alejandro", "es Alejandro Ríos"
    m_es = re.search(
        r'\b(?:(?:la\s+persona|el\s+encargado|el\s+director|el\s+jefe|el\s+líder|el\s+lider|el\s+contacto|el\s+responsable)(?:\s+de\s+[a-záéíóúñ]+)*\s+)?(?:es|ser[ií]a)\s+(?:' + prefix + r')?([A-ZÁÉÍÓÚa-záéíóúñÑ]+)',
        txt, re.IGNORECASE
    )
    if m_es:
        cand = m_es.group(1).strip()
        first_token = cand.lower()
        if len(first_token) > 2 and first_token not in FORBIDDEN_WORDS and first_token not in {"que", "este", "esta", "sistemas", "tecnologia", "tecnología", "un", "una", "el", "la"}:
            return cand.capitalize()

    # 3. Patrones verbales directos: "debe hablar con X", "comuníquese con X", "hable con X"
    m_verb = re.search(
        r'\b(?:hablar\s+con|hable\s+con|comun[ií]quese\s+con|comunicarse\s+con|comun[ií]cate\s+con|trate\s+con|trata\s+con)\s+(?:' + prefix + r')?([A-ZÁÉÍÓÚa-záéíóúñÑ]+)',
        txt, re.IGNORECASE
    )
    if m_verb:
        cand = m_verb.group(1).strip()
        first_token = cand.lower()
        if len(first_token) > 2 and first_token not in {"que", "este", "esta", "sistemas", "tecnologia", "tecnología", "el", "la"}:
            return cand.capitalize()

    # 4. "se llama X", "su nombre es X", "el nombre es X"
    m_name = re.search(
        r'\b(?:se\s+llama|su\s+nombre\s+es|el\s+nombre\s+es)\s+(?:' + prefix + r')?([A-ZÁÉÍÓÚa-záéíóúñÑ]+)',
        txt, re.IGNORECASE
    )
    if m_name:
        cand = m_name.group(1).strip()
        if len(cand) > 2 and cand.lower() not in {"que", "este", "esta", "sistemas", "tecnologia", "tecnología"}:
            return cand.capitalize()

    # 5. Roles seguidos de 'es' / 'sería': "el director de sistemas es Carlos", "la persona que comanda el equipo es Carlos"
    patt_role = (
        r'(?:persona\s+que\s+(?:comanda|lidera|maneja|coordina|dirige)|'
        r'encargad[oa]\s+de\s+(?:sistemas|tecnolog[ií]a|ti|it)|'
        r'director[a]?\s+de\s+(?:sistemas|tecnolog[ií]a|ti|it|operaciones)|'
        r'jefe\s+de\s+(?:sistemas|tecnolog[ií]a|ti|it)|'
        r'l[ií]der\s+de\s+(?:sistemas|tecnolog[ií]a|ti|it)|'
        r'director[a]?|jefe|l[ií]der|encargad[oa])'
        r'[^.\n]*?\b(?:es|ser[ií]a)\s+'
        r'(?:' + prefix + r')?([A-ZÁÉÍÓÚa-záéíóúñÑ]+(?:\s+[A-ZÁÉÍÓÚa-záéíóúñÑ]+)?)'
    )
    m_role = re.search(patt_role, txt, re.IGNORECASE)
    if m_role:
        cand = m_role.group(1).strip()
        first_token = cand.split()[0].lower()
        stopwords = {"que", "este", "esta", "una", "uno", "sistemas", "tecnologia", "tecnología", "el", "la", "los", "las", "un"}
        if len(first_token) > 2 and first_token not in stopwords:
            return cand.split()[0].capitalize()

    # 6. Título de cortesía directo: "el ingeniero Carlos Pérez", "don Fernando", "señor Alejandro Ríos"
    m_hon = re.search(
        r'\b(?:el\s+ingeniero|la\s+ingeniera|el\s+doctor|la\s+doctora|don|doña|el\s+señor|la\s+señora)\s+([A-ZÁÉÍÓÚa-záéíóúñÑ]+)',
        txt, re.IGNORECASE
    )
    if m_hon:
        cand = m_hon.group(1).strip()
        if len(cand) > 2 and cand.lower() not in {"que", "este", "esta", "sistemas", "tecnologia", "tecnología"}:
            return cand.capitalize()

    # 7. Escaneo de nombres propios conocidos en el texto (limpiando emails para evitar falsos positivos con usuarios de email)
    txt_no_email = re.sub(r'[\w.-]+@[\w.-]+', '', txt)
    tokens = re.findall(r'[A-ZÁÉÍÓÚa-záéíóúñÑ]+', txt_no_email)
    for idx_t, t in enumerate(tokens):
        t_low = t.lower()
        if t_low in COMMON_MALE_NAMES or t_low in COMMON_FEMALE_NAMES:
            prev_token = tokens[idx_t - 1].lower() if idx_t > 0 else ""
            if prev_token not in ["para", "ubicar", "buscar", "a", "con", "soy", "habla"]:
                cand = t.capitalize()
                return cand

    return None


def extract_phone_or_extension(text: str) -> Optional[str]:
    """
    Extrae extensiones telefónicas, números celulares o fijos de contacto mencionados por voz.
    """
    txt = text.strip()
    
    # 1. Extensión: "extensión 104", "ext. 205", "en la 104", "a la extensión 1234"
    m_ext = re.search(r'\b(?:extensi[oó]n|ext\.?)\s*(?:es|ser[ií]a)?\s*(?:la\s+)?(\d{2,6})\b', txt, re.IGNORECASE)
    if m_ext:
        return f"ext. {m_ext.group(1)}"
    
    # 2. Celular colombiano (3xx xxx xxxx) o teléfono fijo con indicativo (60x xxx xxxx)
    m_cel = re.search(r'\b(3\d{2}[\s.-]?\d{3}[\s.-]?\d{4})\b', txt)
    if m_cel:
        digits = re.sub(r'\D', '', m_cel.group(1))
        return f"+57 {digits[:3]} {digits[3:6]} {digits[6:]}"

    m_fijo = re.search(r'\b(60\d[\s.-]?\d{3}[\s.-]?\d{4})\b', txt)
    if m_fijo:
        digits = re.sub(r'\D', '', m_fijo.group(1))
        return f"+57 ({digits[:3]}) {digits[3:6]} {digits[6:]}"

    # 3. Teléfono de 7 dígitos
    m_7 = re.search(r'\b(\d{3}[\s.-]?\d{4})\b', txt)
    if m_7 and not any(w in txt.lower() for w in ["nit", "año", "ano", "hora"]):
        digits = re.sub(r'\D', '', m_7.group(1))
        return digits

    return None


def parse_conversation_state(history: List[Dict[str, str]], current_msg: str, target_contact: Optional[str] = "Wilson Arboleda") -> Dict[str, Any]:
    """
    Rastrea el estado acumulado de la llamada con rigor:
    - is_target: FALSE por defecto en llamadas B2B en frío (asume recepcionista/asistente/tercero).
                 ÚNICAMENTE pasa a True si el interlocutor afirma explícitamente ser él o ser el líder técnico.
    - interlocutor_name: Nombre si se presentó. Se preserva entre turnos.
    - role: Cargo del tercero si lo mencionó ('asistente', 'secretaria', 'recepción', etc.)
    - is_annoyed_or_reminder: True si el usuario indica que ya lo había dicho o se queja de la confusión.
    - user_wants_topic: True si pide que le cuenten a él el tema.
    """
    has_known_target = not is_generic_or_unknown_contact(target_contact)
    target_tokens = set(re.findall(r'[a-záéíóúñ]+', target_contact.lower())) if has_known_target and target_contact else set()
    
    is_target = False
    interlocutor_name = None
    role = None
    refused_name = False
    is_annoyed_or_reminder = False
    user_wants_topic = False
    discovered_leader = None
    discovered_email = None
    discovered_phone = None
    is_self_leader = False

    all_turns = history + [{"speaker": "Contacto", "text": current_msg}]

    for idx, turn in enumerate(all_turns):
        spk = turn.get("speaker", "").lower()
        txt = turn.get("text", "")
        txt_lower = txt.lower().strip()

        is_user_spk = spk not in ["sara", "maggie", "asistente", "bot"]
        if is_user_spk:
            # Rastrear datos de contacto descubiertos
            ldr = extract_named_tech_leader(txt)
            if ldr:
                discovered_leader = ldr

            em = extract_or_normalize_email(txt)
            if em:
                discovered_email = em

            ph = extract_phone_or_extension(txt)
            if ph:
                discovered_phone = ph

            if any(w in txt_lower for w in [
                "habla con él", "hablas con él", "con él habla", "soy yo", "yo soy", "yo lidero",
                "yo me encargo de tecnología", "yo me encargo de tecnologia", "yo me encargo de sistemas",
                "yo soy el de sistemas", "yo soy el encargado"
            ]):
                is_self_leader = True

            # A. Recordatorio o Reclamo
            if any(w in txt_lower for w in ["ya te lo había dicho", "ya te lo habia dicho", "ya le dije", "ya te dije", "le repito", "otra vez", "se confunde", "no soy ese"]):
                is_annoyed_or_reminder = True

            # B. Petición de tema / explicación directa al interlocutor / intermediario
            intermediary_phrases = [
                "es conmigo", "conmigo", "hable conmigo", "hablelo conmigo", "háblelo conmigo", "hablemos",
                "trata conmigo", "trate conmigo", "trata el tema", "trate el tema", "trátelo conmigo", "tratelo conmigo",
                "yo le transmito", "yo le paso", "yo le digo", "yo le comento", "yo le entrego", "yo le doy la",
                "yo le doy el", "yo le paso el", "yo le doy la razón", "yo le paso la razón",
                "yo recibo", "yo me encargo", "yo tomo nota", "yo le tomo nota",
                "déjeme", "dejeme", "pasa la información", "pasar la información",
                "pásame la", "pasame la", "déjemela", "dejemela", "dígame a mí", "digame a mi", "diga me a mi",
                "cuénteme a mí", "cuenteme a mi", "relátame a mí", "relatame a mi", "cuál es el tema", "cual es el tema",
                "de qué se trata", "de que se trata", "yo le colaboro", "yo le ayudo", "yo le apoyo",
                "yo le puedo colaborar", "yo le puedo ayudar", "yo le puedo apoyar",
                "en qué te puedo ayudar", "en que te puedo ayudar", "en qué le colaboro", "en que le colaboro",
                "en qué le puedo ayudar", "en que le puedo ayudar", "en qué le puedo colaborar", "en que le puedo colaborar",
                "qué necesitas", "que necesitas", "qué buscan", "que buscan", "qué busca", "que busca",
                "para qué es", "para que es", "a qué se debe", "a que se debe",
                "para qué lo busca", "para que lo busca", "para qué lo necesita", "para que lo necesita",
                "de parte de quién", "de parte de quien"
            ]
            if any(w in txt_lower for w in intermediary_phrases):
                user_wants_topic = True
                is_target = False
                if not role:
                    role = "intermediario"

            # C. Detección de Rol
            if any(w in txt_lower for w in ["asistente", "asistente de", "mi jefe"]):
                role = "asistente"
                is_target = False
            elif any(w in txt_lower for w in ["secretaria", "recepcionista", "recepción", "recepcion", "conmutador"]):
                role = "recepción"
                is_target = False
            elif any(w in txt_lower for w in ["compañero", "compañera", "colega", "del equipo"]):
                role = "intermediario"
                is_target = False

            # D. Negación explícita de ser el contacto objetivo
            has_explicit_negation = any(w in txt_lower for w in [
                "no hablas con él", "no hablas con el", "no hablo con él", "no hablo con el",
                "no habla con él", "no habla con el", "con él no", "con el no", "con él ya no",
                "no es él", "no es el", "no soy él", "no soy el", "no soy yo", "no soy",
                "él no está", "el no esta", "no está", "no esta", "no se encuentra",
                "no está disponible", "no esta disponible", "está ocupado", "esta ocupado",
                "salió", "salio", "en reunión", "en reunion", "él salió", "el salio",
                "no habla con", "no hablas con"
            ]) or (txt_lower in ["no", "no señor", "no señora", "para nada", "negativo"] and idx <= 2)

            if has_explicit_negation:
                is_target = False

            # E. Confirmación afirmativa explícita de SER el contacto objetivo o líder tecnológico
            if not has_explicit_negation:
                is_self_tech_lead = any(w in txt_lower for w in [
                    "yo soy el de sistemas", "yo soy el encargado de sistemas", "yo lidero el equipo",
                    "yo manejo sistemas", "yo soy el director de tecnología", "yo soy el director de tecnologia",
                    "yo soy el director de sistemas", "yo soy el de tecnología", "yo soy el de tecnologia",
                    "aquí en sistemas", "aqui en sistemas", "hablas con sistemas", "habla con sistemas",
                    "yo atiendo sistemas", "yo respondo por tecnología", "yo respondo por tecnologia",
                    "yo me encargo de tecnología", "yo me encargo de tecnologia", "yo me encargo de sistemas"
                ])

                if has_known_target and target_tokens:
                    first_token = list(target_tokens)[0]
                    is_direct_affirmation = any(w in txt_lower for w in [
                        "con él habla", "con el habla", "con ella habla", "el mismo", "la misma",
                        "soy yo", "sí, habla", "si, habla", "sí, con él", "si, con el",
                        "a la orden, con él", "a la orden con él", "habla " + first_token
                    ]) or (txt_lower in ["sí", "si", "correcto", "con él", "con el"] and idx <= 2 and not role)
                else:
                    is_direct_affirmation = is_self_tech_lead

                if is_direct_affirmation or is_self_tech_lead:
                    is_target = True

            # F. Extracción y actualización de Nombre
            detected_name = extract_person_name(txt)
            if detected_name:
                if has_known_target and detected_name.lower() in target_tokens:
                    is_target = True
                    interlocutor_name = detected_name
                elif has_known_target:
                    is_target = False if not is_target else True
                    interlocutor_name = detected_name
                else:
                    # En llamadas de indagación de contacto en frío:
                    # El nombre mencionado corresponde al LÍDER de tecnología que se busca, NO a la persona en el teléfono.
                    is_explicit_self_intro = any(w in txt_lower for w in [
                        "mi nombre es", "me llamo", "le habla", "por acá habla", "por aca habla",
                        "aquí habla", "aqui habla", "hablas con", "habla con"
                    ]) and not any(w in txt_lower for w in [
                        "es el encargado", "es el director", "es el líder", "es el lider",
                        "es el de sistemas", "es el de tecnología", "debe hablar con",
                        "comuníquese con", "ya te comenté es", "ya te dije es", "el correo es", "es "
                    ])
                    if is_explicit_self_intro:
                        interlocutor_name = detected_name
                    else:
                        if not discovered_leader:
                            discovered_leader = detected_name

            # G. Rechazo a dar el nombre
            if any(w in txt_lower for w in ["no le voy a dar mi nombre", "eso no importa", "no importa mi nombre", "para qué mi nombre", "no se lo quiero dar", "no es necesario mi nombre"]):
                refused_name = True

    # Generación de etiqueta formal de tratamiento
    if is_target:
        if has_known_target and target_contact:
            label = f"Ingeniero {target_contact.split()[0]}"
        elif interlocutor_name:
            label = f"Don {interlocutor_name} (Líder TI)"
        else:
            label = "Líder de Tecnología"
    elif interlocutor_name:
        fname = interlocutor_name.lower()
        if fname in COMMON_FEMALE_NAMES or fname.endswith(('a', 'ia')):
            label = f"Doña {interlocutor_name}"
        else:
            label = f"Don {interlocutor_name}"
    elif role == "asistente":
        label = f"Asistente de {target_contact.split()[0]}" if has_known_target and target_contact else "Asistente"
    elif role == "recepción":
        label = "Recepción"
    elif role == "intermediario":
        label = None
    else:
        label = None

    # Métricas de memoria conversacional para evitar reseteos de saludo o pérdida de contexto
    sara_turns = [h for h in history if h.get("speaker", "").lower() in ["sara", "maggie"]]
    sara_turn_count = len(sara_turns)
    already_introduced = any("innovait" in h.get("text", "").lower() for h in sara_turns)
    already_greeted_by_name = bool(interlocutor_name and any(interlocutor_name.lower() in h.get("text", "").lower() for h in sara_turns))
    name_just_stated = bool(extract_person_name(current_msg))
    target_just_confirmed = any(w in current_msg.lower() for w in ["con él habla", "con el habla", "el mismo", "la misma", "soy yo", "sí, habla", "si, habla", "sí, con él", "si, con el"])

    # Detección de tema activo más reciente en la conversación (únicamente a partir del turno 2 en adelante)
    active_topic = "none"
    if sara_turn_count >= 2:
        for turn in reversed(history):
            txt_h = turn.get("text", "").lower()
            if any(w in txt_h for w in ["cuatro", "portafolio", "nuestras soluciones en", "cuatro soluciones", "cuatro áreas"]):
                active_topic = "portfolio"
                break
            elif any(w in txt_h for w in ["cloud", "nube", "servidor", "aws", "azure", "infraestructura"]):
                active_topic = "cloud"
                break
            elif any(w in txt_h for w in ["base de datos", "bases de datos", "saneamiento", "duplicados", "data hygiene"]):
                active_topic = "db"
                break
            elif any(w in txt_h for w in ["automatización de procesos", "automatizacion de procesos", "sistemas agénticos", "sistemas agenticos", "agentes de ia", "rag", "flujos con n8n"]):
                active_topic = "ai"
                break
            elif any(w in txt_h for w in ["documenttrack", "gestión documental", "ocr", "bodegaje", "archivo físico", "archivo fisico"]):
                active_topic = "doc"
                break

    # Detección de pausas, muletillas o conectores incompletos
    fillers = {
        "bueno", "mire", "a ver", "sí", "si", "ajá", "aja", "dígame", "digame",
        "diga me", "continúe", "continue", "lo escucho", "le escucho", "ok",
        "estamos viendo", "estamos revisando", "pues", "eh", "este", "claro",
        "por supuesto", "correcto", "exacto", "entonces", "ya", "siga", "hable",
        "lo sigo", "le sigo", "bien", "vale", "hola"
    }
    clean_msg = re.sub(r'[^\w\s]', '', current_msg.lower()).strip()
    is_filler_or_pause = (clean_msg in fillers) or (len(clean_msg.split()) <= 2 and clean_msg in [f.split()[0] for f in fillers])

    return {
        "is_target": is_target,
        "interlocutor_name": interlocutor_name,
        "role": role,
        "interlocutor_label": label,
        "refused_name": refused_name,
        "is_annoyed_or_reminder": is_annoyed_or_reminder,
        "user_wants_topic": user_wants_topic,
        "sara_turn_count": sara_turn_count,
        "already_introduced": already_introduced,
        "already_greeted_by_name": already_greeted_by_name,
        "name_just_stated": name_just_stated,
        "target_just_confirmed": target_just_confirmed,
        "active_topic": active_topic,
        "is_filler_or_pause": is_filler_or_pause,
        "has_known_target": has_known_target,
        "discovered_leader": discovered_leader,
        "discovered_email": discovered_email,
        "discovered_phone": discovered_phone,
        "is_self_leader": is_self_leader
    }


@router.post("/chat-turn", response_model=ChatTurnResponse)
def handle_live_chat_turn(payload: ChatTurnRequest):
    """
    Endpoint interactivo para conversar a viva voz con Sara en tiempo real.
    Garantiza memoria conversacional rigurosa, trato nativo colombiano y respuesta en cero latencia.
    """
    try:
        opp = opportunity_service.opportunities.get(payload.opportunity_id)
        company = payload.company_name or (opp.company_name if opp else "la empresa")
        db_contact = (opp.contacts[0].name if opp and opp.contacts else None)
        raw_contact = payload.contact_name or db_contact

        # Si la llamada se originó como indagación de contacto en recepción (contacto inicial en BD desconocido o apertura de indagación en historial):
        history_is_discovery = any(
            "área de sistemas" in h.get("text", "").lower() and any(k in h.get("text", "").lower() for k in ["quién", "quien", "comanda", "lidera", "encargada", "encargado"])
            for h in payload.conversation_history if h.get("speaker", "").lower() in ["sara", "maggie"]
        )
        is_discovery_call = is_generic_or_unknown_contact(db_contact) or history_is_discovery

        has_known_target = not is_generic_or_unknown_contact(raw_contact) and not is_discovery_call
        contact = extract_clean_contact_name(raw_contact) if has_known_target and raw_contact else None
        target_first = contact.split()[0] if contact else None

        # Generación de correo corporativo limpio para la empresa (sin tildes, sin signos de puntuación como 'S.A.S.')
        company_clean_slug = re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', company.lower()).encode('ascii', 'ignore').decode('utf-8'))
        for suffix in ["sas", "sa", "ltda", "colombia"]:
            if company_clean_slug.endswith(suffix) and len(company_clean_slug) > len(suffix) + 3:
                company_clean_slug = company_clean_slug[:-len(suffix)]
        fallback_email = f"contacto@{company_clean_slug or 'empresa'}.com"
        c_email = (opp.contacts[0].email if opp and opp.contacts and opp.contacts[0].email else fallback_email)

        # 1. RASTREO EXHAUSTIVO DEL ESTADO DE LA CONVERSACIÓN
        ctx = parse_conversation_state(payload.conversation_history, payload.user_message, contact)
        interlocutor_label = ctx["interlocutor_label"]
        is_target = ctx["is_target"]
        name = ctx["interlocutor_name"]
        role = ctx["role"]
        is_annoyed = ctx["is_annoyed_or_reminder"]
        wants_topic = ctx["user_wants_topic"]
        sara_turn_count = ctx["sara_turn_count"]
        already_introduced = ctx["already_introduced"]
        already_greeted_by_name = ctx["already_greeted_by_name"]
        name_just_stated = ctx["name_just_stated"]
        target_just_confirmed = ctx["target_just_confirmed"]
        active_topic = ctx["active_topic"]
        is_filler_or_pause = ctx["is_filler_or_pause"]

        user_msg = payload.user_message.strip()
        msg_l = user_msg.lower()
        saludo = get_colombian_time_greeting()

        # 2. INTENTO VÍA LLM (SI ESTÁ DISPONIBLE Y ACTIVO)
        llm = get_chat_model()
        if llm:
            try:
                history_text = "\n".join([f"{h.get('speaker', 'Interlocutor')}: {h.get('text', '')}" for h in payload.conversation_history[-6:]])
                target_desc = f"Contacto objetivo: don {contact}" if has_known_target else "Contacto objetivo: Desconocido (debes indagar con naturalidad quién comanda el equipo de tecnología)"
                target_prompt_check = f"SÍ, hablas directamente con él" if is_target else f"NO, estás hablando con {interlocutor_label or 'un tercero/asistente/recepcionista'}. NUNCA inventes nombres ni cargos como 'Director de Tecnología barra Operaciones'."
                turn_prompt = f"""Eres Sara, asistente de IA de INNOVAIT Transformación Digital en Medellín, Colombia.
Estás en una llamada telefónica B2B con {company}.

PORTAFOLIO DE SOLUCIONES DE INNOVAIT:
1. INFRAESTRUCTURA CLOUD (AWS, Azure, GCP): Migración de servidores locales, contenedores Docker/Kubernetes, FinOps, DevOps y soporte administrado 24/7.
2. AUTOMATIZACIÓN & IA: Agentes de IA autónomos, RAG corporativo sobre documentos y flujos con n8n.
3. BASES DE DATOS (Data Hygiene): Saneamiento, deduplicación, normalización y migración limpia.
4. GESTIÓN DOCUMENTAL (DocumentTrack): Digitalización con OCR inteligente asistido por IA y consulta en 5 segundos.

REGLAS CRÍTICAS DE IDENTIDAD Y MEMORIA:
- Saludo temporal oficial: {saludo} (utilízalo para saludar al interlocutor si es el primer saludo)
- {target_desc}
- ¿Estás hablando con el decisor?: {target_prompt_check}
- Interlocutor al teléfono: {interlocutor_label or 'Tercero desconocido'}
- ¿El usuario se molestó o recordó su nombre?: {"SÍ, pide disculpas cordialmente con calidez colombiana ('Don " + str(name or "") + ", qué pena con usted, " + saludo + ", le ofrezco mil disculpas por la confusión')" if is_annoyed else "No"}
- PIVOT CONSULTIVO DE PORTAFOLIO: Si el usuario indica que no le interesa digitalización pero le interesa INFRAESTRUCTURA, BASES DE DATOS o IA, pivota de inmediato y con entusiasmo a esa solución. ¡NUNCA te quedes insistiendo solo en papel o digitalización!
- MEMORIA Y FLUIDEZ: Si el usuario sólo hizo una pausa, usó una muletilla o dijo una frase corta ('bueno...', 'dígame', 'estamos viendo'), NO reinicies el saludo ni vuelvas a presentarte; responde continuando el hilo de la conversación sobre el tema activo ({active_topic}).

HISTORIAL DE LA LLAMADA EN VIVO:
{history_text}
Interlocutor: {user_msg}

INSTRUCCIONES:
- Responde en español formal y cálido de Colombia en MÁXIMO 1 o 2 oraciones breves (< 25 palabras).
- Mantén la conversación enfocada en descubrir sus retos y coordinar una breve demostración técnica para este jueves a las 10:00 AM.
- Tu nombre propio es Sara.

Devuelve ÚNICAMENTE un JSON con:
- reply: string (lo que Sara dice a viva voz, SIN prefijo 'Sara:')
- meeting_scheduled: boolean (true si se acordó la demo)
- meeting_datetime: string o null
- is_farewell: boolean (true si Sara ya se despide tras agendar o por rechazo)
"""
                res = llm.invoke(turn_prompt, timeout=3.5)
                content = res.content.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(content)
                return ChatTurnResponse(
                    reply=parsed.get("reply", "Con el mayor gusto le comento."),
                    meeting_scheduled=parsed.get("meeting_scheduled", False),
                    meeting_datetime=parsed.get("meeting_datetime", None),
                    is_farewell=parsed.get("is_farewell", False),
                    interlocutor_label=interlocutor_label
                )
            except Exception as llm_err:
                logger.info(f"[VoiceChatTurn] LLM offline o timeout ({llm_err}). Activando motor local instantáneo.")

        # 3. MOTOR CONVERSACIONAL DETERMINÍSTICO Y ROBUSTO (0 MS LATENCIA)
        prefijo = f"{interlocutor_label}, " if interlocutor_label and not is_target else ""

        # 3.1. RECLAMO / RECORDATORIO DE NOMBRE ("ya te lo había dicho...")
        if is_annoyed:
            if not has_known_target:
                curr_ldr = extract_named_tech_leader(user_msg) or ctx.get("discovered_leader")
                curr_em = detected_email or ctx.get("discovered_email")
                curr_ph = extract_phone_or_extension(user_msg) or ctx.get("discovered_phone")
                disc_contact = DiscoveredContact(
                    name=curr_ldr,
                    role="Líder de Tecnología" if curr_ldr else None,
                    email=curr_em,
                    phone_or_ext=curr_ph
                ) if (curr_ldr or curr_em or curr_ph) else None

                if curr_ldr and curr_em:
                    reply = (
                        f"Qué pena con usted por la confusión, le ofrezco mil disculpas. Ya quedó registrado Don {curr_ldr} "
                        f"con su correo {curr_em}. Hoy mismo le estaremos remitiendo la presentación técnica a su atención. "
                        f"Muchísimas gracias por su colaboración y que tenga un excelente resto de día."
                    )
                    return ChatTurnResponse(
                        reply=reply,
                        meeting_scheduled=False,
                        is_farewell=True,
                        interlocutor_label=interlocutor_label,
                        discovered_contact=disc_contact
                    )
                elif curr_ldr and not curr_em:
                    reply = (
                        f"Qué pena con usted por la confusión, le ofrezco disculpas. Ya tomé atenta nota de Don {curr_ldr}. "
                        f"¿Y me podría confirmar por favor a qué correo electrónico le hacemos llegar la propuesta técnica?"
                    )
                    return ChatTurnResponse(
                        reply=reply,
                        meeting_scheduled=False,
                        interlocutor_label=interlocutor_label,
                        discovered_contact=disc_contact
                    )
            elif name:
                target_phrase = f"a don {target_first}" if has_known_target and target_first else "a su equipo de tecnología"
                reply = (
                    f"Don {name}, qué pena con usted, {saludo}, le ofrezco mil disculpas por la confusión. "
                    f"Con el mayor gusto le comento: le marcaba {target_phrase} de INNOVAIT Transformación Digital "
                    f"sobre nuestras cuatro soluciones en Infraestructura Cloud, Automatización con IA, "
                    f"Saneamiento de Bases de Datos y Gestión Documental. ¿En cuál de estos frentes considera que podríamos colaborarles?"
                )
                return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)
            else:
                avail_phrase = f"si don {target_first} se encuentra disponible o usted nos podría apoyar" if has_known_target and target_first else "quién lidera o comanda el equipo de tecnología o si usted nos podría apoyar"
                reply = (
                    f"Qué pena con usted, {saludo}, le ofrezco mil disculpas por la confusión. "
                    f"Con el mayor gusto le aclaro: le marcaba de INNOVAIT Transformación Digital sobre nuestras soluciones tecnológicas. "
                    f"¿Sería tan amable de indicarme {avail_phrase}?"
                )
                return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # Detección contextual: ¿Sara solicitó el correo en el turno inmediatamente anterior?
        sara_turns = [h for h in payload.conversation_history if h.get("speaker", "").lower() in ["sara", "maggie"]]
        last_sara_text = sara_turns[-1].get("text", "").lower() if sara_turns else ""
        sara_just_asked_for_email = (
            "correo" in last_sara_text and any(k in last_sara_text for k in [
                "dirección", "direccion", "hacemos llegar", "compartimos", "enviamos la presentación",
                "enviamos la presentacion", "a qué correo", "a que correo", "a cuál correo", "a cual correo"
            ])
        )

        detected_email = extract_or_normalize_email(user_msg, default_email=c_email)

        # 3.1.1. CORRECCIÓN INMEDIATA TRAS MALENTENDIDO DE AGENDAMIENTO
        if msg_l in ["no", "no no", "no no no", "espera no", "no me agendes", "no agendes", "no todavía", "no todavia", "para nada", "yo no dije eso", "no señor"]:
            nombre_saludo = f"Don {name}, " if name else (f"{prefijo}" if prefijo else "")
            return ChatTurnResponse(
                reply=f"{nombre_saludo}qué pena con usted, le ofrezco disculpas por la confusión. No se preocupe, no queda agendada ninguna reunión. ¿A qué correo electrónico le podemos enviar la información para que la revise con calma?",
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        # 3.1.2. RESPUESTA DIRECTA A LA SOLICITUD DE CORREO (HABLADO O ESCRITO PARA CONTACTO CONOCIDO)
        if detected_email and has_known_target:
            reply = f"¡Perfecto! Ya mismo le enviamos la presentación y el portafolio detallado al correo {detected_email} para que la puedan evaluar con su equipo. Quedamos muy atentos a su comunicación. Muchísimas gracias por su atención y colaboración. Que tenga un excelente día."
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, is_farewell=True, interlocutor_label=interlocutor_label)

        # 3.1.3. SI SARA YA HABÍA PEDIDO EL CORREO EN EL TURNO ANTERIOR Y EL USUARIO RESPONDIÓ (PARA CONTACTO CONOCIDO)
        if sara_just_asked_for_email and has_known_target:
            reply = f"¡Perfecto! Con el mayor gusto. Se lo enviaremos al correo corporativo que tenemos registrado ({c_email}) para que lo puedan revisar con calma con su equipo. Quedamos muy atentos a su contacto. Muchísimas gracias y que tenga un excelente resto de día."
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, is_farewell=True, interlocutor_label=interlocutor_label)

        # 3.1.4. PETICIÓN DE CORREO / APLAZAMIENTO A CONTACTO POSTERIOR ("no mándame el correo...", "después vemos si agendamos")
        is_email_request_or_deferred = any(w in msg_l for w in [
            "correo", "email", "por correo", "al correo",
            "mándame", "mandame", "mándeme", "mandeme",
            "envíame", "enviame", "envíeme", "envieme",
            "mándamelo", "mandamelo", "envíamelo", "enviemelo",
            "mándemelo", "mandemelo", "envíemelo", "enviemelo",
            "mándanos", "mandanos", "envíanos", "envianos",
            "nos volvemos a poner en contacto", "nos ponemos en contacto",
            "yo los contacto", "yo lo contacto", "nosotros los contactamos", "nosotros lo contactamos",
            "yo me comunico", "nosotros nos comunicamos",
            "yo les aviso", "yo le aviso", "nosotros les avisamos", "nosotros le avisamos",
            "posible cita", "posible reunión", "posible reunion", "posible demo",
            "después miramos", "despues miramos", "luego miramos", "después vemos", "despues vemos", "luego vemos",
            "más adelante miramos", "mas adelante miramos", "más adelante", "mas adelante",
            "primero el correo", "primero la información", "primero la informacion"
        ])

        if not detected_email and is_email_request_or_deferred and (has_known_target or ctx.get("discovered_leader") or extract_named_tech_leader(user_msg)):
            target_person = name or ctx.get("discovered_leader") or extract_named_tech_leader(user_msg)
            nombre_saludo = f"Don {target_person}, " if target_person else (f"{prefijo}" if prefijo else "")
            reply = (
                f"Claro que sí, {nombre_saludo}con el mayor gusto se la compartimos. "
                f"¿A qué dirección de correo electrónico le hacemos llegar la propuesta técnica para que la revisen con calma?"
            )
            disc_contact = DiscoveredContact(
                name=target_person,
                role="Líder de Tecnología" if target_person else None,
                email=detected_email or ctx.get("discovered_email"),
                phone_or_ext=extract_phone_or_extension(user_msg) or ctx.get("discovered_phone")
            ) if target_person else None
            return ChatTurnResponse(
                reply=reply,
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label or (f"Don {target_person} (Líder TI)" if target_person else None),
                discovered_contact=disc_contact
            )

        # 3.1.5. INDAGACIÓN DE CONTACTO DESCONOCIDO (AVERIGUACIÓN NATURAL DE LÍDER Y DATOS DE CONTACTO)
        if not has_known_target:
            curr_name = extract_named_tech_leader(user_msg) or ctx.get("discovered_leader")
            curr_email = detected_email or ctx.get("discovered_email")
            curr_phone = extract_phone_or_extension(user_msg) or ctx.get("discovered_phone")
            is_self_leader = ctx.get("is_self_leader")

            disc_contact = DiscoveredContact(
                name=curr_name,
                role="Líder de Tecnología" if curr_name else None,
                email=curr_email,
                phone_or_ext=curr_phone
            ) if (curr_name or curr_email or curr_phone) else None

            # Detección de si en el turno inmediatamente anterior Sara quedó a la espera de que pasaran la llamada
            sara_turns = [h for h in payload.conversation_history if h.get("speaker", "").lower() in ["sara", "maggie"]]
            last_sara_msg = sara_turns[-1].get("text", "").lower() if sara_turns else ""
            was_waiting_transfer = any(w in last_sara_msg for w in [
                "quedo atenta en la línea", "quedo atenta en la linea", "quedo a la espera",
                "a que me comunique con don", "a que me comunique con", "a que me pase la llamada",
                "a que me pasen la llamada"
            ])

            # 3.1.5.0: ATENCIÓN DE LLAMADA TRANSFERIDA (cuando descuelga el líder tras la recepcionista pasar la llamada)
            if was_waiting_transfer:
                is_transferred_unavailable = any(w in msg_l for w in [
                    "no se encuentra", "no está", "no esta", "está en reunión", "esta en reunion",
                    "él salió", "el salio", "salió", "salio", "no está disponible", "no esta disponible",
                    "está ocupado", "esta ocupado", "no contestó", "no contesto", "se cortó", "se corto"
                ])
                if is_transferred_unavailable:
                    leader_target = f"Don {curr_name}" if curr_name else "la persona a cargo de tecnología"
                    reply = (
                        f"Comprendo perfectamente, no se preocupe. ¿Sería tan amable de facilitarme el correo electrónico de {leader_target} "
                        f"para remitirle la propuesta técnica y ponernos en contacto luego?"
                    )
                    return ChatTurnResponse(
                        reply=reply,
                        meeting_scheduled=False,
                        interlocutor_label=interlocutor_label,
                        discovered_contact=disc_contact
                    )

                if curr_name:
                    is_direct_self = any(w in msg_l for w in ["habla", "con el", "con él", "soy", "a la orden"]) and any(tok in msg_l for tok in curr_name.lower().split())
                    if is_direct_self:
                        reply = (
                            f"Don {curr_name}, {saludo}, qué gusto saludarlo. Le habla Sara de INNOVAIT Transformación Digital en Medellín. "
                            f"Nos comunicaron con usted para validar si en {company} tienen proyectos prioritarios en Automatización de procesos con IA "
                            f"o Infraestructura en la nube, ¿cómo están manejando esa parte actualmente?"
                        )
                    else:
                        reply = (
                            f"Aló, ¿Don {curr_name}? {saludo}, qué gusto saludarlo. Le habla Sara de INNOVAIT Transformación Digital en Medellín. "
                            f"Nos comunicaron con usted para validar si en {company} tienen proyectos prioritarios en Automatización de procesos con IA "
                            f"o Infraestructura en la nube, ¿cómo están manejando esa parte actualmente?"
                        )
                    return ChatTurnResponse(
                        reply=reply,
                        meeting_scheduled=False,
                        interlocutor_label=f"Don {curr_name} (Líder TI)",
                        discovered_contact=disc_contact
                    )
                else:
                    reply = (
                        f"Aló, {saludo}, qué gusto saludarlo. Le habla Sara de INNOVAIT Transformación Digital en Medellín. "
                        f"Nos transfirieron la llamada con el área de sistemas. ¿Tendré el gusto de hablar con la persona encargada de tecnología?"
                    )
                    return ChatTurnResponse(
                        reply=reply,
                        meeting_scheduled=False,
                        interlocutor_label="Líder de Tecnología",
                        discovered_contact=disc_contact
                    )

            # 3.1.5.1: Negativa por políticas de seguridad o privacidad
            is_policy_refusal = any(w in msg_l for w in [
                "no le puedo dar", "no te puedo dar", "no le puedo decir", "no te puedo decir",
                "no damos esa información", "no damos esa informacion", "no damos datos",
                "no damos nombres", "no está permitido", "no esta permitido",
                "por políticas", "por politicas", "por política", "por politica",
                "no se permite", "no autorizan", "política de la empresa", "politica de la empresa"
            ])
            if is_policy_refusal:
                reply = (
                    f"Comprendo perfectamente las políticas de seguridad de {company}, no se preocupe. "
                    f"¿Sería tan amable de indicarme al menos su nombre y un correo institucional al que podamos remitirle la presentación técnica para que el área de tecnología la evalúe?"
                )
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # 3.1.5.2: Preguntan quién llama / motivo de la llamada ("¿De parte de quién y para qué es?", o recepción contestando)
            is_who_calling = any(w in msg_l for w in [
                "de parte de quién", "de parte de quien", "quién lo busca", "quien lo busca",
                "quién llama", "quien llama", "de dónde llaman", "de donde llaman",
                "para qué asunto", "para que asunto", "con qué fin", "con que fin", "qué buscan", "que buscan",
                "con quién desea", "con quien desea", "a la orden", "en qué le podemos colaborar", "en que le podemos colaborar",
                "en qué le puedo ayudar", "en que le puedo ayudar", "dígame", "digame", "con quién tengo el gusto", "con quien tengo el gusto"
            ]) or (sara_turn_count <= 1 and any(w in msg_l for w in ["conmutador", "recepción", "recepcion", "en qué le colaboro", "en que le colaboro"]))
            if is_who_calling:
                reply = (
                    f"Con mucho gusto. Le habla Sara de INNOVAIT en Medellín. Le llamamos para presentarle una propuesta en automatización de procesos e infraestructura tecnológica a su equipo de sistemas. "
                    f"¿Me podría comunicar con la persona que lidera el área o indicarme con quién puedo hablar?"
                )
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # 3.1.5.3: TRANSFERENCIA ACTIVA DE LLAMADA POR LA RECEPCIONISTA / SECRETARIA
            transfer_phrases = [
                "le paso la llamada", "le paso con", "ya le paso", "ya se lo paso", "ya se la paso",
                "le comunico", "ya le comunico", "se lo comunico", "se la comunico",
                "le transfiero", "ya le transfiero", "le transfiero con", "transfiero la llamada",
                "un momento le paso", "un momento se lo paso", "un momento le comunico", "un momento le transfiero",
                "espere le paso", "espere le comunico", "espere un momento", "espere en linea", "espere en línea",
                "pase la llamada", "pasar la llamada", "pasar con", "le voy a pasar", "le voy a comunicar",
                "alla le dan", "allá le dan", "ahi le dan", "ahí le dan", "alla le dicen", "allá le dicen",
                "ahi le dicen", "ahí le dicen", "con el hable", "con él hable",
                "el le da la informacion", "él le da la información", "el le da los datos", "él le da los datos",
                "el le informa", "él le informa", "el le dice", "él le dice",
                "lo comunico", "la comunico", "se lo voy a pasar", "se la voy a pasar", "se lo paso", "se la paso",
                "comuníquese con él", "comuniquese con el", "hable con él", "hable con el"
            ]
            is_call_transfer = any(p in msg_l for p in transfer_phrases)
            if is_call_transfer:
                target_lead = curr_name or ctx.get("discovered_leader")
                if target_lead:
                    reply = f"¡Muchísimas gracias, muy amable! Quedo atenta en la línea a que me comunique con Don {target_lead}."
                else:
                    reply = "¡Muchísimas gracias, muy amable! Quedo atenta en la línea."
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # 3.1.5.4: Interlocutor afirma ser el líder o encargado de tecnología / sistemas
            is_self_tech_lead = is_self_leader or any(w in msg_l for w in [
                "habla con él", "hablas con él", "con él habla", "con el habla", "soy yo", "yo soy",
                "yo lidero", "yo manejo", "yo comando", "yo me encargo de tecnología", "yo me encargo de tecnologia",
                "yo me encargo de sistemas", "yo soy el de sistemas", "yo soy el encargado", "yo soy el director",
                "yo soy la directora", "yo soy el jefe", "yo soy el líder", "yo soy el lider",
                "aquí en sistemas", "aqui en sistemas", "hablas con sistemas", "habla con sistemas",
                "yo atiendo sistemas", "yo respondo por tecnología", "yo respondo por tecnologia"
            ])
            if is_self_tech_lead:
                lead_name = name or curr_name
                if lead_name:
                    reply = (
                        f"Don {lead_name}, {saludo}, qué gusto saludarlo. En INNOVAIT apoyamos a empresas como {company} en cuatro soluciones tecnológicas: "
                        f"Infraestructura Cloud, Automatización con Inteligencia Artificial, Saneamiento de Bases de Datos y Gestión Documental con OCR. "
                        f"¿A qué correo electrónico directo le podemos compartir la información, o en cuál de estos frentes tienen proyectos prioritarios en este momento?"
                    )
                else:
                    reply = "¡Qué gusto saludarlo! ¿Sería tan amable de confirmarme su nombre y su correo electrónico directo para dirigirle la presentación técnica?"
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label or (f"Don {lead_name} (Líder TI)" if lead_name else "Líder de Tecnología"),
                    discovered_contact=disc_contact
                )

            # 3.1.5.5: El interlocutor indica que el líder NO está disponible (en reunión, ausente, etc.)
            is_leader_unavailable = any(w in msg_l for w in [
                "no se encuentra", "no está", "no esta", "está en reunión", "esta en reunion",
                "él salió", "el salio", "salió", "salio", "no está disponible", "no esta disponible",
                "está ocupado", "esta ocupado", "no atiende hoy", "no está en la oficina", "no esta en la oficina"
            ])
            if is_leader_unavailable:
                leader_target = f"Don {curr_name}" if curr_name else "la persona a cargo de tecnología"
                reply = (
                    f"Comprendo perfectamente, no se preocupe. ¿Sería tan amable de facilitarme el correo electrónico o la extensión directa de {leader_target} "
                    f"para dejarle la información y poder contactarlo luego?"
                )
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # 3.1.5.6: Evaluación dinámica de datos obtenidos vs faltantes:
            has_name = bool(curr_name)
            has_email = bool(curr_email)
            has_phone = bool(curr_phone)

            # A. Tenemos Nombre + Correo (¡META ALCANZADA! Confirmar de inmediato y cerrar cálidamente sin pedir extensiones ni repetir preguntas)
            if has_name and has_email:
                phone_txt = f" y la {curr_phone}" if curr_phone else ""
                reply = (
                    f"¡Muchísimas gracias por su amabilidad y colaboración! Ya registré los datos de Don {curr_name}, su correo {curr_email}{phone_txt}. "
                    f"Hoy mismo le estaremos compartiendo la presentación técnica a su atención. Que tenga un excelente resto de día."
                )
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    is_farewell=True,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # B. Tenemos Nombre y Extensión/Teléfono, pero falta Correo
            if has_name and has_phone and not has_email:
                reply = f"Perfecto, ya tomé atenta nota de Don {curr_name} en la {curr_phone}. ¿Y sería tan amable de confirmarme también su correo electrónico para hacerle llegar el portafolio técnico?"
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # C. Solo tenemos Nombre (falta correo y no es transferencia activa)
            if has_name and not has_email and not has_phone:
                reply = f"Muchísimas gracias por el dato de Don {curr_name}. ¿Me podría comunicar con él a su extensión, o a qué correo le podríamos compartir la presentación técnica?"
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # D. Solo tenemos Correo (falta nombre)
            if has_email and not has_name:
                reply = f"Perfecto, ya registré el correo {curr_email}. ¿Y me podría indicar por favor el nombre de la persona que lidera tecnología para dirigirle la comunicación formalmente?"
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

            # E. Solo tenemos Extensión/Teléfono (falta nombre y correo)
            if has_phone and not has_name and not has_email:
                reply = f"Muchas gracias por la {curr_phone}. ¿Y me podría confirmar el nombre de la persona que comanda el equipo de tecnología y su correo electrónico para enviarle el portafolio?"
                return ChatTurnResponse(
                    reply=reply,
                    meeting_scheduled=False,
                    interlocutor_label=interlocutor_label,
                    discovered_contact=disc_contact
                )

        # 3.2. AGENDAMIENTO / ACEPTACIÓN REAL DE DEMO
        is_demo_acceptance = any(w in msg_l for w in [
            "agendemos", "agendémosla", "agendemosla", "agendémoslo", "agendemoslo",
            "bueno agendemos", "listo agendemos", "de una agendemos", "sí agendemos", "si agendemos",
            "el jueves a las diez", "el jueves a las 10", "jueves a las diez", "jueves a las 10",
            "el jueves me queda bien", "el jueves está bien", "el jueves me parece bien"
        ]) or (
            any(w in msg_l for w in ["de acuerdo", "perfecto", "me parece bien", "listo", "hágale", "hagale", "claro que sí", "claro que si", "dale"])
            and len(msg_l.split()) <= 4
            and not any(w in msg_l for w in ["no", "pero", "correo", "email", "después", "despues", "luego", "más adelante", "mas adelante", "contacto"])
        )

        if is_demo_acceptance:
            return ChatTurnResponse(
                reply="¡Excelente! Quedamos agendados para este jueves a las diez de la mañana por Teams con uno de nuestros arquitectos de soluciones. Le enviaré la invitación al correo corporativo. Muchísimas gracias por su tiempo y que tenga un excelente día.",
                meeting_scheduled=True,
                meeting_datetime="Jueves 10:00 AM",
                is_farewell=True,
                interlocutor_label=interlocutor_label
            )

        # 3.2.1 INTERÉS EN INFRAESTRUCTURA CLOUD / SERVIDORES / DEVOPS (AWS / Azure / GCP)
        is_cloud_infra_intent = any(w in msg_l for w in [
            "infraestructura", "cloud", "nube", "servidor", "servidores", "aws", "azure", "gcp",
            "google cloud", "devops", "sre", "migración cloud", "migracion cloud", "migrar a la nube",
            "on premise", "on-premise", "datacenter", "data center", "contenedores", "docker", "kubernetes",
            "finops", "disaster recovery"
        ])
        if is_cloud_infra_intent:
            already_talked_cloud = any("Infraestructura Cloud" in h.get("text", "") for h in payload.conversation_history)
            if already_talked_cloud or any(w in msg_l for w in ["pasar a", "migrar", "tenemos servidores", "windows server", "linux", "locales", "on premise", "costos"]):
                reply = (
                    f"{prefijo}comprendo perfectamente. En INNOVAIT nos especializamos precisamente en migración segura de servidores a AWS y Azure "
                    f"sin tiempo de inactividad, con optimización FinOps para reducir hasta un cuarenta por ciento en costos de nube. "
                    f"¿Le parecería coordinar una breve sesión técnica de quince minutos este jueves a las diez de la mañana con uno de nuestros arquitectos cloud?"
                )
            else:
                reply = (
                    f"{prefijo}¡Excelente! En INNOVAIT contamos precisamente con una línea especializada en Arquitectura e Infraestructura Cloud "
                    f"en AWS, Azure y Google Cloud. Apoyamos a empresas en migración de servidores locales, modernización a contenedores, "
                    f"optimización de costos FinOps y soporte administrado DevOps 24/7. "
                    f"¿Actualmente tienen servidores locales que deseen migrar o buscan optimizar su infraestructura en la nube?"
                )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.2 INTERÉS EN BASES DE DATOS / SANEAMIENTO / DATA HYGIENE
        is_data_hygiene_intent = any(w in msg_l for w in [
            "base de datos", "bases de datos", "datos", "saneamiento", "depuración", "depuracion",
            "limpieza de datos", "limpieza de base", "duplicados", "calidad de datos", "migración de datos",
            "migracion de datos", "inconsistencias"
        ])
        if is_data_hygiene_intent:
            already_talked_db = any("Bases de Datos" in h.get("text", "") for h in payload.conversation_history)
            if already_talked_db or any(w in msg_l for w in ["duplicados", "inconsistencias", "sql", "oracle", "limpiar", "migrar"]):
                reply = (
                    f"{prefijo}precisamente en INNOVAIT realizamos un diagnóstico y perfilado automatizado para depurar hasta quinientos mil registros "
                    f"y eliminar duplicados antes de cualquier migración. ¿Le gustaría que coordinemos quince minutos este jueves a las diez de la mañana "
                    f"para compartirle la metodología de saneamiento?"
                )
            else:
                reply = (
                    f"{prefijo}¡Totalmente! En INNOVAIT tenemos una línea especializada en Saneamiento, Deduplicación y Calidad de Bases de Datos. "
                    f"Apoyamos a depurar registros duplicados, corregir inconsistencias y realizar migraciones seguras a nuevos ERPs o nubes sin frenar su operación diaria. "
                    f"¿Tienen actualmente alguna base de datos o migración que presente inconsistencias?"
                )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.3 INTERÉS EN INTELIGENCIA ARTIFICIAL & AUTOMATIZACIÓN (AI_AUTOMATION)
        is_ai_intent = bool(re.search(r'\b(inteligencia artificial|automatización|automatizacion|automatizar|agentes?|bots?|n8n|rag)\b', msg_l))
        if is_ai_intent and not any(w in msg_l for w in ["documenttrack", "ocr", "bodegaje"]):
            already_talked_ai = any("Sistemas Agénticos" in h.get("text", "") for h in payload.conversation_history)
            if already_talked_ai or any(w in msg_l for w in ["proceso", "consultas", "soporte", "automatizar", "atención", "atencion"]):
                reply = (
                    f"{prefijo}justamente desplegamos Pruebas de Concepto en dos semanas sobre el caso de uso específico de su empresa para validar "
                    f"ahorro de tiempo y reducción de costos operativos. ¿Le parecería si agendamos una breve demostración este jueves a las diez de la mañana?"
                )
            else:
                reply = (
                    f"{prefijo}¡Magnífico! En INNOVAIT desarrollamos Sistemas Agénticos y Automatización de Procesos con Inteligencia Artificial. "
                    f"Implementamos agentes autónomos y búsqueda semántica RAG para automatizar flujos repetitivos y consultas normativas. "
                    f"¿Tienen en mente algún proceso operativo específico que deseen automatizar?"
                )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.4 PRESENTACIÓN DEL PORTAFOLIO GENERAL / SERVICIOS DE INNOVAIT
        is_portfolio_inquiry = any(w in msg_l for w in [
            "portafolio", "qué servicios", "que servicios", "qué ofrecen", "que ofrecen",
            "a qué se dedican", "a que se dedican", "qué hacen", "que hacen", "qué productos",
            "que productos", "servicios tienen", "otros servicios", "otras soluciones",
            "cuénteme de innovait", "cuenteme de innovait", "qué líneas manejan", "que lineas manejan"
        ])
        if is_portfolio_inquiry:
            reply = (
                f"{prefijo}con el mayor gusto le comento: en INNOVAIT Transformación Digital apoyamos a las empresas en cuatro áreas clave: "
                f"primero, Arquitectura e Infraestructura Cloud en AWS, Azure y GCP con soporte DevOps 24/7; "
                f"segundo, Gestión Documental Inteligente y OCR con DocumentTrack para digitalizar archivo físico; "
                f"tercero, Automatización de Procesos y Agentes con Inteligencia Artificial; "
                f"y cuarto, Saneamiento y Migración limpia de Bases de Datos. "
                f"¿En cuál de estos frentes tienen previstas iniciativas o retos en este momento en {company}?"
            )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.5 RECHAZO A DIGITALIZACIÓN CON PIVOT CONSULTIVO AL RESTO DEL PORTAFOLIO
        is_digital_rejection = any(w in msg_l for w in [
            "no me interesa la digitalización", "no me interesa digitalización", "no nos interesa la digitalización",
            "no nos interesa digitalizar", "no me interesan los temas de digitalización", "no me interesa el papel",
            "no tenemos archivo físico", "no tenemos archivo fisico", "no tenemos bodega", "no manejamos papel",
            "ya tenemos todo digital", "digitalización no", "digitalizacion no", "no nos interesa el software de documentos"
        ])
        if is_digital_rejection:
            reply = (
                f"{prefijo}comprendo perfectamente, no se preocupe por el archivo físico. Además de digitalización, en INNOVAIT nos enfocamos fuertemente en "
                f"Infraestructura Cloud (AWS, Azure y GCP), Sistemas de Automatización con Inteligencia Artificial y Saneamiento de Bases de Datos. "
                f"¿En alguno de estos temas de infraestructura o tecnología tienen proyectos prioritarios en este momento?"
            )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.6 PREGUNTAS CLAVE: TIEMPO / CRONOGRAMA / DURACIÓN
        if any(w in msg_l for w in ["cuánto tiempo", "cuanto tiempo", "cuánto se demora", "cuanto se demora", "en cuánto tiempo", "en cuanto tiempo", "plazo", "cronograma", "demora", "cuánto tarda", "cuanto tarda"]):
            reply = (
                f"{prefijo}nuestras implementaciones se desarrollan de manera muy ágil: iniciamos con una validación técnica o prueba de concepto en dos semanas, "
                f"y el despliegue completo toma entre tres y cuatro semanas sin ningún traumatismo en su operación diaria. "
                f"¿Le gustaría que coordinemos quince minutos este jueves a las diez de la mañana para detallar el cronograma?"
            )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.7 PREGUNTAS CLAVE: SEGURIDAD / CONFIDENCIALIDAD / PRIVACIDAD
        if any(w in msg_l for w in ["seguridad", "seguro", "confidencial", "confidencialidad", "cifrado", "privacidad", "datos sensibles", "nda"]):
            reply = (
                f"{prefijo}la seguridad es nuestra máxima prioridad. Trabajamos bajo estrictos acuerdos de confidencialidad NDA, "
                f"con cifrado bancario de datos en tránsito y reposo, y estricto cumplimiento de la normativa colombiana de protección de datos personales. "
                f"¿Le parecería coordinar una breve sesión este jueves a las diez de la mañana con nuestro especialista de seguridad?"
            )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.8 PREGUNTAS CLAVE: ¿ERES UNA IA?
        if any(w in msg_l for w in ["eres una ia", "eres ia", "eres un bot", "eres robot", "es una grabación", "es una grabacion"]):
            reply = (
                f"Así es, soy Sara, la asistente de Inteligencia Artificial de INNOVAIT Transformación Digital en Medellín. "
                f"Estoy diseñada para brindarle atención ágil y coordinar directamente con nuestros arquitectos de soluciones. "
                f"¿Le gustaría que revisemos cómo podemos colaborarles en infraestructura, IA o bases de datos?"
            )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.2.9 RECHAZO CORDIAL / CIERRE DE LLAMADA (SOLO SI NO MENCIONÓ NINGÚN OTRO INTERÉS)
        if any(w in msg_l for w in ["no me interesa", "no nos interesa", "no estamos interesados", "no gracias", "por ahora no", "no por ahora"]):
            return ChatTurnResponse(
                reply="Entiendo perfectamente, no se preocupe. Le agradezco muchísimo su amabilidad y su tiempo al atenderme. Que tenga un excelente día.",
                meeting_scheduled=False,
                is_farewell=True,
                interlocutor_label=interlocutor_label
            )

        # 3.3. PREGUNTA ESPECÍFICA: QUÉ ES EL SOFTWARE / DOCUMENTTRACK / DE QUÉ SE TRATA
        if any(w in msg_l for w in ["de qué se trata", "de que se trata", "qué es el software", "que es el software", "qué es documenttrack", "que es documenttrack", "qué hace", "que hace", "qué software", "que software"]):
            if not is_target:
                reply = f"{prefijo}con el mayor gusto le comento: DocumentTrack es nuestra plataforma con OCR inteligente asistido por IA. Permite consultar expedientes, facturas y contratos físicos en menos de cinco segundos desde el celular o computador, reduciendo hasta un setenta por ciento los costos de bodegaje de papel. ¿En {company} manejan un volumen grande de archivo físico?"
            else:
                target_title = f"Ingeniero {target_first}" if has_known_target and target_first else (f"Don {name}" if name else "Estimado líder")
                reply = f"{target_title}, con DocumentTrack digitalizamos expedientes físicos con OCR asistido por IA para consultar cualquier documento en cinco segundos y reducir costos de bodegaje. ¿Manejan un volumen alto de archivo físico en su operación?"
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.4. INTEGRACIÓN CON ERP / PREGUNTAS TÉCNICAS
        if any(w in msg_l for w in ["erp", "sistema", "software contable", "traumático", "traumatico", "cambiar", "integración", "integracion", "api", "apis"]):
            return ChatTurnResponse(
                reply=f"{prefijo}para nada, esa es nuestra principal ventaja. DocumentTrack es completamente modular y se integra mediante APIs seguras a su ERP y sistemas actuales sin ningún traumatismo operativo. ¿Le parecería ver una demostración de quince minutos este jueves a las diez de la mañana?",
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        # 3.5. COSTO / PRESUPUESTO
        if any(w in msg_l for w in ["costo", "precio", "cuánto vale", "cuanto vale", "cuánto cuesta", "cuanto cuesta", "presupuesto", "caro", "cobran"]):
            return ChatTurnResponse(
                reply=f"{prefijo}precisamente DocumentTrack busca generar ahorro inmediato. Las empresas reducen hasta un setenta por ciento en costos de bodegaje y transporte de cajas de papel. ¿Le parecería si le preparamos un cálculo de retorno de inversión sin ningún compromiso?",
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        # 3.6. ENVIAR POR CORREO
        if any(w in msg_l for w in ["correo", "email", "por correo", "información por correo", "informacion por correo", "propuesta por correo", "envíeme", "envieme", "@", ".com", "arroba"]):
            if detected_email:
                reply = f"¡Perfecto! Ya mismo le enviamos la presentación detallada al correo {detected_email} para que la puedan evaluar con su equipo. Muchísimas gracias por su atención y colaboración. Que tenga un excelente día."
                return ChatTurnResponse(reply=reply, meeting_scheduled=False, is_farewell=True, interlocutor_label=interlocutor_label)
            elif not is_target:
                if role in ["intermediario", "asistente"] or wants_topic or name:
                    reply = f"{prefijo}con el mayor gusto se la comparto. ¿A qué dirección de correo le hacemos llegar la información?"
                elif has_known_target and target_first:
                    reply = f"{prefijo}con el mayor gusto. ¿El correo directo de don {target_first} sigue siendo {c_email} o me podría confirmar su dirección para enviárselo de inmediato?"
                else:
                    reply = f"{prefijo}con el mayor gusto. ¿A qué dirección de correo corporativo prefiere que remitamos la información para que el área de tecnología la pueda evaluar?"
            else:
                if has_known_target and target_first:
                    reply = f"Ingeniero {target_first}, con el mayor agrado se lo envío hoy mismo. ¿Su correo directo sigue siendo {c_email} o a qué dirección prefiere que se lo dirija?"
                else:
                    reply = f"Con el mayor agrado se lo envío hoy mismo. ¿A qué dirección de correo prefiere que se lo dirija?"
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.7. VOLUMEN DE BODEGA
        if any(w in msg_l for w in ["50", "cincuenta", "carpetas", "cajas", "bodega", "papel", "expedientes", "archivo", "bastante", "muchas", "harto", "pesando"]):
            return ChatTurnResponse(
                reply=f"{prefijo}comprendo perfectamente, ese volumen en bodegas externas suele costar millones al mes. DocumentTrack digitaliza todo con IA sin cambiar sus sistemas. ¿Le parecería ver una breve demostración de quince minutos este jueves a las diez de la mañana?",
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        # 3.8. PREGUNTA "¿DE PARTE DE QUIÉN?" / "¿QUIÉN LLAMA?"
        if any(w in msg_l for w in ["de parte de quién", "de parte de quien", "quién lo busca", "quien lo busca", "quién llama", "quien llama", "de dónde llaman", "de donde llaman"]):
            if has_known_target and target_first:
                reply = f"{saludo.capitalize()}. Le habla Sara de INNOVAIT Transformación Digital en Medellín. Nos comunicamos para comentarle a don {target_first} sobre modernización tecnológica y optimización en cuatro soluciones clave. ¿Él se encontrará disponible en este momento?"
            else:
                reply = f"{saludo.capitalize()}. Le habla Sara de INNOVAIT Transformación Digital en Medellín. Nos comunicamos porque apoyamos a empresas como {company} en soluciones de Infraestructura Cloud, Inteligencia Artificial y Saneamiento de Bases de Datos, y queríamos consultar quién comanda el equipo de tecnología para compartirle nuestro portafolio técnico. ¿Con quién podríamos comunicarnos?"
            return ChatTurnResponse(
                reply=reply,
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        # 3.9. INTERMEDIARIO / OFRECE TRANSMITIR / "ES CONMIGO" / PETICIÓN DE TEMA DIRECTA
        is_intermediary_turn = any(w in msg_l for w in [
            "es conmigo", "conmigo", "hable conmigo", "hablelo conmigo", "háblelo conmigo", "hablemos",
            "trata conmigo", "trate conmigo", "trata el tema", "trate el tema", "trátelo conmigo", "tratelo conmigo",
            "yo le transmito", "yo le paso", "yo le digo", "yo le comento", "yo le entrego", "yo le doy la",
            "yo le doy el", "yo le paso el", "yo le doy la razón", "yo le paso la razón",
            "yo recibo", "yo me encargo", "yo tomo nota", "yo le tomo nota",
            "déjeme", "dejeme", "pasa la información", "pasar la información",
            "pásame la", "pasame la", "déjemela", "dejemela", "dígame a mí", "digame a mi", "diga me a mi",
            "cuénteme a mí", "cuenteme a mi", "relátame a mí", "relatame a mi", "cuál es el tema", "cual es el tema",
            "de qué se trata", "de que se trata", "yo le colaboro", "yo le ayudo", "yo le apoyo",
            "yo le puedo colaborar", "yo le puedo ayudar", "yo le puedo apoyar",
            "en qué te puedo ayudar", "en que te puedo ayudar", "en qué le colaboro", "en que le colaboro",
            "en qué le puedo ayudar", "en que le puedo ayudar", "en qué le puedo colaborar", "en que le puedo colaborar",
            "qué necesitas", "que necesitas", "qué buscan", "que buscan", "qué busca", "que busca",
            "para qué es", "para que es", "a qué se debe", "a que se debe",
            "para qué lo busca", "para que lo busca", "para qué lo necesita", "para que lo necesita",
            "de parte de quién", "de parte de quien"
        ])

        if is_intermediary_turn or (role in ["asistente", "intermediario"] and not already_introduced) or (wants_topic and not is_target and not already_introduced):
            nombre_saludo = f"Don {name}, " if name else ""
            if already_introduced:
                reply = (
                    f"Claro que sí, {nombre_saludo}con el mayor gusto, le agradezco muchísimo. "
                    f"Como le mencionaba, en INNOVAIT apoyamos a {company} en cuatro soluciones clave: "
                    f"Infraestructura Cloud, Automatización con Inteligencia Artificial, Saneamiento de Bases de Datos "
                    f"y Gestión Documental con OCR. ¿En cuál de estos temas tienen proyectos prioritarios en este momento, "
                    f"o a qué correo le compartimos la presentación para que usted la revise?"
                )
            elif role == "asistente":
                reply = (
                    f"Con mucho gusto. Como usted es su asistente, le cuento brevemente: en INNOVAIT apoyamos a {company} "
                    f"en cuatro frentes: Infraestructura Cloud, Automatización con Inteligencia Artificial, Saneamiento de Bases de Datos "
                    f"y Gestión Documental con OCR. ¿En cuál de estas áreas considera que podríamos colaborarles principalmente, "
                    f"o a qué correo le compartimos la presentación?"
                )
            else:
                reply = (
                    f"Claro que sí, {nombre_saludo}con el mayor gusto, le agradezco muchísimo. "
                    f"Le comento: en INNOVAIT apoyamos a {company} en cuatro soluciones tecnológicas clave: "
                    f"primero, Infraestructura Cloud en AWS, Azure y GCP con soporte DevOps; "
                    f"segundo, Automatización de Procesos y Agentes con Inteligencia Artificial; "
                    f"tercero, Saneamiento y Migración limpia de Bases de Datos; "
                    f"y cuarto, Gestión Documental Inteligente con OCR y DocumentTrack. "
                    f"¿En cuál de estos frentes considera que podríamos colaborarles principalmente, "
                    f"o a qué correo le compartimos la presentación para que usted la revise?"
                )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.9.5. NEGACIÓN EXPLÍCITA DE SER EL CONTACTO OBJETIVO (ej: "no no hablas con él", "con él no", "él no está")
        is_target_negation = any(w in msg_l for w in [
            "no hablas con él", "no hablas con el", "no hablo con él", "no hablo con el",
            "no habla con él", "no habla con el", "con él no", "con el no", "con él ya no",
            "no es él", "no es el", "no soy él", "no soy el", "no soy yo", "no soy",
            "él no está", "el no esta", "no está", "no esta", "no se encuentra",
            "no está disponible", "no esta disponible", "está ocupado", "esta ocupado",
            "salió", "salio", "en reunión", "en reunion", "él salió", "el salio"
        ]) or (msg_l in ["no", "no señor", "no señora", "para nada", "negativo"] and sara_turn_count <= 1)

        if is_target_negation and has_known_target and target_first:
            if name:
                reply = (
                    f"Don {name}, {saludo}, qué gusto saludarlo. Le habla Sara de INNOVAIT Transformación Digital. "
                    f"Le marcaba a don {target_first} para comentarle de nuestras cuatro soluciones en Infraestructura Cloud, "
                    f"Automatización con IA, Saneamiento de Bases de Datos y Gestión Documental. "
                    f"¿Don {target_first} se encontrará más tarde, o usted nos podría colaborar con este tema?"
                )
            elif role == "asistente":
                reply = (
                    f"Con mucho gusto. Como usted es su asistente, le cuento brevemente: en INNOVAIT apoyamos a {company} "
                    f"en Infraestructura Cloud, Automatización con Inteligencia Artificial, Saneamiento de Bases de Datos "
                    f"y Gestión Documental. ¿En cuál de estas áreas considera que podríamos colaborarles principalmente?"
                )
            else:
                reply = (
                    f"Comprendo perfectamente, qué pena incomodarlo. "
                    f"¿Sería tan amable de indicarme con quién tengo el gusto de hablar, o a qué hora podría ubicar a don {target_first}?"
                )
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.10. INTERLOCUTOR SE PRESENTÓ CON SU NOMBRE (SÓLO SI ES LA PRIMERA VEZ QUE SE PRESENTA Y EN EL PRIMER TURNO)
        if name and not is_target and (name_just_stated or not already_greeted_by_name) and sara_turn_count <= 1 and not already_introduced:
            if has_known_target and target_first:
                reply = f"{prefijo}{saludo}, qué gusto saludarlo. Le habla Sara de INNOVAIT Transformación Digital. Le marcaba a don {target_first} para comentarle de nuestras soluciones en Infraestructura Cloud, Automatización con IA, Saneamiento de Bases de Datos y Gestión Documental. ¿Don {target_first} se encontrará en su despacho, o usted nos podría apoyar con ese tema?"
            else:
                reply = f"{prefijo}{saludo}, qué gusto saludarlo. Le habla Sara de INNOVAIT Transformación Digital. Nos comunicábamos con {company} para consultar quién lidera el equipo de tecnología o sistemas, o si usted nos podría apoyar con ese tema."
            return ChatTurnResponse(
                reply=reply,
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        # 3.11. TARGET CONFIRMADO (SÓLO EN EL PRIMER TURNO DE PRESENTACIÓN)
        if is_target and (target_just_confirmed or not already_introduced or sara_turn_count <= 1):
            target_formal = f"Ingeniero {contact}" if has_known_target and contact else (f"Don {name}" if name else "Estimado líder")
            return ChatTurnResponse(
                reply=f"{target_formal}, {saludo}, qué gusto saludarlo. Le hablo de INNOVAIT Transformación Digital; apoyamos a empresas de su sector en modernización tecnológica a través de cuatro soluciones: Infraestructura Cloud (AWS, Azure, GCP), Automatización con Inteligencia Artificial, Saneamiento de Bases de Datos y Gestión Documental con OCR. ¿Actualmente en cuál de estos frentes tienen proyectos o retos prioritarios?",
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        # 3.12. MEMORIA CONVERSACIONAL Y CONTINUIDAD (PAUSAS, CONTINUACIÓN, TURNO AVANZADO)
        if (sara_turn_count >= 2 or already_greeted_by_name) and (is_filler_or_pause or active_topic != "none"):
            if active_topic == "cloud":
                reply = (
                    f"{prefijo}por supuesto. En cuanto a su infraestructura y servidores en la nube, "
                    f"¿tienen actualmente servidores locales que deseen migrar a AWS o Azure, o buscan optimizar costos en la nube?"
                )
            elif active_topic == "db":
                reply = (
                    f"{prefijo}comprendo perfectamente. En cuanto a la calidad de sus bases de datos, "
                    f"¿tienen registros duplicados o inconsistencias que les gustaría depurar para una migración limpia?"
                )
            elif active_topic == "ai":
                reply = (
                    f"{prefijo}claro que sí. En automatización con agentes de IA, "
                    f"¿qué tareas o procesos operativos les gustaría agilizar en este momento?"
                )
            elif active_topic == "doc":
                reply = (
                    f"{prefijo}lo escucho con mucho gusto. Sobre el archivo físico y expedientes en papel, "
                    f"¿manejan un volumen alto que quisieran consultar en cinco segundos con OCR?"
                )
            elif active_topic == "portfolio":
                reply = (
                    f"{prefijo}le escucho con toda atención. De las cuatro áreas que le comenté "
                    f"(Infraestructura Cloud, Automatización con IA, Saneamiento de Bases de Datos o Gestión Documental), "
                    f"¿cuál considera que es la mayor prioridad para {company} en este momento?"
                )
            else:
                reply = f"{prefijo}le escucho con toda atención, cuénteme con confianza."
            return ChatTurnResponse(reply=reply, meeting_scheduled=False, interlocutor_label=interlocutor_label)

        # 3.13. FALLBACK: TURNO AVANZADO O TERCERO DESCONOCIDO
        if sara_turn_count >= 1 or role in ["asistente", "intermediario"] or name:
            nombre_saludo = f"Don {name}, " if name else (f"{prefijo}" if prefijo else "")
            return ChatTurnResponse(
                reply=f"{nombre_saludo}con el mayor gusto le escucho. Cuénteme, ¿en cuál de nuestras áreas tecnológicas (Infraestructura Cloud, Automatización con IA, Saneamiento de Bases de Datos o Gestión Documental) consideran que tienen mayor prioridad en este momento?",
                meeting_scheduled=False,
                interlocutor_label=interlocutor_label
            )

        if has_known_target and target_first:
            reply = f"{prefijo}{saludo}. En INNOVAIT apoyamos a {company} en soluciones de Infraestructura Cloud, Automatización con IA, Saneamiento de Bases de Datos y Gestión Documental. ¿Sería tan amable de indicarme a qué hora puedo ubicar a don {target_first} o con quién tengo el gusto de hablar?"
        else:
            reply = f"{prefijo}{saludo}. En INNOVAIT apoyamos a {company} en soluciones de Infraestructura Cloud, Automatización con IA, Saneamiento de Bases de Datos y Gestión Documental. ¿Sería tan amable de indicarme quién lidera o comanda el equipo de tecnología o sistemas, o con quién tengo el gusto de hablar?"

        return ChatTurnResponse(
            reply=reply,
            meeting_scheduled=False,
            interlocutor_label=interlocutor_label
        )

    except Exception as e:
        logger.error(f"[LiveChatTurn] Error: {e}", exc_info=True)
        return ChatTurnResponse(
            reply="Qué pena con usted, se escuchó un poco entrecortado. ¿Podría repetirme por favor?",
            meeting_scheduled=False
        )


VOICE_MAP = {
    # Voces 100% colombianas oficiales
    "salome": "es-CO-SalomeNeural",     # Femenina comercial colombiana (Voz oficial de Sara)
    "gonzalo": "es-CO-GonzaloNeural",   # Masculina corporativa colombiana
    # Voces latinoamericanas de alta fidelidad sin ceceo español
    "paloma": "es-US-PalomaNeural",     # Femenina ejecutiva moderna (Latina neutra)
    "dalia": "es-MX-DaliaNeural",       # Femenina consultiva suave (Latina neutra)
    "jorge": "es-MX-JorgeNeural",       # Masculina formal consultiva (Latino neutro)
    # Compatibilidad con los nombres anteriores
    "aoede": "es-CO-SalomeNeural",
    "kore": "es-US-PalomaNeural",
    "puck": "es-MX-JorgeNeural",
    "charon": "es-CO-GonzaloNeural",
}


@router.get("/tts")
async def generate_speech(
    text: str = Query(..., description="Texto a sintetizar"),
    speaker: str = Query("Sara", description="Nombre del interlocutor"),
    voice_id: Optional[str] = Query(None, description="Voz neuronal específica seleccionada (salome, gonzalo, paloma, dalia, jorge)")
):
    """
    Sintetiza voz neuronal hiperrealista en Español de Colombia (es-CO) o Latinoamérica con caché local:
    - salome / aoede: es-CO-SalomeNeural (Voz femenina colombiana comercial, cálida y natural)
    - gonzalo / charon: es-CO-GonzaloNeural (Voz masculina colombiana, sobria y ejecutiva)
    - paloma / kore: es-US-PalomaNeural (Voz femenina ejecutiva moderna, dinámica)
    - dalia: es-MX-DaliaNeural (Voz femenina suave y consultiva)
    - jorge / puck: es-MX-JorgeNeural (Voz masculina formal consultiva)
    """
    try:
        import edge_tts

        # Limpiar prefijos del tipo 'Sara: ' o '**Cliente**: ' para que la voz no lea los nombres del guion
        clean_text = re.sub(r'^\s*(\*\*)?[a-zA-ZÁÉÍÓÚáéíóúñÑ\s]+(\*\*)?\s*:\s*', '', text).strip()
        clean_text = clean_text.replace("*", "").strip()
        if not clean_text:
            clean_text = text

        # Aplicar fonética nativa colombiana (Simón, O-C-R, E-R-P)
        clean_text = phonetize_for_colombian_tts(clean_text)

        # Selección de voz neuronal según preferencia del usuario
        selected_key = (voice_id or "").lower().strip()
        if selected_key in VOICE_MAP:
            voice = VOICE_MAP[selected_key]
        elif selected_key.startswith("es-"):
            voice = voice_id
        else:
            is_sara = any(k in speaker.lower() for k in ["sara", "maggie"])
            voice = "es-US-PalomaNeural" if is_sara else "es-MX-JorgeNeural"

        rate = "+5%" if "paloma" in voice.lower() or "dalia" in voice.lower() else "+2%"
        pitch = "+1Hz" if "paloma" in voice.lower() or "dalia" in voice.lower() else "-1Hz"

        # Verificar si el archivo de audio ya existe en la caché local para respuesta instantánea
        cache_key = hashlib.md5(f"{voice}_{rate}_{pitch}_{clean_text}".encode("utf-8")).hexdigest()
        cache_file = TTS_CACHE_DIR / f"{cache_key}.mp3"

        if cache_file.exists() and cache_file.stat().st_size > 0:
            try:
                with open(cache_file, "rb") as f:
                    cached_bytes = f.read()
                return Response(
                    content=cached_bytes,
                    media_type="audio/mpeg",
                    headers={
                        "Cache-Control": "public, max-age=86400",
                        "Accept-Ranges": "bytes",
                        "Content-Length": str(len(cached_bytes)),
                        "Content-Disposition": "inline; filename=speech.mp3"
                    }
                )
            except Exception as read_err:
                logger.warning(f"[TTS Cache Read] {read_err}")

        # Sintetizar usando el modelo neuronal seleccionado
        communicate = edge_tts.Communicate(clean_text, voice, rate=rate, pitch=pitch)
        audio_buffer = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.extend(chunk["data"])

        audio_bytes = bytes(audio_buffer)
        if audio_bytes:
            try:
                with open(cache_file, "wb") as f:
                    f.write(audio_bytes)
            except Exception as write_err:
                logger.warning(f"[TTS Cache Write] {write_err}")

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Accept-Ranges": "bytes",
                "Content-Length": str(len(audio_bytes)),
                "Content-Disposition": "inline; filename=speech.mp3"
            }
        )
    except Exception as e:
        logger.error(f"[VoiceRouter] Error en síntesis TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando audio: {str(e)}")

