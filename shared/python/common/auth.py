"""JWT authentication & cryptography utilities"""

from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from cryptography.fernet import Fernet
import base64
import hashlib

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


# --------------- Password Hashing ---------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# --------------- JWT ---------------

class TokenPayload(BaseModel):
    """Decoded JWT payload with typed fields"""
    sub: str
    email: str = ""
    role: str = "user"
    exp: Optional[int] = None


def create_access_token(
    data: Dict,
    secret_key: str,
    algorithm: str = "HS256",
    expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def create_refresh_token(
    data: Dict,
    secret_key: str,
    algorithm: str = "HS256",
    expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = {"sub": data["sub"], "type": "refresh"}
    expire = datetime.utcnow() + (expires_delta or timedelta(days=7))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def decode_refresh_token(
    token: str,
    secret_key: str,
    algorithm: str = "HS256"
) -> Optional[str]:
    """Decode refresh token and return user_id (sub) or None."""
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def decode_access_token(
    token: str,
    secret_key: str,
    algorithm: str = "HS256"
) -> Optional[Dict]:
    try:
        return jwt.decode(token, secret_key, algorithms=[algorithm])
    except JWTError:
        return None


def decode_token_payload(
    token: str,
    secret_key: str,
    algorithm: str = "HS256"
) -> Optional[TokenPayload]:
    """Decode JWT and return a typed TokenPayload, or None if invalid."""
    raw = decode_access_token(token, secret_key, algorithm)
    if raw is None or "sub" not in raw:
        return None
    return TokenPayload(**raw)


# --------------- API Key Encryption (Fernet) ---------------

def _derive_fernet_key(secret: str) -> bytes:
    """Derive a valid 32-byte Fernet key from an arbitrary secret string."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_api_key(api_key: str, secret: str) -> str:
    """Encrypt an API key using Fernet symmetric encryption."""
    f = Fernet(_derive_fernet_key(secret))
    return f.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted: str, secret: str) -> str:
    """Decrypt an API key encrypted by encrypt_api_key."""
    f = Fernet(_derive_fernet_key(secret))
    return f.decrypt(encrypted.encode()).decode()
