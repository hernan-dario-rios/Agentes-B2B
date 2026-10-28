import logging
import httpx
from typing import Optional
from app.services.enrichment.base import BaseEnricherProvider, EnrichedRawData

logger = logging.getLogger(__name__)


class ApolloProvider(BaseEnricherProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.apollo.io/v1"

    def enrich(self, company_name: str, domain: Optional[str] = None) -> Optional[EnrichedRawData]:
        if not self.api_key:
            return None

        clean_domain = domain.replace("https://", "").replace("http://", "").strip("/").split("/")[0] if domain else ""
        if clean_domain.startswith("www."):
            clean_domain = clean_domain[4:]
        logger.info(f"[ApolloProvider] Consultando organización para domain={clean_domain} o name={company_name}")

        technologies = []
        contacts = []
        industry = None
        employees = None
        revenue = None

        try:
            with httpx.Client(timeout=10.0) as client:
                # 1. Enriquecer Organización
                org_url = f"{self.base_url}/organizations/enrich"
                params = {"api_key": self.api_key}
                if clean_domain:
                    params["domain"] = clean_domain
                else:
                    params["name"] = company_name

                res_org = client.get(org_url, params=params)
                if res_org.status_code == 200:
                    data = res_org.json().get("organization", {})
                    industry = data.get("industry")
                    employees = data.get("estimated_num_employees")
                    revenue = data.get("annual_revenue_printed")
                    technologies = data.get("current_technologies", [])
                    if isinstance(technologies, list):
                        technologies = [t.get("name", t) if isinstance(t, dict) else str(t) for t in technologies[:8]]

                # 2. Buscar tomadores de decisión (CTO, CIO, IT Director, Operations)
                people_url = f"{self.base_url}/mixed_people/search"
                headers = {"Content-Type": "application/json", "Cache-Control": "no-cache"}
                people_body = {
                    "api_key": self.api_key,
                    "q_organization_domains": clean_domain if clean_domain else None,
                    "q_organization_name": company_name if not clean_domain else None,
                    "person_titles": [
                        "Director de TI", "CTO", "CIO", "Head of IT",
                        "Director de Operaciones", "Gerente de Tecnología", "Líder de Sistemas"
                    ],
                    "page": 1,
                    "per_page": 3
                }
                res_people = client.post(people_url, json=people_body, headers=headers)
                if res_people.status_code == 200:
                    people_list = res_people.json().get("people", [])
                    for p in people_list:
                        contacts.append({
                            "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Contacto Clave",
                            "role": p.get("title", "Responsable de TI"),
                            "email": p.get("email"),
                            "linkedin_url": p.get("linkedin_url"),
                            "source": "Apollo.io"
                        })

            return EnrichedRawData(
                provider_name="Apollo.io",
                company_name=company_name,
                domain=clean_domain,
                industry=industry,
                employees_count=employees,
                estimated_revenue=revenue,
                technologies_detected=technologies,
                contacts_found=contacts
            )
        except Exception as e:
            logger.error(f"[ApolloProvider] Error consultando Apollo: {e}")
            return None
