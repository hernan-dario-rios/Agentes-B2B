import json
import logging
from datetime import datetime, timezone
from app.graph.state import AgentState
from app.schemas.gate import GateType
from app.schemas.opportunity import PipelineStage, ContractDraft
from app.core.llm import get_chat_model
from app.core.config import settings

logger = logging.getLogger(__name__)


def legal_agent_node(state: AgentState) -> AgentState:
    """
    Agente 5: Deal Desk & Legal Agent.
    Genera el contrato de servicios, acuerdos SLA, términos de pago y matriz de responsabilidades.
    """
    opp = state.opportunity
    logger.info(f"[Legal Agent] Redactando contrato y SLA para {opp.company_name}")
    
    feedback_note = f" Considerar feedback de términos legales: '{state.human_feedback}'" if state.human_feedback else ""
    modifications = state.human_modifications or {}
    
    llm = get_chat_model(settings.DEFAULT_REASONING_MODEL)
    if llm:
        prompt = f"""
        Actúa como General Counsel y Legal Ops Specialist de INNOVAIT.
        Oportunidad:
        - Empresa Cliente: {opp.company_name} (País: {opp.country})
        - Propuesta Aprobada: {opp.solution_proposal.model_dump_json() if opp.solution_proposal else 'No disponible'}
        {feedback_note}
        Ajustes legales solicitados: {json.dumps(modifications)}

        Genera los términos del contrato y matriz contractual.
        Responde en JSON estricto con:
        - contract_title (string)
        - client_legal_name (string)
        - tax_id (string de identificación tributaria ficticio o provisto)
        - sla_tier (string: ej. 99.7% disponibilidad con tiempo de respuesta < 1 hora)
        - payment_terms (string: hitos de pago claros)
        - clauses_summary (lista de 4 cláusulas críticas: confidencialidad, propiedad intelectual del cliente, limitación de responsabilidad y ciberseguridad)
        - special_exceptions (lista de excepciones pactadas)
        """
        try:
            response = llm.invoke(prompt)
            content = response.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            
            opp.contract = ContractDraft(
                contract_title=data.get("contract_title", "Contrato Marco de Servicios Tecnológicos y Licenciamiento"),
                client_legal_name=data.get("client_legal_name", f"{opp.company_name} S.A.S."),
                tax_id=data.get("tax_id", "NIT 900.823.102-4"),
                sla_tier=data.get("sla_tier", "SLA Platinum 99.8% disponibilidad anual"),
                payment_terms=data.get("payment_terms", "40% firma, 30% entrega de hito 1, 30% acta de liquidación"),
                clauses_summary=data.get("clauses_summary", []),
                special_exceptions=data.get("special_exceptions", []),
                signature_ready_pdf_url=f"/api/v1/contracts/{opp.opportunity_id}/preview.pdf"
            )
        except Exception as e:
            logger.warning(f"Error procesando LLM en Legal, usando fallback: {e}")
            _apply_fallback_legal(opp, modifications)
    else:
        _apply_fallback_legal(opp, modifications)

    opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
    opp.current_gate = GateType.GATE_5_LEGAL
    opp.updated_at = datetime.now(timezone.utc)
    
    state.reasoning_logs.append(
        f"Legal Agent preparó contrato y SLA para {opp.company_name}. Listo para firma en Gate 5."
    )
    return state


def _apply_fallback_legal(opp, modifications):
    payment = modifications.get("payment_terms", "40% al inicio de trabajos, 30% despliegue de infraestructura y contenedores, 30% acta de entrega final y pruebas CUFE")
    sla = modifications.get("sla_tier", "SLA Enterprise 99.8% disponibilidad con soporte 24/7 y RTO < 4 horas")
    
    opp.contract = ContractDraft(
        contract_title="Contrato de Licenciamiento de Software DocumentTrack y Servicios Cloud",
        client_legal_name=f"{opp.company_name} S.A.",
        tax_id="NIT 901.458.712-1",
        sla_tier=sla,
        payment_terms=payment,
        clauses_summary=[
            "Propiedad Intelectual: El cliente conserva titularidad exclusiva e inalterable de todos sus documentos, facturas y bases de datos.",
            "Seguridad ISO 27001: Cifrado mandatorio AES-256 en reposo (S3 y volúmenes EBS/Persistent Disks) y TLS 1.2+ en tránsito.",
            "Continuidad Operativa: Arquitectura Multi-AZ con réplicas activas/pasivas y backups inmutables con política WORM.",
            "Confidencialidad & Cumplimiento: Cláusula de confidencialidad estricta y cumplimiento de ciclo de vida documental hacia Cold Storage (Glacier)."
        ],
        special_exceptions=[
            "Cláusula especial: Transición automática de documentos a almacenamiento frío tras el cierre contable (90 días) para optimización de OPEX."
        ],
        signature_ready_pdf_url=f"/api/v1/contracts/{opp.opportunity_id}/preview.pdf"
    )
