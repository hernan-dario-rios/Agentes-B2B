#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# INNOVAIT B2B - SARA VOICE AGENT
# Script de Configuración Inicial en Android (Termux)
# ==============================================================================
# Este script prepara el celular Android para operar como Gateway de Llamadas
# telefónicas GSM reales mediante la tarjeta SIM física.
# ==============================================================================

set -e

echo ""
echo "=========================================================="
echo "🚀 INNOVAIT - Configuración de Sara Android SIM Gateway"
echo "=========================================================="
echo ""

# 1. Asegurar que Termux mantenga la CPU activa (evitar que Android lo suspenda)
echo "[1/6] ⚡ Activando Termux Wake-Lock (mantener CPU despierta)..."
termux-wake-lock || true

# 2. Actualizar lista de paquetes e instalar dependencias básicas
echo "[2/6] 📦 Actualizando repositorios e instalando paquetes base..."
pkg update -y
pkg install -y python python-pip git termux-api jq termux-tools curl

# 3. Instalar librerías de Python para comunicación HTTP y WebSocket
echo "[3/6] 🐍 Instalando librerías de Python..."
pip install --upgrade pip
pip install requests urllib3

# 4. Verificar presencia de Termux:API
echo "[4/6] 🔍 Verificando integración con la app Termux:API..."
if ! command -v termux-telephony-call &> /dev/null; then
    echo "⚠️ ADVERTENCIA: 'termux-telephony-call' no fue detectado en PATH."
    echo "Asegúrate de haber instalado la aplicación 'Termux:API' desde F-Droid."
else
    echo "✓ Herramientas de telefonía Termux:API detectadas correctamente."
fi

# 5. Solicitar permisos de teléfono en Android (hace vibrar y prueba permisos)
echo "[5/6] 📱 Comprobando permisos de telefonía y hardware..."
termux-vibrate -d 200 || true

# 6. Prueba de conectividad con el servidor de INNOVAIT
DEFAULT_SERVER="https://b2b.innovait.io"
echo "[6/6] 🌐 Probando conexión con el servidor INNOVAIT ($DEFAULT_SERVER)..."
if curl -s -k --connect-timeout 5 "$DEFAULT_SERVER/health" | grep -q "healthy"; then
    echo "✓ Conexión exitosa con el servidor INNOVAIT en AWS ($DEFAULT_SERVER)!"
else
    echo "ℹ️ No se pudo conectar a $DEFAULT_SERVER o está en modo local."
    echo "Podrás especificar la URL de tu servidor al iniciar el script."
fi

echo ""
echo "=========================================================="
echo "🎉 ¡Instalación y Configuración Completada con Éxito!"
echo "=========================================================="
echo "Para iniciar el servicio de llamadas continuas, ejecuta:"
echo ""
echo "    python sara_android_client.py"
echo ""
echo "O si deseas apuntar a un servidor específico:"
echo ""
echo "    python sara_android_client.py --server https://b2b.innovait.io"
echo "=========================================================="
echo ""
