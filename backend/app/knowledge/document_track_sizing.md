# DocumentTrack: Arquitectura y Dimensionamiento de Infraestructura

## 1. Descripción de Componentes del Sistema
Para el despliegue de la plataforma de recepción de facturas, extracción OCR y validación XML/CUFE, la infraestructura se divide en cuatro capas contenerizadas (Docker):
- **Capa de Aplicación y API (Web/App Tier)**: Servidores ejecutando el backend en Python (FastAPI). Gestiona la interfaz de usuario, endpoints y la lógica de orquestación.
- **Capa de Procesamiento Asíncrono (Worker Tier)**: Nodos dedicados a tareas pesadas en segundo plano (validación de reglas de negocio, extracción de datos vía Gemini AI API, validación de XML y códigos CUFE).
- **Capa de Base de Datos (Data Tier)**: Instancias de PostgreSQL para almacenamiento transaccional de metadatos, estado de facturas y configuraciones (SQLite reservado únicamente para entornos de desarrollo local).
- **Capa de Almacenamiento (Storage Tier)**: Almacenamiento de objetos (S3/GCS) para los archivos físicos (PDFs originales, facturas escaneadas, comprobantes XML).

---

## 2. Matriz de Dimensionamiento Cloud (Sizing Tiers)

| Perfil de Carga | Volumen Mensual | Capa App & Worker (FastAPI/Docker) | Capa Base de Datos (PostgreSQL) | Almacenamiento de Objetos | Balanceo y Red |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Básico** | < 5,000 docs/mes | 1 Instancia (2 vCPU, 4GB RAM) | 1 Instancia (2 vCPU, 4GB RAM, 50GB SSD) | ~10 GB / mes (AWS S3 Standard o GCP Standard) | Application Load Balancer simple (AWS ALB) |
| **Tier 2: Intermedio** | 5,000 a 50,000 docs/mes | 2 Instancias (4 vCPU, 8GB RAM c/u) con Auto-Scaling | Instancia Activo/Pasivo (4 vCPU, 8GB RAM, 100GB IOPS SSD) | ~100 GB / mes + Política de ciclo de vida (Glacier a los 90 días) | ALB + HAProxy para Rate Limiting y reglas L7 |
| **Tier 3: Empresarial** | > 50,000 docs/mes | Cluster Kubernetes (GKE/EKS) / Mínimo 3 Nodos (8 vCPU, 16GB RAM) | Cluster PostgreSQL de Alta Disponibilidad (8 vCPU, 32GB RAM, 500GB SSD IOPS) | > 500 GB / mes + Almacenamiento Inmutable (WORM) para auditoría | Gateway API / WAF + CDN para assets estáticos |

---

## 3. Especificaciones Técnicas y Consideraciones RAG
### Integración con Gemini AI (Procesamiento OCR y Extracción)
- **Latencia de Red**: Despliegue en regiones cloud con baja latencia hacia endpoints de Google (GCP nativo o AWS us-east-1).
- **Concurrencia**: Manejo de Rate Limits mediante colas asíncronas (Celery/Redis) y reintentos con backoff exponencial.

### Almacenamiento y Retención (Data Lifecycle)
- **Ciclo de Vida**: Transición de Hot Storage (acceso en milisegundos) a Cold Storage (AWS Glacier / GCP Archive) tras el cierre contable (30 a 90 días).
- **Tamaño Promedio**: 200 KB a 500 KB por paquete documental (PDF + XML).

### Seguridad y Continuidad del Negocio (ISO 27001)
- **Cifrado**: AES-256 en reposo (EBS / Persistent Disks / S3) y TLS 1.2+ en tránsito.
- **Resiliencia**: Multi-AZ obligatorio para entornos Intermedios y Empresariales.
- **Observabilidad**: Logs estructurados y trazabilidad completa desde la ingesta hasta el CUFE y la IA.

### Pipeline de CI/CD
- Despliegue continuo mediante GitHub Actions con autenticación OIDC hacia registros de contenedores (ECR/GCP Artifact Registry).
- Escaneo continuo de vulnerabilidades en dependencias Python y capas base Docker.
