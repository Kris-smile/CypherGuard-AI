#!/usr/bin/env python3
"""批量上传文档到知识库"""

import argparse
import os
import requests
from pathlib import Path
import time


def login(base_url: str, username: str, password: str) -> str:
    """登录并获取 token"""
    response = requests.post(
        f"{base_url}/auth/login",
        json={"username": username, "password": password}
    )
    response.raise_for_status()
    return response.json()["access_token"]


def upload_document(base_url: str, token: str, kb_id: str, filepath: Path) -> dict:
    """上传单个文档"""
    headers = {"Authorization": f"Bearer {token}"}

    with open(filepath, 'rb') as f:
        files = {'file': (filepath.name, f, 'text/markdown')}
        data = {'knowledge_base_id': kb_id}

        response = requests.post(
            f"{base_url}/kb/documents/upload",
            headers=headers,
            files=files,
            data=data
        )
        response.raise_for_status()
        return response.json()


def learn_document(base_url: str, token: str, doc_id: str) -> dict:
    """触发文档学习"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{base_url}/kb/documents/{doc_id}/learn",
        headers=headers
    )
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser(description='批量上传文档')
    parser.add_argument('--dir', type=str, required=True, help='文档目录')
    parser.add_argument('--kb-id', type=str, required=True, help='知识库 ID')
    parser.add_argument('--base-url', type=str, default='http://localhost', help='API 基础 URL')
    parser.add_argument('--username', type=str, default='admin@cypherguard.local', help='用户名')
    parser.add_argument('--password', type=str, default='admin123', help='密码')
    parser.add_argument('--auto-learn', action='store_true', help='自动触发学习')
    args = parser.parse_args()

    doc_dir = Path(args.dir)
    if not doc_dir.exists():
        print(f"❌ 目录不存在: {doc_dir}")
        return

    # 登录
    print("🔐 正在登录...")
    try:
        token = login(args.base_url, args.username, args.password)
        print("✅ 登录成功")
    except Exception as e:
        print(f"❌ 登录失败: {e}")
        return

    # 获取所有文档
    files = list(doc_dir.glob('*.md')) + list(doc_dir.glob('*.txt')) + list(doc_dir.glob('*.pdf'))
    total = len(files)
    print(f"\n📁 找到 {total} 个文档")

    # 上传文档
    uploaded = []
    failed = []

    for i, filepath in enumerate(files, 1):
        try:
            print(f"[{i}/{total}] 上传: {filepath.name}...", end=' ')
            result = upload_document(args.base_url, token, args.kb_id, filepath)
            doc_id = result['id']
            uploaded.append((doc_id, filepath.name))
            print(f"✅ (ID: {doc_id})")

            # 自动触发学习
            if args.auto_learn:
                print(f"    └─ 触发学习...", end=' ')
                learn_document(args.base_url, token, doc_id)
                print("✅")

            # 避免请求过快
            time.sleep(0.5)

        except Exception as e:
            failed.append((filepath.name, str(e)))
            print(f"❌ {e}")

    # 统计结果
    print(f"\n{'='*60}")
    print(f"📊 上传统计")
    print(f"{'='*60}")
    print(f"✅ 成功: {len(uploaded)}/{total}")
    print(f"❌ 失败: {len(failed)}/{total}")

    if failed:
        print(f"\n失败列表:")
        for filename, error in failed:
            print(f"  - {filename}: {error}")

    if uploaded and args.auto_learn:
        print(f"\n💡 提示: 文档正在后台处理，请在知识库页面查看进度")


if __name__ == '__main__':
    main()
