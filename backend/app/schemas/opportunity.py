from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.gate import GateHistoryRecord, GateType


class PipelineStage(str, Enum):
    LEAD_DISCOVERED = "LEAD_DISCOVERED"
    WAITING_HUMAN_APPROVAL = "WAITING_HUMAN_APPROVAL"
    OUTREACH_ACTIVE = "OUTREACH_ACTIVE"
    DISCOVERY_QUALIFIED = "DISCOVERY_QUALIFIED"
    PROPOSAL_READY = "PROPOSAL_READY"
    CONTRACTING = "CONTRACTING"
    WON = "WON"
    LOST = "LOST"
    MANUAL_TAKEOVER = "MANUAL_TAKEOVER"


class ServiceCategory(str, Enum):
    DOC_MANAGER = "DOC_MANAGER"
    DATA_HYGIENE = "DATA_HYGIENE"
    CLOUD_INFRA = "CLOUD_INFRA"
    AI_AUTOMATION = "AI_AUTOMATION"


class ContactPerson(BaseModel):
    name: str
    role: str
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    phone: Optional[str] = None
    status: str = "PENDING_CONTACT"


class ICPData(BaseModel):
    industry: str
    size_employees: Optional[int] = None
    annual_revenue_range: Optional[str] = None
    current_stack: List[str] = Field(default_factory=list)
    pain_points: List[str] = Field(default_factory=list)
    fit_score: int = Field(default=0, ge=0, le=100)
    icp_reasoning: str = ""


class OutreachSequence(BaseModel):
    channel: str = "EMAIL"  # EMAIL, LINKEDIN, WHATSAPP, CALL
    subject: str = ""
    body_markdown: str = ""
    whatsapp_message: Optional[str] = None
    call_script: Optional[str] = None
    followup_variants: List[str] = Field(default_factory=list)
    sent_at: Optional[datetime] = None
    prospect_response: Optional[str] = None


class DiscoveryBANT(BaseModel):
    budget: Optional[str] = None
    authority: Optional[str] = None
    need: Optional[str] = None
    timeline: Optional[str] = None
    technical_requirements: List[str] = Field(default_factory=list)
    critical_success_factors: List[str] = Field(default_factory=list)
    meeting_transcript_summary: Optional[str] = None


class SolutionProposal(BaseModel):
    target_services: List[ServiceCategory] = Field(default_factory=list)
    architecture_overview: str = ""
    recommended_packages: List[str] = Field(default_factory=list)
    pricing: Dict[str, Any] = Field(default_factory=dict)
    timeline_weeks: int = 4
    deliverables: List[str] = Field(default_factory=list)
    discount_percentage: float = 0.0
    technical_risks: List[str] = Field(default_factory=list)


class ContractDraft(BaseModel):
    contract_title: str = "Acuerdo Marco de Servicios Tecnológicos"
    client_legal_name: str = ""
    tax_id: str = ""
    sla_tier: str = "Standard 99.5%"
    payment_terms: str = "50% anticipo, 50% contra entrega de hitos"
    clauses_summary: List[str] = Field(default_factory=list)
    special_exceptions: List[str] = Field(default_factory=list)
    signature_ready_pdf_url: Optional[str] = None


class OpportunityContext(BaseModel):
    opportunity_id: str
    company_name: str
    website: Optional[str] = None
    country: str = "Colombia"
    tax_id: Optional[str] = None
    address: Optional[str] = None
    target_services: List[ServiceCategory] = Field(default_factory=list)
    stage: PipelineStage = PipelineStage.LEAD_DISCOVERED
    current_gate: Optional[GateType] = GateType.GATE_1_TARGET
    
    # Datos enriquecidos por agentes
    icp_data: ICPData = Field(default_factory=lambda: ICPData(industry="General Tech"))
    contacts: List[ContactPerson] = Field(default_factory=list)
    outreach: Optional[OutreachSequence] = None
    discovery: Optional[DiscoveryBANT] = None
    solution_proposal: Optional[SolutionProposal] = None
    contract: Optional[ContractDraft] = None
    
    # Trazabilidad HITL
    gate_history: List[GateHistoryRecord] = Field(default_factory=list)
    last_human_feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HuntLeadsRequest(BaseModel):
    sector: str = Field(default="Transporte de Carga y Logística", description="Sector industrial objetivo")
    city: str = Field(default="Medellín y Antioquia", description="Ciudad o región geográfica")
    company_type: str = Field(default="all", description="Tipo de empresa: 'all', 'sme' (PyMEs sin web) o 'corporate' (Con web y TI)")
    limit: int = Field(default=5, ge=1, le=10, description="Cantidad de prospectos a descubrir (1 a 10)")


class HuntedCandidate(BaseModel):
    company_name: str
    website: Optional[str] = None
    city: str
    sector: str
    estimated_size: Optional[str] = None
    key_driver: str
    is_sme: bool = False
    opportunity_id: Optional[str] = None


class HuntLeadsResponse(BaseModel):
    status: str
    discovered_count: int
    sector: str
    city: str
    company_type: str
    message: str
    opportunities: List[OpportunityContext]

