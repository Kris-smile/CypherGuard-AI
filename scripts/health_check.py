#!/usr/bin/env python3
"""快速系统健康检查"""

import requests
import sys
from typing import Dict, List, Tuple


def check_service(name: str, url: str, timeout: int = 5) -> Tuple[bool, str]:
    """检查单个服务"""
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            return True, "正常"
        else:
            return False, f"状态码: {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "连接失败"
    except requests.exceptions.Timeout:
        return False, "超时"
    except Exception as e:
        return False, str(e)


def check_database() -> Tuple[bool, str]:
    """检查数据库连接"""
    try:
        import psycopg2
        conn = psycopg2.connect(
            host="localhost",
            port=5433,
            database="cypherguard",
            user="postgres",
            password="postgres",
            connect_timeout=5
        )
        conn.close()
        return True, "正常"
    except ImportError:
        return None, "psycopg2 未安装"
    except Exception as e:
        return False, str(e)


def check_redis() -> Tuple[bool, str]:
    """检查 Redis 连接"""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6380, db=0, socket_timeout=5)
        r.ping()
        return True, "正常"
    except ImportError:
        return None, "redis 未安装"
    except Exception as e:
        return False, str(e)


def check_qdrant() -> Tuple[bool, str]:
    """检查 Qdrant 连接"""
    try:
        response = requests.get("http://localhost:6333/collections", timeout=5)
        if response.status_code == 200:
            collections = response.json()
            return True, f"正常 ({len(collections.get('result', {}).get('collections', []))} 个集合)"
        else:
            return False, f"状态码: {response.status_code}"
    except Exception as e:
        return False, str(e)


def check_minio() -> Tuple[bool, str]:
    """检查 MinIO 连接"""
    try:
        response = requests.get("http://localhost:9000/minio/health/live", timeout=5)
        if response.status_code == 200:
            return True, "正常"
        else:
            return False, f"状态码: {response.status_code}"
    except Exception as e:
        return False, str(e)


def check_auth() -> Tuple[bool, str]:
    """检查认证功能"""
    try:
        response = requests.post(
            "http://localhost/auth/login",
            json={"username": "admin@cypherguard.local", "password": "admin123"},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                return True, "正常"
            else:
                return False, "响应格式错误"
        else:
            return False, f"状态码: {response.status_code}"
    except Exception as e:
        return False, str(e)


def check_model_config() -> Tuple[bool, str]:
    """检查模型配置"""
    try:
        # 先登录
        response = requests.post(
            "http://localhost/auth/login",
            json={"username": "admin@cypherguard.local", "password": "admin123"},
            timeout=5
        )
        if response.status_code != 200:
            return False, "登录失败"

        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 检查模型配置
        response = requests.get("http://localhost/models", headers=headers, timeout=5)
        if response.status_code == 200:
            models = response.json()
            chat_models = [m for m in models if m["model_type"] == "chat"]
            embedding_models = [m for m in models if m["model_type"] == "embedding"]

            if not chat_models:
                return False, "未配置 Chat 模型"
            if not embedding_models:
                return False, "未配置 Embedding 模型"

            return True, f"正常 (Chat: {len(chat_models)}, Embedding: {len(embedding_models)})"
        else:
            return False, f"状态码: {response.status_code}"
    except Exception as e:
        return False, str(e)


def print_status(name: str, status: Tuple[bool, str], width: int = 30):
    """打印状态"""
    is_ok, message = status
    if is_ok is None:
        icon = "⚠️ "
        color = "\033[93m"  # 黄色
    elif is_ok:
        icon = "✅"
        color = "\033[92m"  # 绿色
    else:
        icon = "❌"
        color = "\033[91m"  # 红色

    reset = "\033[0m"
    print(f"{icon} {name:<{width}} {color}{message}{reset}")


def main():
    print("=" * 70)
    print("CypherGuard AI 系统健康检查")
    print("=" * 70)

    checks = []

    # 基础设施
    print("\n📦 基础设施")
    print("-" * 70)
    checks.append(("PostgreSQL", check_database()))
    print_status("PostgreSQL", checks[-1][1])

    checks.append(("Redis", check_redis()))
    print_status("Redis", checks[-1][1])

    checks.append(("Qdrant", check_qdrant()))
    print_status("Qdrant", checks[-1][1])

    checks.append(("MinIO", check_minio()))
    print_status("MinIO", checks[-1][1])

    # 微服务
    print("\n🚀 微服务")
    print("-" * 70)
    services = [
        ("Gateway", "http://localhost/"),
        ("Frontend", "http://localhost:5173/"),
        ("Auth Service", "http://localhost/auth/health"),
        ("KB Service", "http://localhost/kb/health"),
        ("Chat Service", "http://localhost/chat/health"),
        ("Model Gateway", "http://localhost/models/health"),
    ]

    for name, url in services:
        status = check_service(name, url)
        checks.append((name, status))
        print_status(name, status)

    # 功能检查
    print("\n🔧 功能检查")
    print("-" * 70)
    checks.append(("用户认证", check_auth()))
    print_status("用户认证", checks[-1][1])

    checks.append(("模型配置", check_model_config()))
    print_status("模型配置", checks[-1][1])

    # 统计
    print("\n" + "=" * 70)
    print("检查总结")
    print("=" * 70)

    total = len(checks)
    passed = sum(1 for _, (is_ok, _) in checks if is_ok is True)
    failed = sum(1 for _, (is_ok, _) in checks if is_ok is False)
    skipped = sum(1 for _, (is_ok, _) in checks if is_ok is None)

    print(f"总计: {total} 项")
    print(f"✅ 通过: {passed}")
    print(f"❌ 失败: {failed}")
    print(f"⚠️  跳过: {skipped}")

    if failed > 0:
        print("\n⚠️  系统存在问题，请检查失败的服务")
        print("\n建议操作:")
        print("1. 检查 Docker 容器状态: docker compose ps")
        print("2. 查看服务日志: docker compose logs -f <service-name>")
        print("3. 重启服务: docker compose restart <service-name>")
        sys.exit(1)
    elif skipped > 0:
        print("\n⚠️  部分检查被跳过（缺少依赖库）")
        print("\n安装依赖:")
        print("pip install psycopg2-binary redis")
        sys.exit(0)
    else:
        print("\n🎉 所有检查通过！系统运行正常")
        sys.exit(0)


if __name__ == '__main__':
    main()
