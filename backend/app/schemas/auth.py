from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., description="Nombre de usuario o correo electrónico")
    password: str = Field(..., description="Contraseña del usuario")


class Verify2FARequest(BaseModel):
    temp_token: str = Field(..., description="Token temporal emitido tras validar credenciales")
    code: str = Field(..., description="Código numérico TOTP de 6 dígitos")


class Setup2FAConfirmRequest(BaseModel):
    temp_token: str = Field(..., description="Token temporal de enrolamiento 2FA")
    code: str = Field(..., description="Código de 6 dígitos escaneado en el autenticador")


class Reset2FARequest(BaseModel):
    username: str = Field(..., description="Nombre de usuario a resetear")
    password: str = Field(..., description="Contraseña de confirmación")


class UserOut(BaseModel):
    username: str
    name: str
    email: Optional[str] = None
    role: str = "admin"
    two_factor_enabled: bool = False


class AuthResponse(BaseModel):
    status: str = Field(..., description="'authenticated' | 'requires_2fa' | 'requires_2fa_setup'")
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    temp_token: Optional[str] = None
    two_factor_secret: Optional[str] = None
    provisioning_uri: Optional[str] = None
    qr_code_url: Optional[str] = None
    user: Optional[UserOut] = None
    message: Optional[str] = None
