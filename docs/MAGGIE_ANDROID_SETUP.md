# Guía de Puesta a Punto: Agente de Voz Maggie (Opción 3 - Celular Android SIM Dedicada)

**Proyecto:** INNOVAIT Transformación Digital — Flota Multi-Agente B2B  
**Agente de Llamadas:** Maggie  
**Referencia Arquitectónica:** [viajatech/agente-isabella](https://github.com/viajatech/agente-isabella)  
**Modelo de Inteligencia:** Google Gemini Live Multimodal API  

---

## 1. Visión General de la Arquitectura (Opción 3)

La **Opción 3** implementa una estación de llamadas telefónicas reales basada en un teléfono celular Android dedicado con una tarjeta SIM colombiana física (Claro, Tigo, Movistar o WOM).

```
┌────────────────────────────────┐       HTTP / JSON        ┌───────────────────────────────┐
│     Backend INNOVAIT           │ ◄──────────────────────► │   Celular Android con SIM     │
│   (FastAPI + LangGraph)        │                          │   (Root Magisk + Audio Bridge)│
│                                │                          │                               │
│ - Cola de llamadas (/pending)  │                          │ - App/Daemon puente de Maggie │
│ - System Prompt dinámico       │                          │ - Marcación nativa GSM        │
│ - Procesador BANT (/report)    │                          │ - Inyección directa de audio  │
└────────────────────────────────┘                          └──────────────┬────────────────┘
                                                                           │
                                            ┌──────────────────────────────┴──────────────────────────────┐
                                            ▼                                                             ▼
                             Llamada Celular GSM (+57)                                    Stream Bidireccional WebSocket
                             a Interlocutores B2B                                         con Google Gemini Live API
                             (>80% de tasa de contestación)                               (Latencia ultra baja <400ms)
```

### ¿Por qué esta arquitectura supera a VoIP tradicional en Colombia?
1. **Identificador Móvil Confiable (+57 3xx...):** Las empresas y directores rechazan llamadas de números fijos desconocidos o números VoIP internacionales (+1, +44, etc.). Un número móvil colombiano tiene más del 80% de apertura.
2. **Sin Eco ni Ruido Ambiental:** El módulo Magisk inyecta y captura el audio directamente en el flujo de hardware del módem celular, eliminando la necesidad de altavoces o micrófonos externos.
3. **Seguridad y Token Efímero:** El teléfono nunca almacena claves maestras; solicita credenciales temporales al backend de INNOVAIT.

---

## 2. Requerimientos

### Hardware
* Teléfono Android (versiones recomendadas: Android 11 a Android 14).
* Tarjeta SIM colombiana activa con plan postpago o prepago con minutos ilimitados a todo operador nacional.
* Conexión Wi-Fi estable con baja latencia hacia internet.
* Cargador conectado permanentemente.

### Software en el Dispositivo
* **Magisk v26+** o **KernelSU** instalado y con permisos de superusuario activados.
* Módulo de audio routing (Audio HAL / RIL injection) para redirigir el audio PCM bidireccional entre la llamada telefónica y el stream WebSocket.
* Daemon o servicio en segundo plano de Maggie (`maggie_client.py` o APK dedicado).

---

## 3. Protocolo de Comunicación con el Backend INNOVAIT

El celular interactúa con la API de INNOVAIT a través de tres endpoints principales:

### A. Consultar llamadas en cola
* **Endpoint:** `GET /api/v1/voice/pending`
* **Frecuencia:** Sondeo cada 10 a 15 segundos cuando el teléfono esté en reposo (idle).
* **Respuesta:** Lista de objetos `CallJob` con el número a marcar, nombre del contacto y el `system_prompt` generado específicamente para esa empresa.

### B. Notificar inicio de marcación (Claim)
* **Endpoint:** `POST /api/v1/voice/claim/{job_id}`
* **Acción:** El teléfono reserva el trabajo para evitar marcaciones duplicadas. El estado cambia a `DIALING` y luego a `IN_PROGRESS` cuando la otra parte descuelga.

### C. Entregar reporte y transcripción al colgar
* **Endpoint:** `POST /api/v1/voice/report`
* **Cuerpo JSON:**
```json
{
  "job_id": "call_6631adbf9e4a",
  "status": "completed",
  "duration_seconds": 128,
  "transcript": [
    { "speaker": "Contacto", "text": "Aló, buenos días, ¿con quién hablo?" },
    { "speaker": "Maggie", "text": "Hola, muy buenos días. Le habla Maggie, asistente de inteligencia artificial de INNOVAIT Transformación Digital..." }
  ],
  "summary": "Se contactó con el Gerente de Operaciones. Confirmó que tienen más de 60,000 expedientes en papel en bodega y aceptó reunión virtual.",
  "meeting_scheduled": true,
  "meeting_datetime": "Jueves 10:00 AM vía Google Meet",
  "confirmed_email": "operaciones@empresa.com",
  "confirmed_phone": "+57 310 444 5555",
  "objections_handled": ["mándeme un correo", "ya tenemos proveedor"]
}
```
* **Efecto automático:** Al recibir este reporte con `meeting_scheduled = true`, el orquestador avanza automáticamente la oportunidad a **Gate 3: Validación Alcance BANT**, extrayendo dolor, presupuesto y fecha de demo.

---

## 4. Reglas Críticas del System Prompt de Maggie

Maggie opera bajo estrictas directrices comerciales adaptadas al contexto colombiano:

1. **Transparencia Legal Obligatoria:**  
   En la primera intervención tras el saludo, Maggie declara explícitamente:  
   > *"Le habla Maggie, asistente de inteligencia artificial de INNOVAIT Transformación Digital..."*
2. **Turn-Taking Breve (Turnos Cortos):**  
   Intervenciones de máximo 1 a 2 oraciones (menos de 20 palabras por turno) para que suene como una conversación humana real y no como una grabación.
3. **Pitch de 30 Segundos DocumentTrack:**  
   Enfocado en resolver el dolor del archivo físico: digitalización, OCR con IA, reducción del costo de bodegas y cumplimiento regulatorio ante DIAN / Superfinanciera / Mintransporte.
4. **Manejo de Objeciones Comunes:**
   * *"¿Quién le dio mi teléfono?"* ➔ *"Llamo directamente a la línea corporativa registrada de la empresa para presentar soluciones tecnológicas."*
   * *"Mándeme un correo"* ➔ *"Con mucho gusto se lo envío. Para enviarle el caso de uso exacto, ¿cuántas sedes o expedientes manejan aproximadamente?"*
   * *"No hay presupuesto"* ➔ *"Lo comprendo bien. Precisamente DocumentTrack busca generar ahorros reduciendo los costos mensuales de custodia física en bodega."*
5. **Fusibles de Seguridad:**
   * **Buzón de voz:** Si detecta tono o mensaje de buzón, cuelga en menos de 4 segundos.
   * **Límite de tiempo:** Duración máxima estricta de 3 minutos para mantener el interés y cerrar la cita.

---

## 5. Modo de Simulación y Validación Sin Celular Físico

Para validar y calibrar a Maggie sin necesidad de tener el teléfono celular conectado:

1. Ingresa al panel de control en **`http://localhost:3000`**.
2. En la pestaña **Bandeja de Aprobaciones**, busca cualquier oportunidad en **Gate 2 (Aprobación Outreach)** (por ejemplo, *Óptica Colombiana* o *Coofinep*).
3. Haz clic en el botón destacado: **`Llamar con Maggie (Voz IA)`**.
4. En el modal emergente, selecciona la pestaña **`Simulación con IA (Gemini)`** y pulsa **`Iniciar Simulación de Llamada Ahora`**.
5. Verás en vivo la conversación simulada, el manejo de objeciones y la transcripción completa.
6. Pulsa **`Aprobar y Avanzar a Gate 3`** para avanzar la oportunidad en el Pipeline Kanban con un solo clic.
