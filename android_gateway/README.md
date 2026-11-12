# 📱 Sara Android SIM Gateway — Guía de Implementación Paso a Paso

Esta guía explica cómo convertir tu teléfono celular Android con tarjeta SIM física (Claro, Tigo, Movistar, WOM) en el marcador telefónico oficial del sistema multi-agente de **INNOVAIT**.

---

## 🏗️ ¿Cómo Funciona la Arquitectura?

```
┌─────────────────────────────────┐                         ┌─────────────────────────────────┐
│     Command Center Web (AWS)    │                         │    Celular Android con SIM      │
│     https://b2b.innovait.io     │                         │        (Línea Móvil +57)        │
│                                 │                         │                                 │
│ 1. Clic en "Despachar a Celular"│ ──► [Cola /pending] ──► │ 2. Daemon detecta la orden      │
│                                 │                         │ 3. Marca vía SIM física nativa  │
│ 5. Oportunidad avanza a GATE 3  │ ◄── [Reporte /report] ◄─┤ 4. Entrega reporte y resultado  │
└─────────────────────────────────┘                         └─────────────────────────────────┘
```

---

## 🛠️ Paso 1: Instalar Aplicaciones Requeridas en el Celular Android

En tu teléfono celular Android, instala las siguientes dos aplicaciones gratuitas de código abierto:

1. **Termux (Terminal Linux para Android):**  
   * **Importante:** No la descargues de Google Play Store (la versión de Play Store está desactualizada por restricciones de Google).
   * Descárgala directamente desde **F-Droid** o su repositorio oficial:  
     👉 [Descargar Termux en F-Droid](https://f-droid.org/es/packages/com.termux/) *(o el APK directo desde GitHub de Termux)*.

2. **Termux:API (Conector de Telefonía y Hardware):**  
   * Descárgala también desde F-Droid:  
     👉 [Descargar Termux:API en F-Droid](https://f-droid.org/es/packages/com.termux.api/).

---

## ⚙️ Paso 2: Conceder Permisos en Android

1. Ve a **Ajustes de Android ➔ Aplicaciones ➔ Termux:API ➔ Permisos**.
2. Concede los siguientes permisos:
   * **Teléfono / Llamadas:** *Permitir siempre* (permite hacer llamadas salientes por la SIM card).
   * **Notificaciones:** *Permitir*.
3. En **Ajustes de Batería**, desactiva el "Ahorro de batería" para Termux (para que Android no cierre la aplicación cuando la pantalla se apague).

---

## 📥 Paso 3: Copiar los Scripts al Celular

Abre la aplicación **Termux** en tu celular y clona tu repositorio o descarga directamente la carpeta `android_gateway`:

### Opción A: Vía Git (Recomendada)
```bash
pkg install -y git
git clone https://github.com/hrios75/Agentes-B2B.git
cd Agentes-B2B/android_gateway
```

### Opción B: Copiando los dos archivos directamente
Si prefieres pasar los archivos por cable USB, WhatsApp Web o Google Drive a la carpeta de descargas de tu celular:
```bash
termux-setup-storage
cp /sdcard/Download/setup_termux.sh .
cp /sdcard/Download/sara_android_client.py .
```

---

## 🚀 Paso 4: Ejecutar el Script de Configuración (`setup_termux.sh`)

Dentro de Termux, ejecuta el primer script:

```bash
bash setup_termux.sh
```

### ¿Qué hace este script automáticamente?
* Activa `termux-wake-lock` para mantener el procesador del celular activo.
* Actualiza los repositorios de paquetes de Termux.
* Instala `Python`, `pip`, `termux-api`, `jq` y `curl`.
* Instala las librerías de Python requeridas (`requests`, `urllib3`).
* Prueba la conexión hacia `https://b2b.innovait.io`.

---

## 📞 Paso 5: Iniciar el Daemon de Llamadas (`sara_android_client.py`)

Una vez finalizada la configuración, inicia el servicio continuo de escucha:

```bash
python sara_android_client.py
```

*Verás en la pantalla de Termux:*
```text
==========================================================
🎙️ INNOVAIT - SARA ANDROID SIM GATEWAY DAEMON
==========================================================
Servidor backend:    https://b2b.innovait.io
Frecuencia sondeo:   Cada 10 segundos
Estado:              ESCUCHANDO COLA EN TIEMPO REAL...
==========================================================
```

### Opciones de ejecución avanzadas:
* **Si estás probando en red local (desarrollo):**
  ```bash
  python sara_android_client.py --server http://192.168.1.100:8000
  ```
* **Cambiar el intervalo de sondeo (ej. cada 5 segundos):**
  ```bash
  python sara_android_client.py --interval 5
  ```

---

## 🧪 Paso 6: Prueba en Vivo de Extremo a Extremo (E2E)

1. En tu computadora entra a `https://b2b.innovait.io`.
2. Presiona el botón morado superior **`🧪 Demo E2E (Llamada Sara)`**.
3. En la tarjeta de **Gate 1**, haz clic en **"Aprobar Prospecto"** para que avance a **Gate 2**.
4. En **Gate 2**, haz clic en **`📞 Llamar con Sara (Voz IA)`**.
5. Ve a la pestaña **`Despacho a Android / PBX`** y pulsa el botón azul:  
   **"Despachar a la Cola del Celular Android"**.
6. **¡Observa tu celular Android!**
   - El celular vibrará.
   - En la pantalla de Termux aparecerá la orden con el nombre de la empresa y el número.
   - La aplicación del teléfono de Android se abrirá y **marcará automáticamente por la SIM card**.
   - Al finalizar la llamada, Termux te presentará un menú rápido de 1 tecla para consignar el resultado (Reunión agendada, ocupado, etc.).
   - Al enviar el resultado, la oportunidad en el Command Center web avanzará automáticamente a **Gate 3: Validación BANT**.
