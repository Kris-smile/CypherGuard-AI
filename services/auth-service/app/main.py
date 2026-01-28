"""Auth Service - User authentication and authorization"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
import sys
import os

# Add common module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import User
from common.schemas import UserCreate, UserLogin, UserResponse, TokenResponse
from common.auth import hash_password, verify_password, create_access_token, decode_access_token
from common.exceptions import AuthenticationError, ConflictError, NotFoundError

# Initialize app
app = FastAPI(title="Auth Service", version="1.0.0")
settings = Settings()
db = Database(settings.postgres_url)
security = HTTPBearer()


# Dependency to get database session
def get_db():
    return next(db.get_session())


# Dependency to get current user from JWT
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_db)
) -> User:
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_access_token(token, settings.jwt_secret, settings.jwt_algorithm)

    if payload is None:
        raise AuthenticationError("Invalid or expired token")

    user_id = payload.get("sub")
    if user_id is None:
        raise AuthenticationError("Invalid token payload")

    user = session.query(User).filter(User.id == user_id).first()
    if user is None:
        raise NotFoundError("User not found")

    return user


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, session: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = session.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()

    if existing_user:
        if existing_user.email == user_data.email:
            raise ConflictError("Email already registered")
        else:
            raise ConflictError("Username already taken")

    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hashed_password,
        role="user"
    )

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    # Create access token
    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role},
        secret_key=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_delta=timedelta(hours=settings.jwt_expiration_hours)
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(new_user)
    )


@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, session: Session = Depends(get_db)):
    """Login user and return JWT token"""
    # Find user by email
    user = session.query(User).filter(User.email == credentials.email).first()

    if not user:
        raise AuthenticationError("Invalid email or password")

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise AuthenticationError("Invalid email or password")

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        secret_key=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_delta=timedelta(hours=settings.jwt_expiration_hours)
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.from_orm(user)
    )


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse.from_orm(current_user)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
