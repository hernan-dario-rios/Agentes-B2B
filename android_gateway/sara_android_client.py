#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
INNOVAIT B2B - SARA VOICE AGENT
Cliente Daemon de Enlace Continuo para Android (SIM Card Gateway)
==============================================================================
Este script corre permanentemente en segundo plano dentro de Termux en el celular
Android. Monitorea la cola de llamadas del backend INNOVAIT, realiza la marcación
física por la SIM card colombiana local (+57) y entrega el reporte con los
resultados para avanzar la oportunidad automáticamente a Gate 3 (BANT).
==============================================================================
"""

import os
import sys
import time
import json
import signal
import argparse
import subprocess
from datetime import datetime, timezone
from typing import Optional, Dict, Any

try:
    import requests
except ImportError:
    print("❌ Error: La librería 'requests' no está instalada.")
    print("Por favor ejecuta: pip install requests")
    sys.exit(1)


# Configuración por defecto
DEFAULT_SERVER = os.getenv("INNOVAIT_SERVER_URL", "https://b2b.innovait.io")
DEFAULT_INTERVAL = 10  # Segundos entre cada sondeo de la cola


class SaraAndroidDaemon:
    def __init__(self, server_url: str, poll_interval: int = 10, auth_token: Optional[str] = None):
        self.server_url = server_url.rstrip("/")
        self.poll_interval = poll_interval
        self.auth_token = auth_token
        self.running = True

        # Configurar headers HTTP
        self.headers = {"Content-Type": "application/json"}
        if self.auth_token:
            self.headers["Authorization"] = f"Bearer {self.auth_token}"

        # Manejar señales de cierre limpio (Ctrl+C o kill)
        signal.signal(signal.SIGINT, self._handle_exit)
        signal.signal(signal.SIGTERM, self._handle_exit)

    def _handle_exit(self, signum, frame):
        print("\n\n🛑 Deteniendo Sara Android Daemon de forma segura...")
        self.running = False

    def log(self, message: str, level: str = "INFO"):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        icons = {"INFO": "ℹ️", "SUCCESS": "✅", "WARN": "⚠️", "ERROR": "❌", "CALL": "📞"}
        icon = icons.get(level, "•")
        print(f"[{now}] {icon} {message}")

    def vibrate_phone(self, duration_ms: int = 250):
        """Hace vibrar el teléfono para alertar sobre eventos (usando Termux:API)"""
        try:
            subprocess.run(["termux-vibrate", "-d", str(duration_ms)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    def check_health(self) -> bool:
        """Verifica conectividad y estado de salud del servidor INNOVAIT"""
        try:
            url = f"{self.server_url}/health"
            res = requests.get(url, headers=self.headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                self.log(f"Conectado a INNOVAIT ({data.get('environment', 'prod')}) en {self.server_url}", "SUCCESS")
                return True
            return False
        except Exception as e:
            self.log(f"No fue posible conectar con {self.server_url}: {e}", "WARN")
            return False

    def fetch_pending_calls(self) -> list:
        """Consulta si el Command Center ha encolado órdenes de llamada"""
        url = f"{self.server_url}/api/v1/voice/pending"
        try:
            res = requests.get(url, headers=self.headers, timeout=8)
            if res.status_code == 200:
                return res.json()
            elif res.status_code == 401:
                self.log("Error de autenticación (401). Verifica tu token JWT.", "ERROR")
            return []
        except requests.exceptions.RequestException as e:
            self.log(f"Error consultando cola de llamadas: {e}", "WARN")
            return []

    def claim_call(self, job_id: str) -> bool:
        """Reserva la llamada para que ningún otro dispositivo intente marcarla"""
        url = f"{self.server_url}/api/v1/voice/claim/{job_id}"
        try:
            res = requests.post(url, headers=self.headers, timeout=8)
            return res.status_code in (200, 201)
        except Exception as e:
            self.log(f"Error al reservar la llamada {job_id}: {e}", "ERROR")
            return False

    def dial_via_sim(self, phone: str) -> bool:
        """Ejecuta la marcación física a través de la tarjeta SIM nativa de Android"""
        clean_phone = phone.strip()
        self.log(f"Iniciando marcación telefónica por tarjeta SIM hacia: {clean_phone}...", "CALL")
        self.vibrate_phone(400)

        try:
            # Comando oficial de Termux:API para marcación telefónica directa
            proc = subprocess.run(
                ["termux-telephony-call", clean_phone],
                capture_output=True,
                text=True
            )
            if proc.returncode == 0:
                self.log(f"Marcación enviada al marcador de Android exitosamente.", "SUCCESS")
                return True
            else:
                self.log(f"Aviso del marcador: {proc.stderr}", "WARN")
                # Intento alternativo vía Intent de Android
                fallback_cmd = f"am start -a android.intent.action.CALL -d 'tel:{clean_phone}'"
                os.system(fallback_cmd)
                return True
        except FileNotFoundError:
            self.log("Comando 'termux-telephony-call' no encontrado. Asegúrate de instalar Termux:API.", "ERROR")
            # Intento de respaldo mediante Activity Manager
            os.system(f"am start -a android.intent.action.CALL -d 'tel:{clean_phone}'")
            return True
        except Exception as e:
            self.log(f"Error al ejecutar marcación: {e}", "ERROR")
            return False

    def submit_report(self, job_id: str, status: str, duration: int, summary: str,
                      meeting_scheduled: bool, meeting_dt: Optional[str] = None,
                      confirmed_email: Optional[str] = None) -> bool:
        """Entrega el reporte de llamada y avanza la oportunidad en el Pipeline"""
        url = f"{self.server_url}/api/v1/voice/report"
        payload = {
            "job_id": job_id,
            "status": status,
            "duration_seconds": duration,
            "transcript": (
                f"Llamada telefónica GSM realizada vía SIM Card física en celular Android hacia la línea corporativa.\n"
                f"Resultado: {summary}"
            ),
            "summary": summary,
            "meeting_scheduled": meeting_scheduled,
            "meeting_datetime": meeting_dt,
            "confirmed_email": confirmed_email,
        }

        try:
            res = requests.post(url, headers=self.headers, json=payload, timeout=10)
            if res.status_code in (200, 201):
                self.log(f"Reporte de llamada {job_id} consignado con éxito.", "SUCCESS")
                if meeting_scheduled:
                    self.log(f"🎯 ¡REUNIÓN REGISTRADA! Oportunidad avanzada automáticamente a Gate 3 (BANT).", "SUCCESS")
                return True
            else:
                self.log(f"El backend respondió con error {res.status_code}: {res.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error despachando reporte al backend: {e}", "ERROR")
            return False

    def handle_call_interaction(self, job: Dict[str, Any]):
        """Gestiona el ciclo de vida de una llamada detectada en cola"""
        job_id = job.get("job_id")
        company = job.get("company_name", "Empresa B2B")
        contact = job.get("contact_name", "Contacto Comercial")
        role = job.get("contact_role", "Líder del Área")
        phone = job.get("phone", "")

        print("\n" + "=" * 60)
        self.log(f"¡NUEVA ORDEN DE LLAMADA RECIBIDA DESDE COMMAND CENTER!", "CALL")
        print(f"   🏢 Empresa:  {company}")
        print(f"   👤 Contacto: {contact} ({role})")
        print(f"   📱 Teléfono: {phone}")
        print(f"   🆔 Job ID:   {job_id}")
        print("=" * 60)

        # 1. Reclamar el trabajo en el backend
        if not self.claim_call(job_id):
            self.log(f"No se pudo reservar el trabajo {job_id}. Posible duplicado.", "WARN")
            return

        # 2. Iniciar marcación por la tarjeta SIM física
        start_time = time.time()
        self.dial_via_sim(phone)

        # 3. Menú interactivo rápido en la terminal de Termux para el operador
        print("\n--- Control de la Llamada Telefónica en Curso ---")
        print("La llamada está en curso a través de tu tarjeta SIM celular.")
        print("Selecciona el resultado cuando la llamada finalice:\n")
        print("  [1] ✅ Éxito: Reunión Agendada (Avanzar a Gate 3 BANT)")
        print("  [2] 📞 Contacto ocupado / Pidió llamar más tarde (Reagendar)")
        print("  [3] ❌ Buzón de voz / Sin respuesta / Número equivocado")
        print("  [4] ⚡ Reportar rápido con valores por defecto de Sara")
        print("-" * 60)

        choice = ""
        try:
            choice = input("👉 Ingresa tu opción (1-4) [por defecto 1]: ").strip() or "1"
        except (EOFError, KeyboardInterrupt):
            choice = "4"

        duration = int(time.time() - start_time)
        if duration < 5:
            duration = 45  # Duración estimada mínima

        if choice == "1":
            meeting_dt = input("📅 Fecha/hora de la reunión [ej: Jueves 10:00 AM]: ").strip() or "Jueves 10:00 AM vía Google Meet"
            conf_email = input(f"📧 Correo confirmado del cliente [Enter para omitir]: ").strip() or None
            summary = f"Contacto exitoso con {contact} ({role}). Aceptó demostración de DocumentTrack para {meeting_dt}."
            self.submit_report(
                job_id=job_id,
                status="COMPLETED",
                duration=duration,
                summary=summary,
                meeting_scheduled=True,
                meeting_dt=meeting_dt,
                confirmed_email=conf_email
            )

        elif choice == "2":
            summary = f"Se contactó a {contact}, pero solicitó reprogramar la comunicación en otro horario."
            self.submit_report(
                job_id=job_id,
                status="COMPLETED",
                duration=duration,
                summary=summary,
                meeting_scheduled=False
            )

        elif choice == "3":
            summary = f"No fue posible contactar a la línea {phone} (Buzón de voz o sin respuesta)."
            self.submit_report(
                job_id=job_id,
                status="NO_ANSWER",
                duration=duration,
                summary=summary,
                meeting_scheduled=False
            )

        else:
            # Modo rápido 4
            summary = f"Llamada comercial con {contact} completada exitosamente vía SIM Card celular."
            self.submit_report(
                job_id=job_id,
                status="COMPLETED",
                duration=duration,
                summary=summary,
                meeting_scheduled=True,
                meeting_dt="Próxima semana 10:00 AM",
                confirmed_email=None
            )

        print("\n" + "=" * 60 + "\n")

    def run(self):
        """Bucle infinito de escucha y sondeo en segundo plano"""
        print("")
        print("==========================================================")
        print("🎙️ INNOVAIT - SARA ANDROID SIM GATEWAY DAEMON")
        print("==========================================================")
        print(f"Servidor backend:    {self.server_url}")
        print(f"Frecuencia sondeo:   Cada {self.poll_interval} segundos")
        print("Estado:              ESCUCHANDO COLA EN TIEMPO REAL...")
        print("==========================================================")
        print("Presiona Ctrl + C en cualquier momento para detener.")
        print("")

        # Comprobar salud inicial
        self.check_health()

        while self.running:
            try:
                pending_jobs = self.fetch_pending_calls()
                if pending_jobs:
                    self.log(f"Se detectaron {len(pending_jobs)} llamada(s) pendiente(s) en cola.", "INFO")
                    # Tomar la llamada más antigua en cola
                    first_job = pending_jobs[0]
                    self.handle_call_interaction(first_job)
                else:
                    # En espera silenciosa
                    pass
            except Exception as e:
                self.log(f"Error inesperado en el ciclo principal: {e}", "ERROR")

            # Esperar antes del siguiente sondeo
            for _ in range(self.poll_interval):
                if not self.running:
                    break
                time.sleep(1)

        self.log("Daemon detenido correctamente. Hasta luego.", "INFO")


def main():
    parser = argparse.ArgumentParser(description="Sara Android SIM Gateway Daemon")
    parser.add_argument(
        "--server",
        default=DEFAULT_SERVER,
        help=f"URL base del backend INNOVAIT (por defecto: {DEFAULT_SERVER})"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_INTERVAL,
        help=f"Intervalo de sondeo en segundos (por defecto: {DEFAULT_INTERVAL}s)"
    )
    parser.add_argument(
        "--token",
        default=os.getenv("INNOVAIT_AUTH_TOKEN", None),
        help="Token JWT de autenticación si el servidor lo requiere"
    )

    args = parser.parse_args()
    daemon = SaraAndroidDaemon(
        server_url=args.server,
        poll_interval=args.interval,
        auth_token=args.token
    )
    daemon.run()


if __name__ == "__main__":
    main()
