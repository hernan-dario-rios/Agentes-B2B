import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("innovait.sales.catalog")
router = APIRouter(prefix="/catalog", tags=["Catálogo de Servicios"])

CATALOG_PATH = Path(__file__).resolve().parent.parent.parent / "knowledge" / "services_catalog.json"


class UpdatePricingTiersRequest(BaseModel):
    pricing_tiers: Dict[str, Any] = Field(..., description="Estructura actualizada de tarifas para el servicio")


class UpdateServiceDetailsRequest(BaseModel):
    name: Optional[str] = Field(None, description="Nombre visible del servicio")
    summary: Optional[str] = Field(None, description="Descripción o resumen del servicio")
    key_features: Optional[List[str]] = Field(None, description="Características clave")
    pricing_tiers: Optional[Dict[str, Any]] = Field(None, description="Estructura actualizada de tarifas")


def _get_catalog_path() -> Path:
    return CATALOG_PATH


@router.get("/")
def get_catalog():
    """Retorna el catálogo completo de productos y servicios tecnológicos de INNOVAIT."""
    catalog_path = _get_catalog_path()
    if not catalog_path.exists():
        raise HTTPException(status_code=404, detail=f"Archivo de catálogo no encontrado en {catalog_path}")
    
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"[Catalog] Error leyendo {catalog_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Error leyendo archivo de catálogo: {str(e)}")


@router.put("/service/{service_id}")
def update_service_details(service_id: str, req: UpdateServiceDetailsRequest):
    """
    Actualiza la descripción, nombre y/o tarifas base de un servicio específico en el catálogo oficial
    sin requerir tocar archivos de código fuente.
    """
    catalog_path = _get_catalog_path()
    if not catalog_path.exists():
        raise HTTPException(status_code=404, detail=f"Archivo de catálogo no encontrado en {catalog_path}")

    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog_data = json.load(f)
    except Exception as e:
        logger.error(f"[Catalog] Error leyendo JSON de catálogo: {e}")
        raise HTTPException(status_code=500, detail=f"Error leyendo archivo JSON de catálogo: {str(e)}")

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

    # Escritura en disco con manejo automático de permisos y directorio
    try:
        catalog_path.parent.mkdir(parents=True, exist_ok=True)
        with open(catalog_path, "w", encoding="utf-8") as f:
            json.dump(catalog_data, f, indent=2, ensure_ascii=False)
        logger.info(f"[Catalog] Catálogo guardado exitosamente en {catalog_path.name}")
    except PermissionError as pe:
        logger.warning(f"[Catalog] Error de permisos al escribir en {catalog_path}: {pe}. Intentando relajar permisos...")
        try:
            os.chmod(catalog_path, 0o666)
            with open(catalog_path, "w", encoding="utf-8") as f:
                json.dump(catalog_data, f, indent=2, ensure_ascii=False)
        except Exception as retry_err:
            logger.error(f"[Catalog] Falló reintento con chmod: {retry_err}")
            raise HTTPException(
                status_code=500, 
                detail=f"Permiso de escritura denegado en el servidor para {catalog_path.name}: {pe}"
            )
    except Exception as e:
        logger.error(f"[Catalog] Error al escribir en disco: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error escribiendo en catálogo: {str(e)}")

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
