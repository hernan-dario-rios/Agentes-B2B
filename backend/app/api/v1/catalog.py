import os
import json
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/catalog", tags=["Catálogo de Servicios"])


class UpdatePricingTiersRequest(BaseModel):
    pricing_tiers: Dict[str, Any] = Field(..., description="Estructura actualizada de tarifas para el servicio")


class UpdateServiceDetailsRequest(BaseModel):
    name: Optional[str] = Field(None, description="Nombre visible del servicio")
    summary: Optional[str] = Field(None, description="Descripción o resumen del servicio")
    key_features: Optional[List[str]] = Field(None, description="Características clave")
    pricing_tiers: Optional[Dict[str, Any]] = Field(None, description="Estructura actualizada de tarifas")


@router.get("/")
def get_catalog():
    """Retorna el catálogo completo de productos y servicios tecnológicos de INNOVAIT."""
    catalog_path = _get_catalog_path()
    if not os.path.exists(catalog_path):
        raise HTTPException(status_code=404, detail="Archivo de catálogo no encontrado")
    
    with open(catalog_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.put("/service/{service_id}")
def update_service_details(service_id: str, req: UpdateServiceDetailsRequest):
    """
    Actualiza la descripción, nombre y/o tarifas base de un servicio específico en el catálogo oficial
    sin requerir tocar archivos de código fuente.
    """
    catalog_path = _get_catalog_path()
    if not os.path.exists(catalog_path):
        raise HTTPException(status_code=404, detail="Archivo de catálogo no encontrado")

    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog_data = json.load(f)

    target_service = None
    for s in catalog_data.get("services", []):
        if s.get("id") == service_id:
            if req.name is not None and req.name.strip():
                s["name"] = req.name.strip()
            if req.summary is not None and req.summary.strip():
                s["summary"] = req.summary.strip()
            if req.key_features is not None:
                s["key_features"] = req.key_features
            if req.pricing_tiers is not None:
                if "pricing_tiers" not in s or not isinstance(s["pricing_tiers"], dict):
                    s["pricing_tiers"] = {}
                for tier_k, tier_v in req.pricing_tiers.items():
                    if tier_k in s["pricing_tiers"] and isinstance(s["pricing_tiers"][tier_k], dict) and isinstance(tier_v, dict):
                        s["pricing_tiers"][tier_k].update(tier_v)
                    else:
                        s["pricing_tiers"][tier_k] = tier_v
            target_service = s
            break

    if not target_service:
        raise HTTPException(status_code=404, detail=f"Servicio con ID '{service_id}' no encontrado en el catálogo")

    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    return {
        "status": "success",
        "message": f"Servicio '{service_id}' actualizado exitosamente",
        "service_id": service_id,
        "name": target_service.get("name"),
        "summary": target_service.get("summary"),
        "pricing_tiers": target_service.get("pricing_tiers")
    }


@router.put("/service/{service_id}/pricing")
def update_service_pricing(service_id: str, req: UpdatePricingTiersRequest):
    """
    Actualiza directamente los precios base de un servicio específico en el catálogo oficial.
    """
    return update_service_details(
        service_id=service_id,
        req=UpdateServiceDetailsRequest(pricing_tiers=req.pricing_tiers)
    )


def _get_catalog_path() -> str:
    return os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "services_catalog.json")
