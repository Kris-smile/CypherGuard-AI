#!/usr/bin/env python3
"""
安全审计：API Key 加密、CORS 配置、敏感默认值检查。
"""

import os
import re
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVICES = ["auth-service", "chat-service", "kb-service", "model-config-service", "model-gateway"]


def check_api_key_encryption() -> list:
    """检查 API Key 是否加密存储与解密使用"""
    findings = []
    # 共用加密逻辑
    auth_py = _PROJECT_ROOT / "shared" / "python" / "common" / "auth.py"
    if auth_py.exists():
        text = auth_py.read_text(encoding="utf-8")
        if "encrypt_api_key" in text and "decrypt_api_key" in text and "Fernet" in text:
            findings.append(("OK", "API Key 使用 Fernet 对称加密 (auth.py)"))
        else:
            findings.append(("WARN", "auth.py 中未发现 Fernet 加密或加解密函数"))
    else:
        findings.append(("FAIL", "未找到 shared/python/common/auth.py"))

    # model-gateway / model-config 使用解密
    for svc in ["model-gateway", "model-config-service"]:
        main_py = _PROJECT_ROOT / "services" / svc / "app" / "main.py"
        if main_py.exists():
            text = main_py.read_text(encoding="utf-8")
            if "decrypt_api_key" in text or "_decrypt_key" in text:
                findings.append(("OK", f"{svc} 使用解密后 API Key 调用上游"))
            else:
                findings.append(("WARN", f"{svc} 未发现 API Key 解密调用"))
    return findings


def check_cors() -> list:
    """检查各服务 CORS 配置"""
    findings = []
    for svc in SERVICES:
        main_py = _PROJECT_ROOT / "services" / svc / "app" / "main.py"
        if not main_py.exists():
            continue
        text = main_py.read_text(encoding="utf-8")
        if "CORSMiddleware" not in text:
            findings.append(("INFO", f"{svc}: 未配置 CORS"))
            continue
        m = re.search(r"allow_origins\s*=\s*\[(.*?)\]", text, re.DOTALL)
        if m:
            origins = m.group(1).strip()
            if origins == '"*"' or origins == "'*'":
                findings.append(("WARN", f"{svc}: allow_origins=['*'] 生产环境应限制为具体域名"))
            else:
                findings.append(("OK", f"{svc}: allow_origins 已限制"))
        else:
            findings.append(("WARN", f"{svc}: 无法解析 allow_origins"))
    return findings


def check_secrets_defaults() -> list:
    """检查 .env.example 与 config 中的敏感默认值"""
    findings = []
    # 从 common/config 读取默认值
    config_py = _PROJECT_ROOT / "shared" / "python" / "common" / "config.py"
    if config_py.exists():
        text = config_py.read_text(encoding="utf-8")
        if 'jwt_secret: str = "change-this-secret-in-production"' in text or "change-this-secret" in text:
            findings.append(("WARN", "config: JWT_SECRET 默认值需在生产环境修改"))
        if "api_key_encryption_secret" in text and "dGhpcy1pcy1hLXRlc3Q" in text:
            findings.append(("WARN", "config: API_KEY_ENCRYPTION_SECRET 默认值需在生产环境修改"))
    env_example = _PROJECT_ROOT / ".env.example"
    if env_example.exists():
        text = env_example.read_text(encoding="utf-8")
        if "change-this-secret" in text or "postgres" in text.lower():
            findings.append(("INFO", ".env.example 含占位/示例密码，生产请勿直接使用"))
    return findings


def check_ssrf_and_headers() -> list:
    """SSRF 与安全头（若 gateway 有配置）"""
    findings = []
    nginx = _PROJECT_ROOT / "gateway" / "nginx.conf"
    if nginx.exists():
        text = nginx.read_text(encoding="utf-8")
        if "X-Content-Type-Options" in text or "X-Frame-Options" in text:
            findings.append(("OK", "Nginx 配置了安全头"))
        else:
            findings.append(("INFO", "Nginx 可考虑添加 X-Content-Type-Options, X-Frame-Options"))
    config_py = _PROJECT_ROOT / "shared" / "python" / "common" / "config.py"
    if config_py.exists():
        text = config_py.read_text(encoding="utf-8")
        if "SSRF_BLOCKED" in text or "URL_FETCH" in text:
            findings.append(("OK", "存在 SSRF/URL 拉取相关配置"))
    return findings


def main():
    print("=" * 60)
    print("CypherGuard AI 安全审计")
    print("=" * 60)

    all_findings = []
    all_findings.extend(check_api_key_encryption())
    all_findings.extend(check_cors())
    all_findings.extend(check_secrets_defaults())
    all_findings.extend(check_ssrf_and_headers())

    for status, msg in all_findings:
        icon = {"OK": "✅", "WARN": "⚠️", "FAIL": "❌", "INFO": "ℹ️"}.get(status, "?")
        print(f"  {icon} {msg}")

    fails = sum(1 for s, _ in all_findings if s == "FAIL")
    warns = sum(1 for s, _ in all_findings if s == "WARN")
    print("\n汇总: FAIL=%d, WARN=%d" % (fails, warns))
    if fails > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
