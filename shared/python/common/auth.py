"""JWT authentication utilities"""

from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext

# Use argon2 instead of bcrypt to avoid compatibility issues
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: Dict,
    secret_key: str,
    algorithm: str = "HS256",
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=algorithm)
    return encoded_jwt


def decode_access_token(
    token: str,
    secret_key: str,
    algorithm: str = "HS256"
) -> Optional[Dict]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        return payload
    except JWTError:
        return None
