"""Auth Service - User authentication and authorization"""

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import PlainTextResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
import sys
import os
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from common.config import Settings
from common.database import Database
from common.models import User
from common.schemas import UserCreate, UserLogin, UserResponse, TokenResponse, UserUpdate, PasswordChange
from common.auth import hash_password, verify_password, create_access_token, decode_access_token, create_refresh_token, decode_refresh_token
from common.exceptions import AuthenticationError, ConflictError, NotFoundError
from common.logging_config import setup_logging, generate_request_id
from common.audit import write_audit_log

setup_logging("auth-service")
logger = logging.getLogger("auth-service")

app = FastAPI(
    title="Auth Service",
    version="2.0.0",
    docs_url="/auth/docs",
    openapi_url="/auth/openapi.json",
    redoc_url="/auth/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = Settings()
db = Database(settings.postgres_url)
security = HTTPBearer()


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID", generate_request_id())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


def get_db():
    return next(db.get_session())


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token, settings.jwt_secret, settings.jwt_algorithm)
    if payload is None:
        raise AuthenticationError("令牌无效或已过期")
    user_id = payload.get("sub")
    if user_id is None:
        raise AuthenticationError("令牌载荷无效")
    user = session.query(User).filter(User.id == user_id).first()
    if user is None:
        raise NotFoundError("用户不存在")
    return user


@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    return "OK"


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, session: Session = Depends(get_db)):
    existing_user = session.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()

    if existing_user:
        if existing_user.email == user_data.email:
            raise ConflictError("该邮箱已注册")
        else:
            raise ConflictError("该用户名已被使用")

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

    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role},
        secret_key=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_delta=timedelta(minutes=15)
    )
    refresh_token = create_refresh_token(
        data={"sub": str(new_user.id)},
        secret_key=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_delta=timedelta(days=7)
    )

    write_audit_log(session, "register", str(new_user.id), {"email": new_user.email})
    logger.info(f"User registered: {new_user.email}")

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.from_orm(new_user))


@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, session: Session = Depends(get_db)):
    try:
        user = session.query(User).filter(
            (User.email == credentials.email) | (User.username == credentials.email)
        ).first()

        if not user:
            raise AuthenticationError("邮箱/用户名或密码错误")

        if not verify_password(credentials.password, user.password_hash):
            write_audit_log(session, "login_failed", str(user.id), {"reason": "wrong_password"})
            raise AuthenticationError("邮箱/用户名或密码错误")

        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role},
            secret_key=settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
            expires_delta=timedelta(minutes=15)
        )
        refresh_token = create_refresh_token(
            data={"sub": str(user.id)},
            secret_key=settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
            expires_delta=timedelta(days=7)
        )

        write_audit_log(session, "login", str(user.id), {"email": user.email})
        logger.info(f"User logged in: {user.email}")

        return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=UserResponse.from_orm(user))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.from_orm(current_user)


from pydantic import BaseModel as PydanticBaseModel

class RefreshRequest(PydanticBaseModel):
    refresh_token: str


@app.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest, session: Session = Depends(get_db)):
    """Exchange a refresh token for a new access token."""
    user_id = decode_refresh_token(request.refresh_token, settings.jwt_secret, settings.jwt_algorithm)
    if not user_id:
        raise AuthenticationError("刷新令牌无效或已过期")

    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError("用户不存在")

    new_access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        secret_key=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_delta=timedelta(minutes=15)
    )
    new_refresh_token = create_refresh_token(
        data={"sub": str(user.id)},
        secret_key=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_delta=timedelta(days=7)
    )

    write_audit_log(session, "token_refresh", str(user.id), {})
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.from_orm(user)
    )


@app.put("/auth/profile", response_model=UserResponse)
async def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Update current user's profile (username / email)."""
    if data.username and data.username != current_user.username:
        existing = session.query(User).filter(User.username == data.username).first()
        if existing:
            raise ConflictError("该用户名已被使用")
        current_user.username = data.username

    if data.email and data.email != current_user.email:
        existing = session.query(User).filter(User.email == data.email).first()
        if existing:
            raise ConflictError("该邮箱已被注册")
        current_user.email = data.email

    session.commit()
    session.refresh(current_user)
    write_audit_log(session, "profile_update", str(current_user.id), {"username": current_user.username, "email": current_user.email})
    logger.info(f"Profile updated: {current_user.email}")

    updated_user = UserResponse.from_orm(current_user)
    localStorage_user = {"id": str(updated_user.id), "email": updated_user.email, "username": updated_user.username, "role": updated_user.role, "created_at": str(updated_user.created_at)}
    return updated_user


@app.post("/auth/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Change current user's password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise AuthenticationError("当前密码错误")

    current_user.password_hash = hash_password(data.new_password)
    session.commit()
    write_audit_log(session, "password_change", str(current_user.id), {})
    logger.info(f"Password changed: {current_user.email}")
    return {"message": "密码修改成功"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
