from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class EnrichedRawData(BaseModel):
    provider_name: str
    company_name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    employees_count: Optional[int] = None
    estimated_revenue: Optional[str] = None
    technologies_detected: list[str] = Field(default_factory=list)
    contacts_found: list[Dict[str, Any]] = Field(default_factory=list)
    raw_payload: Dict[str, Any] = Field(default_factory=dict)


class BaseEnricherProvider(ABC):
    @abstractmethod
    def enrich(self, company_name: str, domain: Optional[str] = None) -> Optional[EnrichedRawData]:
        """Consulta la API externa para enriquecer la empresa dada."""
        pass
