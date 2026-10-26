import json
import logging
from datetime import datetime, timezone
from app.graph.state import AgentState
from app.schemas.gate import GateType, GateStatus
from app.schemas.opportunity import PipelineStage, ICPData, ContactPerson
from app.core.llm import get_chat_model
from app.services.enrichment.orchestrator import enrichment_orchestrator

logger = logging.getLogger(__name__)


def enricher_agent_node(state: AgentState) -> AgentState:
    """
    Agente 1: Scraper & Enricher Agent.
    Investiga la empresa mediante APIs de enriquecimiento (Apollo, Hunter, LinkedIn),
    analiza stack tecnológico, detecta dolores y calcula ICP Match Score.
    """
    opp = state.opportunity
    logger.info(f"[Enricher Agent] Investigando empresa: {opp.company_name} (Web: {opp.website})")
    
    # 1. Consulta multi-proveedor (Apollo.io, Hunter.io, LinkedIn)
    enriched_api_data = enrichment_orchestrator.enrich_company(opp.company_name, opp.website)
    
    # Si hay retroalimentación previa de un Gate 1 previo (MODIFY)
    feedback_note = f" Considerar feedback humano: '{state.human_feedback}'" if state.human_feedback else ""
    
    # 2. Análisis con LLM (Gemini) sobre los datos recolectados
    llm = get_chat_model()
    
    if llm:
        prompt = f"""
        Actúa como un analista senior de prospección B2B tecnológica para INNOVAIT.
        Nuestros servicios son:
        1. Gestión Documental Empresarial (INNOVAIT DocManager) [Producto Insignia]
        2. Orden y Depuración de Bases de Datos
        3. Infraestructuras Cloud (AWS/Azure/GCP)
        4. Automatización con IA
        
        Datos de la empresa:
        - Nombre: {opp.company_name} (País: {opp.country}, Web: {opp.website})
        - Datos de APIs externas (Apollo/Hunter/LinkedIn): {json.dumps(enriched_api_data, default=str)}
        {feedback_note}
        
        Analiza la información y genera un JSON estricto con:
        - industry (string)
        - size_employees (int aproximado)
        - annual_revenue_range (string)
        - current_stack (lista de 3 a 5 tecnologías detectadas o probables)
        - pain_points (lista de 3 dolores críticos que sufren con respecto a documentos, datos, cloud o automatización)
        - fit_score (int de 0 a 100 que evalúa el ajuste con nuestro portafolio)
        - icp_reasoning (explicación concisa del fit comercial y oportunidad para INNOVAIT)
        - suggested_contacts (lista con 1 o 2 contactos clave: name, role, email, linkedin_url)
        """
        try:
            response = llm.invoke(prompt)
            content = response.content.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            
            opp.icp_data = ICPData(
                industry=data.get("industry", enriched_api_data.get("industry") or "Servicios Empresariales"),
                size_employees=data.get("size_employees", enriched_api_data.get("employees_count") or 250),
                annual_revenue_range=data.get("annual_revenue_range", enriched_api_data.get("estimated_revenue") or "5M - 15M USD"),
                current_stack=data.get("current_stack", enriched_api_data.get("technologies_detected") or ["Servidores On-Premise", "SQL Server legacy"]),
                pain_points=data.get("pain_points", ["Descontrol documental", "Inconsistencia de datos"]),
                fit_score=data.get("fit_score", 85),
                icp_reasoning=data.get("icp_reasoning", "Alto ajuste para Gestión Documental y Modernización Cloud.")
            )
            
            # Incorporar contactos detectados por APIs o sugeridos por LLM
            existing_emails = set()
            for c in enriched_api_data.get("contacts_found", []):
                email = c.get("email")
                if email and email not in existing_emails:
                    existing_emails.add(email)
                    opp.contacts.append(ContactPerson(
                        name=c.get("name", "Líder de TI"),
                        role=c.get("role", "Head of IT"),
                        email=email,
                        linkedin_url=c.get("linkedin_url")
                    ))

            for c in data.get("suggested_contacts", []):
                email = c.get("email", f"contacto@{opp.company_name.lower().replace(' ', '')}.com")
                if email not in existing_emails:
                    existing_emails.add(email)
                    opp.contacts.append(ContactPerson(
                        name=c.get("name", "Director de Operaciones / TI"),
                        role=c.get("role", "Head of IT & Operations"),
                        email=email,
                        linkedin_url=c.get("linkedin_url")
                    ))
        except Exception as e:
            logger.warning(f"Error procesando LLM en enricher, usando fallback heurístico: {e}")
            _apply_fallback_enrichment(opp, enriched_api_data)
    else:
        _apply_fallback_enrichment(opp, enriched_api_data)

    opp.stage = PipelineStage.WAITING_HUMAN_APPROVAL
    opp.current_gate = GateType.GATE_1_TARGET
    opp.updated_at = datetime.now(timezone.utc)
    
    providers_str = f" vía [{', '.join(enriched_api_data['providers_used'])}]" if enriched_api_data["providers_used"] else ""
    state.reasoning_logs.append(
        f"Enricher Agent completó perfilado para {opp.company_name}{providers_str}. ICP Fit Score: {opp.icp_data.fit_score}/100."
    )
    return state


def _apply_fallback_enrichment(opp, enriched_api_data=None):
    """Enriquecimiento heurístico con contexto realista del portafolio INNOVAIT"""
    api_contacts = enriched_api_data.get("contacts_found", []) if enriched_api_data else []
    api_tech = enriched_api_data.get("technologies_detected", []) if enriched_api_data else []
    
    opp.icp_data = ICPData(
        industry="Servicios Financieros / Logística",
        size_employees=320,
        annual_revenue_range="8M - 20M USD",
        current_stack=api_tech if api_tech else ["Windows Server 2016", "PostgreSQL / SQL Server desnormalizado", "Archivo físico en bodegas"],
        pain_points=[
          "Pérdida de trazabilidad en expedientes y contratos físicos",
          "Duplicidad recurrente de clientes en la base de datos operativa",
          "Servidores locales sin respaldo en nube ni plan de recuperación ante desastres"
        ],
        fit_score=88,
        icp_reasoning="Gran ajuste para INNOVAIT DocManager para digitalización y posterior migración cloud segura."
    )
    
    if api_contacts:
        for c in api_contacts:
            opp.contacts.append(ContactPerson(
                name=c.get("name", "Líder de TI"),
                role=c.get("role", "Head of IT"),
                email=c.get("email"),
                linkedin_url=c.get("linkedin_url")
            ))
    elif not opp.contacts:
        opp.contacts.append(ContactPerson(
            name="Roberto Gómez",
            role="Director de Tecnología y Transformación Digital",
            email=f"roberto.gomez@{opp.company_name.lower().replace(' ', '')}.com"
        ))
