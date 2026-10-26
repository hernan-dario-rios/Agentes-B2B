import os
import json
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class TechnicalRAGService:
    def __init__(self):
        self.knowledge_dir = os.path.join(os.path.dirname(__file__), "..", "knowledge")
        self.sizing_data = self._load_json("document_track_sizing.json")
        self.catalog_data = self._load_json("services_catalog.json")

    def _load_json(self, filename: str) -> Dict[str, Any]:
        path = os.path.join(self.knowledge_dir, filename)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error cargando base de conocimiento {filename}: {e}")
        return {}

    def retrieve_sizing_tier(self, estimated_monthly_docs: int = 10000) -> Dict[str, Any]:
        """
        Calcula el tier de dimensionamiento exacto de infraestructura para DocumentTrack
        basado en el volumen mensual de documentos estimado.
        """
        tiers = self.sizing_data.get("tiers", [])
        selected_tier = None

        for t in tiers:
            min_v = t.get("monthly_volume_min", 0)
            max_v = t.get("monthly_volume_max", 999999999)
            if min_v <= estimated_monthly_docs < max_v:
                selected_tier = t
                break

        if not selected_tier and tiers:
            selected_tier = tiers[-1]  # Default al último tier

        return {
            "selected_tier": selected_tier,
            "system_layers": self.sizing_data.get("system_layers", []),
            "guidelines": self.sizing_data.get("technical_guidelines", {})
        }

    def retrieve_full_context(self, query: str = "", estimated_monthly_docs: int = 15000) -> str:
        """
        Genera el bloque de contexto estructurado (RAG Prompt Context) listo para
        ser consumido por el Solutions Architect Agent y el Deal Desk Agent.
        """
        tier_info = self.retrieve_sizing_tier(estimated_monthly_docs)
        tier = tier_info.get("selected_tier", {})
        guidelines = tier_info.get("guidelines", {})

        context_str = f"""
=== ESPECIFICACIÓN TÉCNICA OFICIAL: DOCUMENTTRACK / INNOVAIT DOCMANAGER ===
Perfil de Dimensionamiento Calculado: {tier.get('tier_name', 'Tier 2: Intermedio')}
- Volumen Mensual Soportado: {tier.get('monthly_volume_min', 0):,} a {tier.get('monthly_volume_max', 0):,} documentos
- Capa App & Worker: {tier.get('app_worker_spec', 'Contenedores Docker FastAPI con Auto-Scaling')}
- Capa Base de Datos: {tier.get('database_spec', 'PostgreSQL Multi-AZ con réplicas')}
- Almacenamiento & Ciclo de Vida: {tier.get('storage_policy', 'S3 Hot Storage con transición a Glacier')}
- Red, Balanceo y Seguridad: {tier.get('network_security', 'ALB + WAF')}

Lineamientos de Arquitectura Cloud & Seguridad (ISO 27001):
- Integración IA: {guidelines.get('gemini_integration')}
- Retención & Ciclo de Vida: {guidelines.get('data_lifecycle')}
- Cifrado & Resiliencia: {guidelines.get('security_iso27001')}
- Despliegue CI/CD: {guidelines.get('ci_cd')}
==========================================================================
"""
        return context_str


# Singleton
technical_rag_service = TechnicalRAGService()
