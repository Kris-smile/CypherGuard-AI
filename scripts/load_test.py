#!/usr/bin/env python3
"""
性能压测：大规模文档上传 + 并发对话。
依赖：系统已启动，默认用户与模型已配置。
"""

import argparse
import concurrent.futures
import sys
import time
from pathlib import Path
from typing import List, Tuple

import requests

# 小文本文件，用于模拟批量上传
SAMPLE_TXT = b"Cybersecurity is the practice of protecting systems and networks from digital attacks.\n" * 20


def auth(base: str, user: str, pwd: str) -> dict:
    r = requests.post(f"{base}/auth/login", json={"email": user, "password": pwd}, timeout=10)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def create_kb(base: str, headers: dict, name: str) -> str:
    r = requests.post(
        f"{base}/kb/knowledge-bases",
        headers=headers,
        json={"name": name, "kb_type": "document"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["id"]


def upload_doc(base: str, headers: dict, kb_id: str, idx: int) -> Tuple[bool, float]:
    """上传单文档，返回 (成功, 耗时秒)"""
    start = time.perf_counter()
    try:
        files = {"file": (f"doc_{idx}.txt", SAMPLE_TXT, "text/plain")}
        r = requests.post(
            f"{base}/kb/knowledge-bases/{kb_id}/documents/upload",
            headers=headers,
            files=files,
            timeout=60,
        )
        ok = r.status_code in (200, 201)
        return (ok, time.perf_counter() - start)
    except Exception:
        return (False, time.perf_counter() - start)


def send_message(base: str, headers: dict, conv_id: str, content: str) -> Tuple[bool, float]:
    """发送一条消息，返回 (成功, 耗时秒)"""
    start = time.perf_counter()
    try:
        r = requests.post(
            f"{base}/chat/conversations/{conv_id}/messages",
            headers=headers,
            json={"content": content},
            timeout=120,
        )
        ok = r.status_code in (200, 201)
        return (ok, time.perf_counter() - start)
    except Exception:
        return (False, time.perf_counter() - start)


def run_bulk_upload(base: str, headers: dict, count: int) -> Tuple[int, float]:
    """批量上传 count 个文档到同一 KB"""
    kb_id = create_kb(base, headers, f"load_test_kb_{int(time.time())}")
    start = time.perf_counter()
    success = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(10, count)) as ex:
        futures = [ex.submit(upload_doc, base, headers, kb_id, i) for i in range(count)]
        for f in concurrent.futures.as_completed(futures):
            ok, _ = f.result()
            if ok:
                success += 1
    elapsed = time.perf_counter() - start
    return success, elapsed


def run_concurrent_chats(base: str, headers: dict, concurrency: int, messages_per_conv: int) -> Tuple[int, int, float]:
    """并发创建 concurrency 个对话，每个对话发 messages_per_conv 条消息"""
    r = requests.get(f"{base}/chat/modes", headers=headers, timeout=5)
    r.raise_for_status()
    mode_id = r.json()[0]["id"]

    conv_ids: List[str] = []
    for _ in range(concurrency):
        rr = requests.post(f"{base}/chat/conversations", headers=headers, json={"mode_id": mode_id}, timeout=5)
        rr.raise_for_status()
        conv_ids.append(rr.json()["id"])

    total_ok = 0
    total_sent = 0
    start = time.perf_counter()

    def do_conv(cid: str):
        ok_count = 0
        for j in range(messages_per_conv):
            ok, _ = send_message(base, headers, cid, f"并发测试消息 {j}")
            if ok:
                ok_count += 1
        return ok_count

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [ex.submit(do_conv, cid) for cid in conv_ids]
        for f in concurrent.futures.as_completed(futures):
            total_ok += f.result()
            total_sent += messages_per_conv

    elapsed = time.perf_counter() - start
    return total_ok, total_sent, elapsed


def main():
    ap = argparse.ArgumentParser(description="性能压测：大规模文档 + 并发对话")
    ap.add_argument("--base-url", default="http://localhost")
    ap.add_argument("--username", default="admin@cypherguard.local")
    ap.add_argument("--password", default="admin123")
    ap.add_argument("--docs", type=int, default=10, help="批量上传文档数")
    ap.add_argument("--concurrent-convs", type=int, default=5, help="并发对话数")
    ap.add_argument("--messages-per-conv", type=int, default=2, help="每个对话消息数")
    ap.add_argument("--upload-only", action="store_true", help="仅跑上传")
    ap.add_argument("--chat-only", action="store_true", help="仅跑并发对话")
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    try:
        headers = auth(base, args.username, args.password)
    except Exception as e:
        print("认证失败:", e)
        sys.exit(1)

    print("=" * 60)
    print("CypherGuard AI 性能压测")
    print("=" * 60)

    if not args.chat_only:
        print(f"\n[1] 批量上传文档 (count={args.docs})")
        success, elapsed = run_bulk_upload(base, headers, args.docs)
        print(f"    成功: {success}/{args.docs}, 耗时: {elapsed:.2f}s, 速率: {success / max(elapsed, 0.001):.1f} doc/s")

    if not args.upload_only:
        print(f"\n[2] 并发对话 (convs={args.concurrent_convs}, msg/conv={args.messages_per_conv})")
        ok, total, elapsed = run_concurrent_chats(base, headers, args.concurrent_convs, args.messages_per_conv)
        print(f"    成功消息: {ok}/{total}, 耗时: {elapsed:.2f}s, QPS: {ok / max(elapsed, 0.001):.1f}")

    print("\n压测完成")
    sys.exit(0)


if __name__ == "__main__":
    main()
