import pytest
from main import health_check
from app.api.v1.catalog import get_catalog
from app.api.v1.opportunities import create_opportunity, list_opportunities, get_opportunity, CreateOpportunityRequest
from app.api.v1.gates import get_pending_gates, submit_gate_decision
from app.schemas.gate import GateDecisionPayload, GateAction, GateType
from app.schemas.opportunity import PipelineStage


def test_health_check_endpoint():
    result = health_check()
    assert result["status"] == "healthy"
    assert "INNOVAIT" in result["service"]
    print(f"\n[OK] Health Check API: {result['service']}")


def test_catalog_endpoint():
    result = get_catalog()
    assert result["company"] == "INNOVAIT Tech Solutions"
    service_ids = [s["id"] for s in result["services"]]
    assert "DOC_MANAGER" in service_ids
    assert "DATA_HYGIENE" in service_ids
    assert "CLOUD_INFRA" in service_ids
    assert "AI_AUTOMATION" in service_ids
    print(f"[OK] Catálogo de Servicios API: {len(service_ids)} líneas de servicios verificadas")


def test_update_service_pricing_endpoint():
    from app.api.v1.catalog import update_service_pricing, update_service_details, UpdatePricingTiersRequest, UpdateServiceDetailsRequest
    
    # 1. Probar actualización de precios
    new_pricing = {
        "AUDIT_AND_PLAN": {"fixed_fee_usd": 2700, "duration_weeks": 2, "deliverables": "Auditoría avanzada"},
        "STANDARD_CLEANSING": {"fixed_fee_usd": 7200, "duration_weeks": 4, "deliverables": "Depuración 500k"},
        "ENTERPRISE_MIGRATION": {"fixed_fee_usd": 15000, "duration_weeks": 8, "deliverables": "Migración crítica"}
    }
    res = update_service_pricing("DATA_HYGIENE", UpdatePricingTiersRequest(pricing_tiers=new_pricing))
    assert res["status"] == "success"
    assert res["pricing_tiers"]["AUDIT_AND_PLAN"]["fixed_fee_usd"] == 2700

    # 2. Probar actualización conjunta de descripción y tarifas
    res_details = update_service_details("DATA_HYGIENE", UpdateServiceDetailsRequest(
        summary="Servicio integral de diagnóstico, normalización y deduplicación avanzada de bases de datos empresariales.",
        pricing_tiers=new_pricing
    ))
    assert res_details["status"] == "success"
    assert "deduplicación avanzada" in res_details["summary"]

    # Revertir a valores estándar para consistencia
    orig_pricing = {
        "AUDIT_AND_PLAN": {"fixed_fee_usd": 2500, "duration_weeks": 2, "deliverables": "Informe exhaustivo de anomalías y plan de remediación"},
        "STANDARD_CLEANSING": {"fixed_fee_usd": 6800, "duration_weeks": 4, "deliverables": "Depuración hasta 500,000 registros, normalización y pipelines de carga limpia"},
        "ENTERPRISE_MIGRATION": {"fixed_fee_usd": 14500, "duration_weeks": 8, "deliverables": "Limpieza profunda masiva, refactorización de esquemas y migración de BD crítica"}
    }
    update_service_details("DATA_HYGIENE", UpdateServiceDetailsRequest(
        summary="Servicio especializado de diagnóstico, limpieza, normalización y deduplicación de bases de datos relacionales y NoSQL.",
        pricing_tiers=orig_pricing
    ))
    print(f"[OK] Endpoint PUT /catalog/service/DATA_HYGIENE (descripción y tarifas) probado y revertido exitosamente")


def test_opportunity_and_gate_routes():
    # 1. Crear oportunidad vía ruta de API
    req = CreateOpportunityRequest(
        company_name="Corporación Textil Andina",
        website="https://www.textilandina.com",
        country="Colombia"
    )
    opp = create_opportunity(req)
    assert opp.stage == PipelineStage.WAITING_HUMAN_APPROVAL
    assert opp.current_gate == GateType.GATE_1_TARGET
    opp_id = opp.opportunity_id
    print(f"[OK] Endpoint POST /opportunities: Creado ID {opp_id} en Gate 1")

    # 2. Consultar bandeja de pendientes vía ruta de API
    pending = get_pending_gates()
    assert any(p.opportunity_id == opp_id for p in pending)
    print(f"[OK] Endpoint GET /gates/pending: {len(pending)} compuertas en espera de revisión humana")

    # 3. Enviar decisión de aprobación para Gate 1
    decision = GateDecisionPayload(
        action=GateAction.APPROVE,
        user_name="Directora de Operaciones",
        feedback="Prospecto calificado estratégicamente"
    )
    updated = submit_gate_decision(opp_id, decision)
    assert updated.current_gate == GateType.GATE_2_OUTREACH
    assert updated.outreach is not None
    print(f"[OK] Endpoint POST /gates/{opp_id}/decision: Aprobado Gate 1 -> Avanzado a Gate 2")

    # 4. Obtener detalle de la oportunidad
    detail = get_opportunity(opp_id)
    assert detail.opportunity_id == opp_id
    assert len(detail.gate_history) == 1
    print(f"[OK] Endpoint GET /opportunities/{opp_id}: Verificado estado e historial de compuertas")


if __name__ == "__main__":
    test_health_check_endpoint()
    test_catalog_endpoint()
    test_opportunity_and_gate_routes()
