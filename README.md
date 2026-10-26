# INNOVAIT B2B Multi-Agent Sales System (HITL)

Sistema de agentes de inteligencia artificial especializados para la prospección, calificación, dimensionamiento de soluciones tecnológicas y cierre de ventas B2B, implementado bajo un modelo **Human-in-the-Loop (HITL)** donde los agentes ejecutan el trabajo pesado y el humano mantiene el control en compuertas de aprobación estratégicas.

---

## 🎯 Portafolio de Soluciones Tecnológicas

1. **Gestión Documental Empresarial (INNOVAIT DocManager) [Producto Insignia]**:
   - Digitalización inteligente con OCR semántico.
   - Expedientes digitales centralizados con control de roles y permisos (RBAC).
   - Motor de flujos de trabajo (Workflows) y firmas electrónicas.
   - Cumplimiento normativo y trazabilidad inmutable.
2. **Orden y Depuración de Bases de Datos**:
   - Auditoría y perfilado de calidad de datos.
   - Deduplicación algorítmica y normalización de esquemas.
   - Gobernanza y saneamiento para migraciones críticas.
3. **Implementación y Gestión de Infraestructuras Cloud**:
   - Migración y modernización a AWS, Azure y Google Cloud.
   - Arquitecturas de alta disponibilidad, Kubernetes y Disaster Recovery.
   - FinOps, monitoreo 24/7 y administración delegada.
4. **Automatización con IA**:
   - RAG corporativo sobre normativas y documentación interna.
   - Agentes de soporte y automatización de flujos con n8n y APIs.
   - Extracción estructurada de documentos no estructurados.

---

## 🤖 Flota de Agentes y Compuertas Humanas (Approval Gates)

```
[Lead Input] 
     │
     ▼
1. Scraper & Enricher Agent ────────► [GATE 1: Validación de Target]
                                               │ (Aprobado)
                                               ▼
2. SDR / Outreach Agent     ────────► [GATE 2: Aprobación de Envío/Escalado]
                                               │ (Aprobado)
                                               ▼
3. Discovery & Triage Agent ────────► [GATE 3: Validación de Alcance BANT]
                                               │ (Aprobado)
                                               ▼
4. Solutions Architect Agent ───────► [GATE 4: Revisión Pricing & Técnica]
                                               │ (Aprobado)
                                               ▼
5. Deal Desk & Legal Agent   ───────► [GATE 5: Firma & Términos Legales]
                                               │ (Aprobado)
                                               ▼
                                      [Oportunidad GANADA (WON)]
```

### Opciones en cada Compuerta
- **`APPROVE`**: Dispara la ejecución del siguiente agente o despacho externo.
- **`MODIFY`**: Re-ejecuta el agente con las instrucciones y modificaciones inyectadas por el humano.
- **`OVERRIDE`**: Detiene la automatización y pasa la cuenta a control manual.

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
- Python 3.11+
- Docker y Docker Compose
- Node.js 18+ (para el dashboard web)

### 2. Configuración del Entorno
```bash
cp .env.example .env
```
Configura tu `GEMINI_API_KEY` en `.env` (si no se especifica, el sistema usa generación heurística controlada para pruebas locales).

### 3. Levantar Base de Datos (PostgreSQL + pgvector)
```bash
docker compose up -d
```

### 4. Instalar Dependencias del Backend
```bash
pip install -r backend/requirements.txt
```

### 5. Iniciar Servidor FastAPI (Backend)
```bash
cd backend
python main.py
```
- **Documentación Swagger interactiva**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Documentación ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 6. Iniciar Dashboard Web Next.js (Command Center HITL)
```bash
cd frontend
npm run dev
```
- **Command Center Inbox & Kanban**: [http://localhost:3000](http://localhost:3000)

### 7. Ejecutar Demostración Comercial End-to-End en Consola
```bash
$env:PYTHONPATH="backend"
python backend/demo_company_lifecycle.py
```
Simula el ciclo completo de una cuenta empresarial de transporte y logística (`Transportes & Logística del Valle S.A.S.`) a través de los 5 agentes y las 5 compuertas de decisión HITL con dimensionamiento de infraestructura DocumentTrack.

### 8. Ejecutar Batería de Pruebas Automatizadas
```bash
$env:PYTHONPATH="backend"
pytest backend/tests -v
```

---

## 📂 Estructura del Proyecto

```
Agentes-B2B/
├── docker-compose.yml              # PostgreSQL + pgvector
├── .env.example                    # Plantilla de variables de entorno
├── README.md                       # Documentación del proyecto
└── backend/
    ├── requirements.txt            # Dependencias Python
    ├── main.py                     # Entrypoint de FastAPI
    ├── app/
    │   ├── core/                   # Configuración, DB y cliente Gemini
    │   ├── schemas/                # Modelos Pydantic (OpportunityContext, Gates)
    │   ├── knowledge/              # Catálogo oficial de servicios (services_catalog.json)
    │   ├── services/               # Lógica de negocio y orquestación
    │   ├── graph/                  # Grafo de LangGraph y nodos de agentes
    │   │   ├── state.py            # AgentState compartido
    │   │   ├── workflow.py         # StateGraph con compuertas condicionales
    │   │   └── nodes/              # Implementación de los 5 agentes + interrupter
    │   └── api/v1/                 # Endpoints REST (opportunities, gates, catalog)
    └── tests/                      # Tests unitarios del ciclo HITL y API
```
