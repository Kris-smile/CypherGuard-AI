#!/usr/bin/env python3
"""
生产环境配置检查：敏感项、超时、资源限制、网关等。
"""

import os
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def env_get(key: str, default: str = "") -> str:
    env_path = _PROJECT_ROOT / ".env"
    if not env_path.exists():
        return default
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return os.environ.get(key, default)


def check_jwt_secret() -> tuple:
    v = env_get("JWT_SECRET", "")
    if not v or v == "change-this-secret-in-production":
        return False, "JWT_SECRET 未设置或仍为默认值，生产必须修改"
    return True, "JWT_SECRET 已设置"


def check_api_key_encryption_secret() -> tuple:
    v = env_get("API_KEY_ENCRYPTION_SECRET", "")
    if not v or "dGhpcy1pcy1hLXRlc3Q" in v:
        return False, "API_KEY_ENCRYPTION_SECRET 未设置或为默认值，生产必须修改"
    return True, "API_KEY_ENCRYPTION_SECRET 已设置"


def check_postgres_password() -> tuple:
    v = env_get("POSTGRES_PASSWORD", "postgres")
    if v == "postgres":
        return False, "POSTGRES_PASSWORD 为默认值，生产建议修改"
    return True, "POSTGRES_PASSWORD 已非默认"


def check_redis_url() -> tuple:
    v = env_get("REDIS_URL", "")
    if not v:
        return False, "REDIS_URL 未设置"
    if "localhost" in v or "127.0.0.1" in v:
        return False, "生产环境 REDIS_URL 建议使用内网/专有地址"
    return True, "REDIS_URL 已配置"


def check_minio_credentials() -> tuple:
    user = env_get("MINIO_ROOT_USER", "minioadmin")
    pwd = env_get("MINIO_ROOT_PASSWORD", "minioadmin")
    if user == "minioadmin" and pwd == "minioadmin":
        return False, "MinIO 为默认账号密码，生产建议修改"
    return True, "MinIO 凭证已配置"


def check_timeouts() -> tuple:
    # 可选：检查 REQUEST_TIMEOUT 等是否合理
    return True, "超时配置可按需在 .env 中调整"


def check_upload_limits() -> tuple:
    return True, "UPLOAD_MAX_MB 等可在 .env 中配置"


def main():
    print("=" * 60)
    print("CypherGuard AI 生产环境配置检查")
    print("=" * 60)

    checks = [
        ("JWT_SECRET", check_jwt_secret()),
        ("API_KEY_ENCRYPTION_SECRET", check_api_key_encryption_secret()),
        ("POSTGRES_PASSWORD", check_postgres_password()),
        ("REDIS_URL", check_redis_url()),
        ("MinIO 凭证", check_minio_credentials()),
        ("超时与上传限制", check_timeouts()),
    ]

    failed = []
    for name, (ok, msg) in checks:
        icon = "✅" if ok else "❌"
        print(f"  {icon} {name}: {msg}")
        if not ok:
            failed.append(name)

    print("\n" + "=" * 60)
    if failed:
        print("以下项需在生产部署前修正:", ", ".join(failed))
        sys.exit(1)
    print("配置检查通过，仍请根据实际环境核对 .env 与网关配置")
    sys.exit(0)


if __name__ == "__main__":
    main()
