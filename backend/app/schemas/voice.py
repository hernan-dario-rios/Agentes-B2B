from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CallStatus(str, Enum):
    QUEUED = "QUEUED"
    DIALING = "DIALING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    NO_ANSWER = "NO_ANSWER"
    BUSY = "BUSY"
    VOICEMAIL = "VOICEMAIL"


class CallDispatchPayload(BaseModel):
    opportunity_id: str = Field(..., description="ID de la oportunidad a contactar")
    phone: str = Field(..., description="Número telefónico a marcar (+57 ...)")
    contact_name: Optional[str] = Field(None, description="Nombre del contacto")
    contact_role: Optional[str] = Field(None, description="Cargo del contacto")
    custom_instructions: Optional[str] = Field(None, description="Instrucciones o contexto adicional para Sara")
    preferred_voice: str = Field(default="Aoede", description="Voz de Gemini Live (Aoede, Kore, Puck, Fenrir, Charon)")


class CallReportPayload(BaseModel):
    job_id: str = Field(..., description="ID del trabajo de llamada")
    status: CallStatus = Field(..., description="Estado final de la llamada")
    duration_seconds: int = Field(default=0, description="Duración de la llamada en segundos")
    transcript: Optional[str] = Field(None, description="Transcripción completa del diálogo")
    summary: Optional[str] = Field(None, description="Resumen ejecutivo del resultado de la llamada")
    meeting_scheduled: bool = Field(default=False, description="¿Se logró agendar una demo virtual de 15 min?")
    meeting_datetime: Optional[str] = Field(None, description="Fecha y hora tentativa acordada para la demo")
    confirmed_email: Optional[str] = Field(None, description="Correo electrónico confirmado por el interlocutor")
    confirmed_phone: Optional[str] = Field(None, description="Teléfono móvil o extensión directa confirmada")
    objections_handled: List[str] = Field(default_factory=list, description="Objeciones que se presentaron y manejaron")


class CallJob(BaseModel):
    job_id: str
    opportunity_id: str
    company_name: str
    contact_name: str
    contact_role: str
    phone: str
    status: CallStatus = CallStatus.QUEUED
    system_prompt: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: int = 0
    transcript: Optional[str] = None
    summary: Optional[str] = None
    meeting_scheduled: bool = False
    meeting_datetime: Optional[str] = None
    confirmed_email: Optional[str] = None
    confirmed_phone: Optional[str] = None
    objections_handled: List[str] = Field(default_factory=list)
    objections_handled: List[str] = Field(default_factory=list)
