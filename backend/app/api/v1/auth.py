from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header, status

from app.schemas.auth import (
    LoginRequest,
    Verify2FARequest,
    Setup2FAConfirmRequest,
    Reset2FARequest,
    AuthResponse,
    UserOut,
)
from app.services.auth_service import (
    auth_service,
    create_access_token,
    create_temp_token,
    decode_token,
    generate_totp_secret,
    get_provisioning_uri,
    generate_qr_code_data_uri,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación & 2FA"])


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Valida el Bearer JWT en el encabezado Authorization"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere sesión activa. Encabezado Authorization ausente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.split(" ")[1].strip()
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada o token no válido. Inicie sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username = payload.get("sub")
    user = auth_service.get_user(username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario de la sesión ya no existe en el sistema.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    """
    Paso 1: Valida usuario y contraseña.
    - Si el usuario tiene 2FA habilitado, responde con status 'requires_2fa'.
    - Si aún no lo ha habilitado, inicia el enrolamiento generando QR con status 'requires_2fa_setup'.
    """
    user, msg = auth_service.authenticate(payload.username, payload.password)
    if not user:
        logger.warning(f"[Auth] Intento fallido de login para usuario '{payload.username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos."
        )
    
    username = user["username"]
    is_2fa_enabled = bool(user.get("two_factor_enabled"))
    
    if is_2fa_enabled:
        temp_token = create_temp_token(username=username, purpose="2fa_login")
        return AuthResponse(
            status="requires_2fa",
            temp_token=temp_token,
            message="Ingrese el código de 6 dígitos de su aplicación Google Authenticator."
        )
    else:
        # Enrolamiento de 2FA requerido en primer inicio de sesión
        secret = generate_totp_secret()
        uri = get_provisioning_uri(username=username, secret=secret)
        qr_data_uri = generate_qr_code_data_uri(uri)
        temp_token = create_temp_token(username=username, purpose="2fa_setup", pending_secret=secret)
        
        return AuthResponse(
            status="requires_2fa_setup",
            temp_token=temp_token,
            two_factor_secret=secret,
            provisioning_uri=uri,
            qr_code_url=qr_data_uri,
            message="Configure la autenticación de dos factores (2FA) escaneando el código QR con su aplicación autenticadora."
        )


@router.post("/2fa/verify", response_model=AuthResponse)
def verify_2fa(payload: Verify2FARequest):
    """
    Paso 2A: Verifica el código TOTP de 6 dígitos para un usuario con 2FA ya activo.
    """
    token_payload = decode_token(payload.temp_token)
    if not token_payload or token_payload.get("purpose") != "2fa_login":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de verificación es inválido o ha expirado. Inicie sesión nuevamente."
        )
    
    username = token_payload.get("sub")
    success, msg = auth_service.verify_2fa(username, payload.code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    
    user = auth_service.get_user(username)
    access_token = create_access_token({
        "sub": user["username"],
        "name": user.get("name", user["username"]),
        "role": user.get("role", "admin"),
        "email": user.get("email"),
    })
    
    user_out = UserOut(
        username=user["username"],
        name=user.get("name", user["username"]),
        email=user.get("email"),
        role=user.get("role", "admin"),
        two_factor_enabled=True,
    )
    
    return AuthResponse(
        status="authenticated",
        access_token=access_token,
        user=user_out,
        message="Inicio de sesión exitoso con 2FA verificado."
    )


@router.post("/2fa/setup-confirm", response_model=AuthResponse)
def setup_confirm_2fa(payload: Setup2FAConfirmRequest):
    """
    Paso 2B: Confirma el enrolamiento de 2FA validando el primer código de la app.
    Persiste el secreto TOTP de forma definitiva y emite el JWT de sesión.
    """
    token_payload = decode_token(payload.temp_token)
    if not token_payload or token_payload.get("purpose") != "2fa_setup":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de enrolamiento es inválido o ha expirado. Inicie sesión nuevamente."
        )
    
    username = token_payload.get("sub")
    secret = token_payload.get("pending_secret")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró el secreto temporal en la solicitud de enrolamiento."
        )
    
    success, msg = auth_service.complete_2fa_setup(username, secret, payload.code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    
    user = auth_service.get_user(username)
    access_token = create_access_token({
        "sub": user["username"],
        "name": user.get("name", user["username"]),
        "role": user.get("role", "admin"),
        "email": user.get("email"),
    })
    
    user_out = UserOut(
        username=user["username"],
        name=user.get("name", user["username"]),
        email=user.get("email"),
        role=user.get("role", "admin"),
        two_factor_enabled=True,
    )
    
    return AuthResponse(
        status="authenticated",
        access_token=access_token,
        user=user_out,
        message="2FA configurado y validado exitosamente. Sesión iniciada."
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(user: dict = Depends(get_current_user)):
    """Retorna la información del usuario autenticado actualmente"""
    return UserOut(
        username=user["username"],
        name=user.get("name", user["username"]),
        email=user.get("email"),
        role=user.get("role", "admin"),
        two_factor_enabled=bool(user.get("two_factor_enabled")),
    )


@router.post("/reset-2fa")
def reset_2fa_endpoint(payload: Reset2FARequest):
    """
    Permite restablecer 2FA validando la contraseña del usuario.
    Permite volver a escanear un nuevo código QR si el usuario cambió de teléfono.
    """
    user, msg = auth_service.authenticate(payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas para reiniciar 2FA."
        )
    
    success, reset_msg = auth_service.reset_2fa(user["username"])
    return {
        "success": success,
        "detail": reset_msg,
        "message": "2FA reiniciado. En el próximo inicio de sesión se le solicitará escanear un nuevo código QR."
    }
