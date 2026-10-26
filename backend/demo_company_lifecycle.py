import sys
import os
import time
from datetime import datetime

# Garantizar codificación UTF-8 en consolas Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Añadir ruta de backend
sys.path.insert(0, os.path.dirname(__file__))

from app.services.opportunity_service import opportunity_service
from app.schemas.gate import GateAction, GateDecisionPayload, GateType
from app.schemas.opportunity import PipelineStage


def print_banner(text: str, color: str = "\033[94m"):
    border = "=" * 80
    print(f"\n{color}{border}")
    print(f" {text}")
    print(f"{border}\033[0m\n")


def print_gate_card(opp, gate_number: int, gate_name: str, agent_name: str):
    print(f"\033[93m[COMPUERTA HITL #{gate_number} ALCANZADA: {gate_name}]\033[0m")
    print(f"  [EMPRESA] \033[1m{opp.company_name}\033[0m (ID: {opp.opportunity_id})")
    print(f"  [AGENTE]  \033[96m{agent_name}\033[0m")
    print(f"  [ESTADO]  \033[93mWAITING_HUMAN_APPROVAL\033[0m")


def run_enterprise_demo():
    print_banner("DEMO COMERCIAL B2B: INNOVAIT MULTI-AGENT SALES SYSTEM", "\033[92m")
    print("Iniciando prospección para cuenta target del sector logístico...")
    time.sleep(1)

    # =========================================================================
    # PASO 1: Ingesta de Lead & Agente 1 (Scraper & Enricher) -> GATE 1
    # =========================================================================
    print_banner("FASE 1: PROSPECCIÓN E INTELIGENCIA TÉCNICA (AGENTE 1)", "\033[94m")
    
    company_name = "Transportes & Logística del Valle S.A.S."
    website = "https://www.logisticadelvalle.com"
    country = "Colombia"
    
    print(f"-> Ingestando nuevo prospecto: {company_name}")
    print("-> Ejecutando Scraper & Enricher Agent con APIs (Apollo / Hunter / LinkedIn)...")
    
    opp = opportunity_service.create_opportunity(
        company_name=company_name,
        website=website,
        country=country
    )

    print_gate_card(opp, 1, "VALIDACION DE TARGET", "Scraper & Enricher Agent")
    print("\n  [DATOS] Inteligencia de Cuenta Recolectada:")
    print(f"     * Industria: {opp.icp_data.industry}")
    print(f"     * Empleados estimados: {opp.icp_data.size_employees}")
    print(f"     * Match ICP Score: \033[92m{opp.icp_data.fit_score}/100\033[0m")
    print(f"     * Stack Tecnico Detectado: {', '.join(opp.icp_data.current_stack)}")
    print(f"     * Dolores Criticos de Negocio:")
    for p in opp.icp_data.pain_points:
        print(f"       - {p}")
    if opp.contacts:
        c = opp.contacts[0]
        print(f"     * Contacto Clave Identificado: {c.name} ({c.role}) | {c.email}")

    print("\n\033[95m[DECISION HUMANA EN GATE 1]\033[0m")
    print("-> El comercial valida que la empresa encaja con el perfil ideal.")
    print("-> Accion humana: \033[92m[APPROVE]\033[0m")
    time.sleep(1.5)

    opp = opportunity_service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - Director Comercial",
            feedback="Target estrategico validado. Proceder con acercamiento tecnico."
        )
    )

    # =========================================================================
    # PASO 2: Outreach y Primer Contacto (Agente 2) -> GATE 2
    # =========================================================================
    print_banner("FASE 2: CONTACTO Y NUTRICION (AGENTE 2 - SDR OUTREACH)", "\033[94m")
    print_gate_card(opp, 2, "APROBACION DE ENVIO DE OUTREACH", "SDR / Outreach Agent")

    if opp.outreach:
        print("\n  [OUTREACH] Propuesta de Correo Personalizado (Listo para copiar):")
        print(f"     \033[1mAsunto:\033[0m {opp.outreach.subject}")
        print("     " + "-" * 60)
        for line in opp.outreach.body_markdown.split("\n"):
            print(f"     {line}")
        print("     " + "-" * 60)
        print(f"     Variantes de seguimiento listas: {len(opp.outreach.followup_variants)}")

    print("\n\033[95m[DECISION HUMANA EN GATE 2]\033[0m")
    print("-> El comercial hace clic en \033[96m'Copiar Correo Listo'\033[0m en el Command Center para despacharlo.")
    print("-> Accion humana: \033[92m[APPROVE]\033[0m (El cliente responde interesado solicitando reunion tecnica)")
    time.sleep(1.5)

    # Simular que el prospecto solicita reunión y se aprueba
    opp = opportunity_service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - Director Comercial",
            feedback="El prospecto respondio interesado. Se agenda reunion de descubrimiento."
        )
    )

    # =========================================================================
    # PASO 3: Descubrimiento y Calificacion BANT (Agente 3) -> GATE 3
    # =========================================================================
    print_banner("FASE 3: DESCUBRIMIENTO Y TRIAGE TECNICO (AGENTE 3)", "\033[94m")
    print_gate_card(opp, 3, "VALIDACION DE ALCANCE BANT", "Discovery & Triage Agent")

    if opp.discovery:
        print("\n  [BANT] Diagnostico BANT / MEDDIC Levantado:")
        print(f"     * Presupuesto (Budget): {opp.discovery.budget}")
        print(f"     * Autoridad (Authority): {opp.discovery.authority}")
        print(f"     * Necesidad (Need): {opp.discovery.need}")
        print(f"     * Plazo (Timeline): {opp.discovery.timeline}")
        print("     * Requerimientos Tecnicos Concretos:")
        for r in opp.discovery.technical_requirements:
            print(f"       - {r}")

    print("\n\033[95m[DECISION HUMANA EN GATE 3]\033[0m")
    print("-> El lider tecnico confirma que el alcance levantado es preciso y viable.")
    print("-> Accion humana: \033[92m[APPROVE]\033[0m")
    time.sleep(1.5)

    opp = opportunity_service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - Consultor Preventa",
            feedback="Alcance validado con el cliente. Pasar a dimensionamiento de arquitectura."
        )
    )

    # =========================================================================
    # PASO 4: Solutions Architect con RAG DocumentTrack -> GATE 4
    # =========================================================================
    print_banner("FASE 4: PREVENTA TECNICA Y DIMENSIONAMIENTO RAG (AGENTE 4)", "\033[94m")
    print_gate_card(opp, 4, "REVISION DE ARQUITECTURA Y PRICING", "Solutions Architect Agent (RAG DocumentTrack)")

    if opp.solution_proposal:
        prop = opp.solution_proposal
        print("\n  [ARQUITECTURA] Dimensionamiento DocumentTrack (RAG):")
        print(f"     * Servicios Sugeridos: {[s.value for s in prop.target_services]}")
        print(f"     * Paquetes Oficiales:")
        for pkg in prop.recommended_packages:
            print(f"       - {pkg}")
        print(f"     * Resumen de Arquitectura Cloud:\n       {prop.architecture_overview}")
        print(f"\n     [PRICING] Esquema Tarifario Propuesto:")
        print(f"       - Tarifa de Implementacion: USD ${prop.pricing.get('implementation_fee_usd', 0):,}")
        print(f"       - Licencia Anual DocumentTrack: USD ${prop.pricing.get('annual_license_usd', 0):,}")
        print(f"       - Soporte Cloud Administrado: USD ${prop.pricing.get('managed_services_monthly_usd', 0):,}/mes")
        print(f"       - Plazo de Salida a Produccion: {prop.timeline_weeks} semanas")
        print(f"       - Descuento Vigente: {prop.discount_percentage}%")

    print("\n\033[95m[DECISION HUMANA EN GATE 4]\033[0m")
    print("-> La gerencia comercial revisa margenes y aprueba la propuesta tecnico-economica.")
    print("-> Accion humana: \033[92m[APPROVE]\033[0m")
    time.sleep(1.5)

    opp = opportunity_service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Hernan - VP de Ventas",
            feedback="Propuesta tecnica aprobada con condiciones comerciales estandar."
        )
    )

    # =========================================================================
    # PASO 5: Cierre, Contrato y Legal Ops (Agente 5) -> GATE 5
    # =========================================================================
    print_banner("FASE 5: CIERRE Y CONTRATACION (AGENTE 5 - DEAL DESK & LEGAL)", "\033[94m")
    print_gate_card(opp, 5, "FIRMA Y TERMINOS LEGALES", "Deal Desk & Legal Agent")

    if opp.contract:
        c = opp.contract
        print("\n  [CONTRATO] Borrador Contractual y SLA Oficial:")
        print(f"     * Titulo: {c.contract_title}")
        print(f"     * Razon Social Cliente: {c.client_legal_name} ({c.tax_id})")
        print(f"     * Nivel de Servicio (SLA): \033[92m{c.sla_tier}\033[0m")
        print(f"     * Condiciones de Pago: {c.payment_terms}")
        print("     * Clausulas Clave (ISO 27001 & Continuidad):")
        for cl in c.clauses_summary:
            print(f"       [OK] {cl}")
        if c.special_exceptions:
            print(f"     * Clausula Especial: {c.special_exceptions[0]}")

    print("\n\033[95m[DECISION HUMANA EN GATE 5]\033[0m")
    print("-> El area juridica y gerencia general autorizan la firma digital del contrato.")
    print("-> Accion humana: \033[92m[APPROVE]\033[0m")
    time.sleep(1.5)

    opp = opportunity_service.submit_gate_decision(
        opp.opportunity_id,
        GateDecisionPayload(
            action=GateAction.APPROVE,
            user_name="Direccion Juridica y Gerencia",
            feedback="Contrato revisado y aprobado para firma electronica."
        )
    )

    # =========================================================================
    # RESULTADO FINAL: WON
    # =========================================================================
    print_banner("OPORTUNIDAD GANADA (PIPELINE STAGE: WON)", "\033[92m")
    print(f"  Empresa: \033[1m{opp.company_name}\033[0m")
    print(f"  Estado Final: \033[92m{opp.stage.value}\033[0m")
    print(f"  Total Compuertas Aprobadas: \033[1m{len(opp.gate_history)}\033[0m")
    print("\n  Trazabilidad Completa del Historial HITL:")
    for idx, h in enumerate(opp.gate_history, 1):
        print(f"    {idx}. [{h.gate_type.value}] -> {h.action.value} por '{h.user_name}': {h.feedback}")

    print("\n" + "=" * 80)
    print(" Demostracion concluida con exito. El ciclo completo fue ejecutado")
    print(" por los 5 agentes especializados con control humano en cada compuerta.")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    run_enterprise_demo()
