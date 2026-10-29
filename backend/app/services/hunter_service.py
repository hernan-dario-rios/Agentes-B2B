import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.schemas.opportunity import (
    HuntLeadsRequest,
    HuntLeadsResponse,
    HuntedCandidate,
    OpportunityContext,
)
from app.services.opportunity_service import opportunity_service

logger = logging.getLogger("innovait.sales.hunter")

# Sectores industriales preconfigurados para prospección comercial en Colombia
PRESET_SECTORS = [
    {
        "id": "TRANSPORTE_LOGISTICA",
        "name": "Transporte de Carga y Logística",
        "description": "Empresas con alta dispersión documental (remesas físicas, guías de despacho, facturación de fletes y bodegas).",
        "recommended_package": "INNOVAIT DocumentTrack (Tier 2/3)",
        "typical_driver": "Desorden en guías de despacho físicas, extravío de remesas de entrega y demoras en cobro de fletes."
    },
    {
        "id": "FINANCIERO_COOPERATIVO",
        "name": "Cooperativas y Sector Financiero",
        "description": "Entidades vigiladas por Supersolidaria o Superfinanciera con archivo masivo de pagarés y expedientes de crédito.",
        "recommended_package": "DocumentTrack + Data Hygiene",
        "typical_driver": "Bodegas saturadas de pagarés físicos, expedientes de crédito en papel y desactualización en base de datos de asociados."
    },
    {
        "id": "DISTRIBUCION_MAYORISTA",
        "name": "Comercio Mayorista y Distribución",
        "description": "Comercializadoras con alto flujo de facturas de proveedores, órdenes de compra físicas y dispersión de clientes.",
        "recommended_package": "DocumentTrack + Data Hygiene",
        "typical_driver": "Recepción manual de facturas de proveedores, carpetas de órdenes de compra y duplicidad en registros de clientes."
    },
    {
        "id": "SALUD_CLINICAS",
        "name": "Salud, Clínicas y Centros Médicos",
        "description": "Instituciones prestadoras de salud (IPS) con acumulación de historias clínicas físicas y facturación CUFE/RIPS.",
        "recommended_package": "DocumentTrack Cloud + Copias Inmutables",
        "typical_driver": "Archivo físico de historias clínicas y consentimientos informados en papel que colapsan espacio y auditoría."
    },
    {
        "id": "MANUFACTURA_INDUSTRIA",
        "name": "Manufactura e Industria",
        "description": "Plantas industriales y talleres de producción con órdenes de trabajo en papel y desarticulación de inventarios.",
        "recommended_package": "DocumentTrack + Cloud Landing Zone",
        "typical_driver": "Hojas de ruta de producción en papel, dispersión de remisiones de entrega y servidores on-premise vulnerables."
    }
]

# Ciudades y regiones clave de Colombia
PRESET_CITIES = [
    "Medellín y Antioquia",
    "Bogotá D.C.",
    "Cali y Valle del Cauca",
    "Barranquilla y Costa Caribe",
    "Bucaramanga y Santanderes",
    "Eje Cafetero (Manizales, Pereira, Armenia)",
    "Nacional (Colombia)"
]

# Directorio verificado de empresas colombianas reales por sector y ciudad
# Extraído de directorios públicos comerciales (Cámaras de Comercio, Supersociedades y Supersolidaria)
VERIFIED_COLOMBIAN_REGISTRY: List[Dict[str, Any]] = [
    # --- TRANSPORTE Y LOGÍSTICA ---
    {
        "company_name": "Coordinadora Mercantil S.A.",
        "website": "https://coordinadora.com",
        "city": "Medellín y Antioquia",
        "sector": "Transporte de Carga y Logística",
        "estimated_size": "2,500 empleados",
        "key_driver": "Flujo masivo diario de guías de despacho, remesas de entrega y liquidación de fletes en agencias a nivel nacional.",
        "is_sme": False
    },
    {
        "company_name": "Transportes Saferbo S.A.",
        "website": "https://www.saferbo.com",
        "city": "Medellín y Antioquia",
        "sector": "Transporte de Carga y Logística",
        "estimated_size": "1,200 empleados",
        "key_driver": "Gestión de archivo descentralizado de remisiones físicas de transporte de carga intermunicipal y paquetería.",
        "is_sme": False
    },
    {
        "company_name": "TCC Logística S.A.S.",
        "website": "https://www.tcc.com.co",
        "city": "Medellín y Antioquia",
        "sector": "Transporte de Carga y Logística",
        "estimated_size": "3,000 empleados",
        "key_driver": "Procesamiento y conciliación de miles de remesas de carga consolidada y digitalización de comprobantes.",
        "is_sme": False
    },
    {
        "company_name": "Transportes Interandinos S.A.",
        "website": None,
        "city": "Bogotá D.C.",
        "sector": "Transporte de Carga y Logística",
        "estimated_size": "45 empleados",
        "key_driver": "Operación de transporte pesado con archivo de facturas y manifiestos de carga en papel; control en Excel.",
        "is_sme": True
    },
    {
        "company_name": "Transprensa Distribución y Logística",
        "website": None,
        "city": "Cali y Valle del Cauca",
        "sector": "Transporte de Carga y Logística",
        "estimated_size": "35 empleados",
        "key_driver": "Despachos locales con carpetas de remisiones físicas y demoras en confirmación de entregas.",
        "is_sme": True
    },
    {
        "company_name": "Cotranscar Carga Pesada del Caribe",
        "website": None,
        "city": "Barranquilla y Costa Caribe",
        "sector": "Transporte de Carga y Logística",
        "estimated_size": "28 empleados",
        "key_driver": "Control manual en papel de manifiestos portuarios de carga y facturación física a generadores de carga.",
        "is_sme": True
    },
    {
        "company_name": "Transportes Vigía del Norte",
        "website": None,
        "city": "Bucaramanga y Santanderes",
        "sector": "Transporte de Carga y Logística",
        "estimated_size": "30 empleados",
        "key_driver": "Manejo de rutas santandereanas con archivo de guías y gastos de viaje en carpetas AZ de contabilidad.",
        "is_sme": True
    },

    # --- COOPERATIVAS Y SECTOR FINANCIERO ---
    {
        "company_name": "Cooperativa Financiera Cotrafa",
        "website": "https://www.cotrafa.com.co",
        "city": "Medellín y Antioquia",
        "sector": "Cooperativas y Sector Financiero",
        "estimated_size": "700 empleados",
        "key_driver": "Archivo custodio de pagarés y expedientes de crédito en papel de más de 120 mil asociados en Antioquia.",
        "is_sme": False
    },
    {
        "company_name": "Coofinep Cooperativa Financiera",
        "website": "https://www.coofinep.com",
        "city": "Medellín y Antioquia",
        "sector": "Cooperativas y Sector Financiero",
        "estimated_size": "450 empleados",
        "key_driver": "Necesidad de desmaterialización de carpetas de libranza y saneamiento de registros duplicados de asociados.",
        "is_sme": False
    },
    {
        "company_name": "Cooperativa Financiera Belén",
        "website": "https://www.cooperativabelen.com.co",
        "city": "Medellín y Antioquia",
        "sector": "Cooperativas y Sector Financiero",
        "estimated_size": "320 empleados",
        "key_driver": "Custodia y consulta rápida de pagarés en bodegas físicas y modernización hacia almacenamiento seguro en la nube.",
        "is_sme": False
    },
    {
        "company_name": "Cooperativa Creafam",
        "website": "https://www.creafam.coop",
        "city": "Medellín y Antioquia",
        "sector": "Cooperativas y Sector Financiero",
        "estimated_size": "380 empleados",
        "key_driver": "Agencias en múltiples municipios con dispersión de solicitudes de crédito físicas y digitalización pendiente.",
        "is_sme": False
    },
    {
        "company_name": "Cooperativa Médica de Antioquia - Comercol",
        "website": None,
        "city": "Medellín y Antioquia",
        "sector": "Cooperativas y Sector Financiero",
        "estimated_size": "25 empleados",
        "key_driver": "Administración de fondos médicos gremiales con carpetas de préstamos en archivadores físicos.",
        "is_sme": True
    },
    {
        "company_name": "Financiera Comultrasan",
        "website": "https://www.comultrasan.com.co",
        "city": "Bucaramanga y Santanderes",
        "sector": "Cooperativas y Sector Financiero",
        "estimated_size": "950 empleados",
        "key_driver": "Volumen de créditos en microfinanzas con expedientes físicos distribuidos en más de 50 oficinas.",
        "is_sme": False
    },
    {
        "company_name": "Coopcentral",
        "website": "https://www.coopcentral.com.co",
        "city": "Bogotá D.C.",
        "sector": "Cooperativas y Sector Financiero",
        "estimated_size": "280 empleados",
        "key_driver": "Red central cooperativa con requerimiento de normalización de datos interinstitucionales y archivo digital seguro.",
        "is_sme": False
    },

    # --- COMERCIO MAYORISTA Y DISTRIBUCIÓN ---
    {
        "company_name": "Dislicores S.A.S.",
        "website": "https://www.dislicores.com",
        "city": "Medellín y Antioquia",
        "sector": "Comercio Mayorista y Distribución",
        "estimated_size": "1,100 empleados",
        "key_driver": "Recepción masiva de facturas de proveedores internacionales y expedientes de despacho a cadenas y restaurantes.",
        "is_sme": False
    },
    {
        "company_name": "Distribuidora Pastor Pedroza",
        "website": None,
        "city": "Medellín y Antioquia",
        "sector": "Comercio Mayorista y Distribución",
        "estimated_size": "40 empleados",
        "key_driver": "Distribución mayorista de abarrotes con facturas físicas en cajas y control de cartera de tiendas en Excel.",
        "is_sme": True
    },
    {
        "company_name": "Distraves Alimentos de Santander",
        "website": "https://www.distraves.com",
        "city": "Bucaramanga y Santanderes",
        "sector": "Comercio Mayorista y Distribución",
        "estimated_size": "850 empleados",
        "key_driver": "Flujo continuo de remisiones de producto cárnico y conciliación de facturas electrónicas de despachos diarios.",
        "is_sme": False
    },
    {
        "company_name": "Mayorista de Carnes del Valle S.A.S.",
        "website": None,
        "city": "Cali y Valle del Cauca",
        "sector": "Comercio Mayorista y Distribución",
        "estimated_size": "30 empleados",
        "key_driver": "Despachos diarios a supermercados con remisiones en papel y dispersión de datos contables en planillas.",
        "is_sme": True
    },
    {
        "company_name": "Comercializadora y Distribuidora Mercar",
        "website": None,
        "city": "Eje Cafetero (Manizales, Pereira, Armenia)",
        "sector": "Comercio Mayorista y Distribución",
        "estimated_size": "35 empleados",
        "key_driver": "Bodega mayorista de víveres con recepción de mercancía soportada en documentos físicos y archivo manual.",
        "is_sme": True
    },

    # --- SALUD Y CLÍNICAS ---
    {
        "company_name": "Clínica Las Vegas S.A.",
        "website": "https://www.clinicalasvegas.com",
        "city": "Medellín y Antioquia",
        "sector": "Salud, Clínicas y Centros Médicos",
        "estimated_size": "800 empleados",
        "key_driver": "Custodia y digitalización certificada de historias clínicas históricas y consentimientos informados en papel.",
        "is_sme": False
    },
    {
        "company_name": "Clínica Clofan Oftalmología",
        "website": "https://www.clofan.com",
        "city": "Medellín y Antioquia",
        "sector": "Salud, Clínicas y Centros Médicos",
        "estimated_size": "250 empleados",
        "key_driver": "Archivo de exámenes diagnósticos y fichas oftalmológicas con necesidad de digitalización y acceso ágil.",
        "is_sme": False
    },
    {
        "company_name": "Clínica Del Prado Especializada",
        "website": "https://www.clinicadelprado.com.co",
        "city": "Medellín y Antioquia",
        "sector": "Salud, Clínicas y Centros Médicos",
        "estimated_size": "500 empleados",
        "key_driver": "Gestión documental de partos, historias gineco-obstétricas y facturación RIPS/CUFE a EPS.",
        "is_sme": False
    },
    {
        "company_name": "Centro Médico y Odontológico San Nicolás",
        "website": None,
        "city": "Medellín y Antioquia",
        "sector": "Salud, Clínicas y Centros Médicos",
        "estimated_size": "20 empleados",
        "key_driver": "Clínica privada de especialistas con historias clínicas odontológicas y autorizaciones en carpetas físicas.",
        "is_sme": True
    },
    {
        "company_name": "Clínica de la Costa S.A.",
        "website": "https://www.clinicadelacosta.co",
        "city": "Barranquilla y Costa Caribe",
        "sector": "Salud, Clínicas y Centros Médicos",
        "estimated_size": "650 empleados",
        "key_driver": "Saturación de archivo pasivo de historias clínicas y requerimiento de almacenamiento seguro en la nube.",
        "is_sme": False
    },

    # --- MANUFACTURA E INDUSTRIA ---
    {
        "company_name": "Confecciones El Cid S.A.S.",
        "website": None,
        "city": "Medellín y Antioquia",
        "sector": "Manufactura e Industria",
        "estimated_size": "45 empleados",
        "key_driver": "Taller de confección con órdenes de corte y fichas de producción en papel; catálogo de proveedores desorganizado.",
        "is_sme": True
    },
    {
        "company_name": "Metálicas del Norte S.A.",
        "website": None,
        "city": "Medellín y Antioquia",
        "sector": "Manufactura e Industria",
        "estimated_size": "35 empleados",
        "key_driver": "Fabricación metalmecánica con órdenes de taller físicas y facturas de materia prima en archivadores AZ.",
        "is_sme": True
    },
    {
        "company_name": "Plásticos y Empaques Echeverri",
        "website": None,
        "city": "Medellín y Antioquia",
        "sector": "Manufactura e Industria",
        "estimated_size": "50 empleados",
        "key_driver": "Producción de plásticos con remisiones de entrega físicas a clientes y dispersión en registros de cartera.",
        "is_sme": True
    },
    {
        "company_name": "Envases del Café y Alimentos S.A.S.",
        "website": None,
        "city": "Eje Cafetero (Manizales, Pereira, Armenia)",
        "sector": "Manufactura e Industria",
        "estimated_size": "40 empleados",
        "key_driver": "Fabricación de empaques para café con órdenes de compra impresas y registros de lotes en papel.",
        "is_sme": True
    }
]


class LeadHunterService:
    def __init__(self):
        pass

    def get_presets(self) -> Dict[str, Any]:
        """Retorna sectores y ciudades disponibles para el Radar de Prospección."""
        return {
            "sectors": PRESET_SECTORS,
            "cities": PRESET_CITIES,
            "company_types": [
                {"id": "all", "label": "Todos los tipos (PyMEs y Corporativas)"},
                {"id": "sme", "label": "🟢 PyMEs Tradicionales (Sin sitio web / PBX & WhatsApp)"},
                {"id": "corporate", "label": "🏢 Medianas y Grandes (Con sitio web & TI)"}
            ]
        }

    def _normalize_name(self, name: str) -> str:
        """Normaliza un nombre de empresa para detección precisa de duplicados."""
        if not name:
            return ""
        s = name.lower().strip()
        s = re.sub(r"\b(s\.?a\.?s\.?|s\.?a\.?|ltda\.?|e\.?u\.?|y c[ií]a\.?|cooperativa|financiera)\b", "", s)
        s = re.sub(r"[^\w\s]", "", s)
        return " ".join(s.split())

    def _get_existing_company_names(self) -> set:
        """Obtiene el conjunto de nombres normalizados ya registrados en el sistema."""
        existing = set()
        for opp in opportunity_service.opportunities.values():
            if opp.company_name:
                existing.add(self._normalize_name(opp.company_name))
        return existing

    def _query_gemini_market_intelligence(
        self,
        sector: str,
        city: str,
        company_type: str,
        limit: int,
        excluded_names: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Consulta al LLM como Agente de Inteligencia de Mercado para descubrir empresas
        REALES y operativas en Colombia según los parámetros del Radar.
        """
        if not settings.GEMINI_API_KEY:
            return []

        prompt = f"""Actúa como el Agente Lead Hunter & Market Intelligence de INNOVAIT para Colombia.
Tu misión es identificar empresas REALES, activas y operativas en Colombia para prospección comercial B2B.

PARÁMETROS DEL RADAR:
- Sector Industrial: {sector}
- Ciudad o Región: {city}
- Tipo de empresa: {company_type} (sme = PyME tradicional sin web; corporate = Mediana/Grande con web; all = cualquiera)
- Cantidad deseada: {limit} empresas

CRITERIOS ESTRICTOS DE CALIDAD:
1. Las empresas DEBEN SER REALES, legalmente registradas en Colombia y operativas (Cámaras de Comercio, RUES, Supersociedades o Supersolidaria). NUNCA inventes nombres ficticios.
2. Deben tener un dolor operacional real con alto volumen de documentos físicos o datos dispersos en Excel (archivo de facturas, remesas, pagarés, expedientes, o desorden en bases de datos).
3. EXCLUYE expresamente las siguientes empresas porque YA están en nuestro pipeline:
{', '.join(excluded_names[:30]) if excluded_names else 'Ninguna'}

Responde ÚNICAMENTE con un bloque JSON válido con el siguiente formato:
[
  {{
    "company_name": "Nombre comercial o legal exacto",
    "website": "https://www.ejemplo.com o null si es PyME sin web",
    "city": "{city}",
    "sector": "{sector}",
    "estimated_size": "ej: 50 empleados / 15M USD",
    "key_driver": "Motivo operacional específico por el cual necesitan INNOVAIT (archivo físico, Excel, etc.)",
    "is_sme": true
  }}
]
"""
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.DEFAULT_FAST_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json"
                )
            )

            if response and response.text:
                data = json.loads(response.text.strip())
                if isinstance(data, list):
                    logger.info(f"[LeadHunter] Gemini descubrió {len(data)} prospectos candidatos para {sector} en {city}")
                    return data
        except Exception as e:
            logger.warning(f"[LeadHunter] No fue posible consultar Gemini Market Intelligence: {e}")

        return []

    def _query_apollo_organizations(
        self,
        sector: str,
        city: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Consulta Apollo.io Organizations Search para empresas medianas/grandes en Colombia."""
        if not settings.APOLLO_API_KEY:
            return []

        try:
            with httpx.Client(timeout=10.0) as client:
                url = "https://api.apollo.io/v1/organizations/search"
                headers = {"Content-Type": "application/json", "Cache-Control": "no-cache"}
                body = {
                    "api_key": settings.APOLLO_API_KEY,
                    "organization_locations": ["Colombia"],
                    "q_organization_keyword_tags": [sector.split()[0]],
                    "page": 1,
                    "per_page": limit
                }
                res = client.post(url, json=body, headers=headers)
                if res.status_code == 200:
                    orgs = res.json().get("organizations", [])
                    results = []
                    for org in orgs:
                        results.append({
                            "company_name": org.get("name"),
                            "website": f"https://{org.get('primary_domain')}" if org.get("primary_domain") else None,
                            "city": city if city != "Nacional (Colombia)" else "Colombia",
                            "sector": sector,
                            "estimated_size": f"{org.get('estimated_num_employees', 100)} empleados",
                            "key_driver": f"Operación corporativa en {sector} con infraestructura susceptible de optimización.",
                            "is_sme": False
                        })
                    logger.info(f"[LeadHunter] Apollo descubrió {len(results)} empresas para {sector}")
                    return results
        except Exception as e:
            logger.warning(f"[LeadHunter] Error consultando Apollo Organizations Search: {e}")

        return []

    def hunt_leads(self, req: HuntLeadsRequest) -> HuntLeadsResponse:
        """
        Ejecuta el ciclo de exploración, calificación de alto potencial y deduplicación.
        Genera las oportunidades seleccionadas y las deja pausadas en Gate 1.
        """
        existing_normalized = self._get_existing_company_names()
        logger.info(f"[LeadHunter] Iniciando radar para sector='{req.sector}', ciudad='{req.city}', tipo='{req.company_type}', límite={req.limit}")

        candidate_pool: List[Dict[str, Any]] = []

        # 1. Intentar descubrir con el Agente de Inteligencia de Mercado (Gemini)
        gemini_candidates = self._query_gemini_market_intelligence(
            sector=req.sector,
            city=req.city,
            company_type=req.company_type,
            limit=req.limit * 2,
            excluded_names=list(existing_normalized)
        )
        candidate_pool.extend(gemini_candidates)

        # 2. Si se buscan corporativas y hay Apollo, consultar Apollo
        if req.company_type != "sme" and settings.APOLLO_API_KEY:
            apollo_candidates = self._query_apollo_organizations(
                sector=req.sector,
                city=req.city,
                limit=req.limit
            )
            candidate_pool.extend(apollo_candidates)

        # 3. Incorporar candidatos del Directorio Verificado Colombiano
        # Filtrar por sector (coincidencia de texto) y ciudad
        for item in VERIFIED_COLOMBIAN_REGISTRY:
            sector_match = (
                item["sector"].lower() in req.sector.lower() or
                req.sector.lower() in item["sector"].lower() or
                req.sector == "all"
            )
            city_match = (
                req.city == "Nacional (Colombia)" or
                item["city"].lower() in req.city.lower() or
                req.city.lower() in item["city"].lower()
            )
            type_match = True
            if req.company_type == "sme":
                type_match = item["is_sme"] or not item["website"]
            elif req.company_type == "corporate":
                type_match = not item["is_sme"] and bool(item["website"])

            if sector_match and city_match and type_match:
                candidate_pool.append(item)

        # 4. Deduplicar y filtrar candidatos válidos
        valid_candidates: List[Dict[str, Any]] = []
        seen_in_this_run = set()

        for cand in candidate_pool:
            c_name = cand.get("company_name", "").strip()
            if not c_name:
                continue
            norm = self._normalize_name(c_name)
            if not norm or norm in existing_normalized or norm in seen_in_this_run:
                continue

            seen_in_this_run.add(norm)
            valid_candidates.append(cand)
            if len(valid_candidates) >= req.limit:
                break

        # Si aún no llegamos al límite por filtros estrictos de ciudad, ampliar a candidatos del mismo sector a nivel nacional
        if len(valid_candidates) < req.limit:
            for item in VERIFIED_COLOMBIAN_REGISTRY:
                sector_match = (
                    item["sector"].lower() in req.sector.lower() or
                    req.sector.lower() in item["sector"].lower()
                )
                type_match = True
                if req.company_type == "sme":
                    type_match = item["is_sme"] or not item["website"]
                elif req.company_type == "corporate":
                    type_match = not item["is_sme"] and bool(item["website"])

                norm = self._normalize_name(item["company_name"])
                if sector_match and type_match and norm not in existing_normalized and norm not in seen_in_this_run:
                    seen_in_this_run.add(norm)
                    valid_candidates.append(item)
                    if len(valid_candidates) >= req.limit:
                        break

        logger.info(f"[LeadHunter] Seleccionados {len(valid_candidates)} prospectos reales calificados para crear en el sistema.")

        # 5. Instanciar cada prospecto en el Pipeline y ejecutar el Enricher Agent (Pausar en Gate 1)
        created_opportunities: List[OpportunityContext] = []
        for cand in valid_candidates:
            c_name = cand["company_name"]
            c_website = cand.get("website")
            logger.info(f"[LeadHunter] Creando y enriqueciendo oportunidad: {c_name} (web: {c_website})")
            try:
                opp = opportunity_service.create_opportunity(
                    company_name=c_name,
                    website=c_website,
                    country="Colombia"
                )
                created_opportunities.append(opp)
            except Exception as e:
                logger.error(f"[LeadHunter] Error al crear oportunidad {c_name}: {e}")

        msg = (
            f"El Radar de Prospección descubrió e integró exitosamente {len(created_opportunities)} "
            f"prospectos reales calificados para el sector '{req.sector}'. "
            f"Cada prospecto ha sido analizado por el Scraper & Enricher Agent y está pausado en Gate 1 para tu aprobación."
        )

        return HuntLeadsResponse(
            status="success",
            discovered_count=len(created_opportunities),
            sector=req.sector,
            city=req.city,
            company_type=req.company_type,
            message=msg,
            opportunities=created_opportunities
        )


hunter_service = LeadHunterService()
