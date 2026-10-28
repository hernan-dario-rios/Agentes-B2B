import logging
import httpx
from typing import Optional
from app.services.enrichment.base import BaseEnricherProvider, EnrichedRawData

logger = logging.getLogger(__name__)


class HunterProvider(BaseEnricherProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.hunter.io/v2"

    def enrich(self, company_name: str, domain: Optional[str] = None) -> Optional[EnrichedRawData]:
        if not self.api_key or not domain:
            return None

        clean_domain = domain.replace("https://", "").replace("http://", "").strip("/").split("/")[0]
        if clean_domain.startswith("www."):
            clean_domain = clean_domain[4:]
        logger.info(f"[HunterProvider] Consultando dominio {clean_domain}")

        contacts = []
        try:
            with httpx.Client(timeout=8.0) as client:
                url = f"{self.base_url}/domain-search"
                params = {
                    "domain": clean_domain,
                    "api_key": self.api_key,
                    "limit": 5,
                    "seniority": "senior,executive"
                }
                res = client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json().get("data", {})
                    emails = data.get("emails", [])
                    for e in emails:
                        first = e.get("first_name", "")
                        last = e.get("last_name", "")
                        name = f"{first} {last}".strip() or "Contacto Ejecutivo"
                        contacts.append({
                            "name": name,
                            "role": e.get("position", "Ejecutivo"),
                            "email": e.get("value"),
                            "linkedin_url": e.get("linkedin"),
                            "confidence": e.get("confidence", 80),
                            "source": "Hunter.io"
                        })
            
            return EnrichedRawData(
                provider_name="Hunter.io",
                company_name=company_name,
                domain=clean_domain,
                contacts_found=contacts
            )
        except Exception as e:
            logger.error(f"[HunterProvider] Error consultando Hunter: {e}")
            return None
