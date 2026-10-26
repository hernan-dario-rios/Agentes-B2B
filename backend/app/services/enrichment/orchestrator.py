import logging
from typing import Optional, List, Dict, Any
from app.core.config import settings
from app.services.enrichment.apollo_provider import ApolloProvider
from app.services.enrichment.hunter_provider import HunterProvider
from app.services.enrichment.linkedin_provider import LinkedInProvider
from app.services.enrichment.base import EnrichedRawData

logger = logging.getLogger(__name__)


class EnrichmentOrchestrator:
    def __init__(self):
        self.apollo = ApolloProvider(settings.APOLLO_API_KEY)
        self.hunter = HunterProvider(settings.HUNTER_API_KEY)
        self.linkedin = LinkedInProvider(settings.LINKEDIN_PROXY_API_KEY)

    def enrich_company(self, company_name: str, domain: Optional[str] = None) -> Dict[str, Any]:
        """
        Consulta en cascada o paralela los proveedores configurados (Apollo, Hunter, LinkedIn)
        y compila una síntesis estructurada para alimentar al Scraper & Enricher Agent.
        """
        aggregated: Dict[str, Any] = {
            "company_name": company_name,
            "domain": domain,
            "industry": None,
            "employees_count": None,
            "estimated_revenue": None,
            "technologies_detected": [],
            "contacts_found": [],
            "providers_used": []
        }

        # 1. Intentar Apollo.io (ideal para stack técnico, tamaño y cargos clave)
        apollo_res = self.apollo.enrich(company_name, domain)
        if apollo_res:
            aggregated["providers_used"].append("Apollo.io")
            aggregated["industry"] = apollo_res.industry
            aggregated["employees_count"] = apollo_res.employees_count
            aggregated["estimated_revenue"] = apollo_res.estimated_revenue
            aggregated["technologies_detected"].extend(apollo_res.technologies_detected)
            aggregated["contacts_found"].extend(apollo_res.contacts_found)

        # 2. Intentar Hunter.io (ideal para verificar correos y ejecutivos)
        hunter_res = self.hunter.enrich(company_name, domain)
        if hunter_res:
            aggregated["providers_used"].append("Hunter.io")
            # Unir contactos evitando duplicados por email
            existing_emails = {c.get("email") for c in aggregated["contacts_found"] if c.get("email")}
            for c in hunter_res.contacts_found:
                if c.get("email") not in existing_emails:
                    aggregated["contacts_found"].append(c)

        # 3. Intentar LinkedIn Provider si está configurado
        linkedin_res = self.linkedin.enrich(company_name, domain)
        if linkedin_res:
            aggregated["providers_used"].append("LinkedIn")

        logger.info(
            f"[EnrichmentOrchestrator] Enriquecimiento para {company_name}: "
            f"Proveedores activos={aggregated['providers_used']}, "
            f"Contactos={len(aggregated['contacts_found'])}, "
            f"Tecnologías={len(aggregated['technologies_detected'])}"
        )
        return aggregated


# Singleton
enrichment_orchestrator = EnrichmentOrchestrator()
