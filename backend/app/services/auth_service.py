from __future__ import annotations

import io
import json
import base64
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple, Any
from datetime import datetime, timezone, timedelta

import bcrypt
import pyotp
import qrcode
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

USERS_DB_PATH = Path(__file__).resolve().parent.parent / "knowledge" / "users_db.json"

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "AdminPassword2026!"
DEFAULT_ADMIN_NAME = "Administrador INNOVAIT"
DEFAULT_ADMIN_EMAIL = "admin@innovait.io"


def hash_password(password: str) -> str:
    """Genera hash seguro con bcrypt y salt dinámico"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compara contraseña en plano contra hash bcrypt de forma segura"""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception as e:
        logger.warning(f"[AuthService] Error verificando contraseña: {e}")
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_temp_token(username: str, purpose: str, pending_secret: Optional[str] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    to_encode = {
        "sub": username,
        "purpose": purpose,
        "type": "temp",
        "exp": expire,
    }
    if pending_secret:
        to_encode["pending_secret"] = pending_secret
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except Exception as e:
        logger.debug(f"[AuthService] Token inválido o expirado: {e}")
        return None


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_provisioning_uri(username: str, secret: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=f"INNOVAIT ({username})",
        issuer_name="INNOVAIT Sales"
    )


def generate_qr_code_data_uri(provisioning_uri: str) -> str:
    """Genera imagen QR en formato data URI (base64 PNG) para mostrar en frontend"""
    qr = qrcode.QRCode(version=1, box_size=7, border=2)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def verify_totp_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    clean_code = str(code).strip().replace(" ", "").replace("-", "")
    totp = pyotp.TOTP(secret)
    # valid_window=1 tolera desfase de reloj de +-30s
    return bool(totp.verify(clean_code, valid_window=1))


class AuthService:
    def __init__(self):
        self.users: Dict[str, dict] = {}
        self._last_mtime: float = 0.0
        self._ensure_db()

    def _ensure_db(self):
        """Carga la base de datos o inicializa con el administrador por defecto si no existe"""
        try:
            USERS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            if not USERS_DB_PATH.exists():
                logger.info(f"[AuthService] Inicializando usuarios por defecto en {USERS_DB_PATH}")
                default_user = {
                    "username": DEFAULT_ADMIN_USERNAME,
                    "name": DEFAULT_ADMIN_NAME,
                    "email": DEFAULT_ADMIN_EMAIL,
                    "role": "admin",
                    "password_hash": hash_password(DEFAULT_ADMIN_PASSWORD),
                    "two_factor_secret": None,
                    "two_factor_enabled": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                self.users = {DEFAULT_ADMIN_USERNAME: default_user}
                self._save_db()
            else:
                self._load_db()
        except Exception as e:
            logger.error(f"[AuthService] Error inicializando users_db: {e}", exc_info=True)

    def _load_db(self):
        try:
            if not USERS_DB_PATH.exists():
                return
            mtime = USERS_DB_PATH.stat().st_mtime
            if mtime == self._last_mtime and self.users:
                return
            with open(USERS_DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.users = data.get("users", {})
                self._last_mtime = mtime
            logger.info(f"[AuthService] {len(self.users)} usuarios cargados de base de datos.")
        except Exception as e:
            logger.error(f"[AuthService] Error leyendo {USERS_DB_PATH}: {e}")

    def _save_db(self):
        try:
            temp_path = USERS_DB_PATH.with_suffix(".tmp")
            payload = {
                "version": "1.0",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "users": self.users
            }
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            temp_path.replace(USERS_DB_PATH)
            self._last_mtime = USERS_DB_PATH.stat().st_mtime
        except Exception as e:
            logger.error(f"[AuthService] Error persistiendo {USERS_DB_PATH}: {e}")

    def get_user(self, username: str) -> Optional[dict]:
        self._load_db()
        key = username.strip().lower()
        # Buscar por username o por email
        for u in self.users.values():
            if u.get("username", "").lower() == key or u.get("email", "").lower() == key:
                return u
        return None

    def authenticate(self, username: str, password: str) -> Tuple[Optional[dict], str]:
        user = self.get_user(username)
        if not user:
            return None, "Usuario no encontrado"
        
        hashed = user.get("password_hash", "")
        if not verify_password(password, hashed):
            return None, "Contraseña incorrecta"
        
        return user, "OK"

    def complete_2fa_setup(self, username: str, secret: str, code: str) -> Tuple[bool, str]:
        """Confirma enrolamiento de 2FA verificando el primer código TOTP"""
        user = self.get_user(username)
        if not user:
            return False, "Usuario no encontrado"
        
        if not verify_totp_code(secret, code):
            return False, "El código de 6 dígitos no coincide. Verifique la hora de su dispositivo e intente de nuevo."
        
        u_key = user["username"]
        self.users[u_key]["two_factor_secret"] = secret
        self.users[u_key]["two_factor_enabled"] = True
        self.users[u_key]["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._save_db()
        logger.info(f"[AuthService] 2FA activado con éxito para usuario '{u_key}'")
        return True, "2FA activado correctamente"

    def verify_2fa(self, username: str, code: str) -> Tuple[bool, str]:
        user = self.get_user(username)
        if not user:
            return False, "Usuario no encontrado"
        
        secret = user.get("two_factor_secret")
        if not secret:
            return False, "El usuario no tiene configurado 2FA"
        
        if not verify_totp_code(secret, code):
            return False, "Código 2FA incorrecto o expirado"
        
        return True, "Verificación exitosa"

    def reset_2fa(self, username: str) -> Tuple[bool, str]:
        """Reinicia la configuración de 2FA para permitir nuevo enrolamiento"""
        user = self.get_user(username)
        if not user:
            return False, "Usuario no encontrado"
        
        u_key = user["username"]
        self.users[u_key]["two_factor_secret"] = None
        self.users[u_key]["two_factor_enabled"] = False
        self.users[u_key]["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._save_db()
        logger.info(f"[AuthService] 2FA reseteado para usuario '{u_key}'")
        return True, "2FA reseteado exitosamente"


auth_service = AuthService()
