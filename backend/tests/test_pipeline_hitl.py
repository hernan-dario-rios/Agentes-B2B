import pytest
from app.services.opportunity_service import OpportunityService
from app.schemas.gate import GateAction, GateDecisionPayload, GateType
from app.schemas.opportunity import PipelineStage


def test_full_hitl_sales_lifecycle():
    service = OpportunityService()
    
    # 1. Iniciar Oportunidad -> Ejecuta Enricher Agent y se detiene en Gate 1
    opp = service.create_opportunity(
        company_name="Logística Global del Caribe",
        website="https://www.logisticacaribe.com",
        country="Colombia"
    )
    
    assert opp.stage == PipelineStage.WAITING_HUMAN_APPROVAL
    assert opp.current_gate == GateType.GATE_1_TARGET
    assert opp.icp_data.fit_score > 0
    assert len(opp.contacts) > 0
    print(f"\n[OK] Gate 1 alcanzado para {opp.company_name}. Fit score: {opp.icp_data.fit_score}")

    # Verificar que aparece en el Inbox de pendientes
    pending = service.get_pending_gates()
    assert any(p.opportunity_id == opp.opportunity_id for p in pending)

    # 2. Humano Aprueba Gate 1 -> Avanza al Agente 2 (SDR) y se detiene en Gate 2
    opp = service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - Director Comercial"
        )
    )
    assert opp.current_gate == GateType.GATE_2_OUTREACH
    assert opp.outreach is not None
    assert opp.outreach.subject != ""
    print(f"[OK] Gate 2 alcanzado. Asunto propuesto: {opp.outreach.subject}")

    # 3. Humano solicita Ajuste en Gate 2 (MODIFY) con Feedback -> SDR re-ejecuta
    opp = service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.MODIFY,
            feedback="Enfocar el correo prioritariamente en el desorden de bases de datos antes de la gestión documental",
            user_name="Hernan - Director Comercial"
        )
    )
    assert opp.current_gate == GateType.GATE_2_OUTREACH
    assert opp.last_human_feedback is not None
    print(f"[OK] Gate 2 modificado con feedback: {opp.last_human_feedback}")

    # 4. Humano Aprueba Gate 2 -> Avanza al Agente 3 (Discovery) y se detiene en Gate 3
    opp = service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - Director Comercial"
        )
    )
    assert opp.current_gate == GateType.GATE_3_DISCOVERY
    assert opp.discovery is not None
    assert len(opp.discovery.technical_requirements) > 0
    print(f"[OK] Gate 3 alcanzado. Requerimientos detectados: {len(opp.discovery.technical_requirements)}")

    # 5. Humano Aprueba Gate 3 -> Avanza al Agente 4 (Solutions Architect) y se detiene en Gate 4
    opp = service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - Consultor Técnico"
        )
    )
    assert opp.current_gate == GateType.GATE_4_ARCHITECT
    assert opp.solution_proposal is not None
    assert len(opp.solution_proposal.recommended_packages) > 0
    print(f"[OK] Gate 4 alcanzado. Paquetes recomendados: {opp.solution_proposal.recommended_packages}")

    # 6. Humano Ajusta Pricing en Gate 4 (MODIFY con modificaciones explícitas)
    opp = service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.MODIFY,
            feedback="Ajustar descuento a 15% por pago anticipado anual",
            modifications={"discount_percentage": 15.0},
            user_name="Hernan - VP Sales"
        )
    )
    assert opp.current_gate == GateType.GATE_4_ARCHITECT
    assert opp.solution_proposal.discount_percentage == 15.0

    # 7. Humano Aprueba Gate 4 -> Avanza al Agente 5 (Deal Desk & Legal) y se detiene en Gate 5
    opp = service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - VP Sales"
        )
    )
    assert opp.current_gate == GateType.GATE_5_LEGAL
    assert opp.contract is not None
    assert opp.contract.sla_tier != ""
    print(f"[OK] Gate 5 alcanzado. Contrato: {opp.contract.contract_title} - SLA: {opp.contract.sla_tier}")

    # 8. Humano Aprueba Gate 5 -> Oportunidad GANADA (WON) y flujo completado
    opp = service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Legal & Commercial Director"
        )
    )
    assert opp.stage == PipelineStage.WON
    assert len(opp.gate_history) >= 5
    print(f"[OK] ¡Oportunidad {opp.company_name} GANADA exitosamente con trazabilidad completa de {len(opp.gate_history)} decisiones humanas!")


if __name__ == "__main__":
    test_full_hitl_sales_lifecycle()
