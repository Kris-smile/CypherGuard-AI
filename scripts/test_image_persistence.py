#!/usr/bin/env python3
"""验证图片持久化功能"""

import requests
import base64
import time
from pathlib import Path


def create_test_image() -> str:
    """创建一个简单的测试图片（1x1 PNG）"""
    # 1x1 红色像素的 PNG
    png_data = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf'
        b'\xc0\x00\x00\x00\x03\x00\x01\x00\x00\x00\x00\x18\xdd\x8d\xb4\x00'
        b'\x00\x00\x00IEND\xaeB`\x82'
    )
    return f"data:image/png;base64,{base64.b64encode(png_data).decode()}"


def test_image_persistence(base_url: str = "http://localhost",
                          username: str = "admin@cypherguard.local",
                          password: str = "admin123"):
    """测试图片持久化功能"""

    print("=" * 60)
    print("图片持久化功能测试")
    print("=" * 60)

    # 1. 登录
    print("\n[1/6] 登录...")
    try:
        response = requests.post(
            f"{base_url}/auth/login",
            json={"username": username, "password": password}
        )
        response.raise_for_status()
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ 登录成功")
    except Exception as e:
        print(f"❌ 登录失败: {e}")
        return False

    # 2. 创建对话
    print("\n[2/6] 创建对话...")
    try:
        # 获取默认 mode
        response = requests.get(f"{base_url}/chat/modes", headers=headers)
        response.raise_for_status()
        modes = response.json()
        if not modes:
            print("❌ 没有可用的对话模式")
            return False
        mode_id = modes[0]["id"]

        # 创建对话
        response = requests.post(
            f"{base_url}/chat/conversations",
            headers=headers,
            json={"mode_id": mode_id}
        )
        response.raise_for_status()
        conversation_id = response.json()["id"]
        print(f"✅ 对话创建成功 (ID: {conversation_id})")
    except Exception as e:
        print(f"❌ 创建对话失败: {e}")
        return False

    # 3. 发送带图片的消息
    print("\n[3/6] 发送带图片的消息...")
    try:
        test_image = create_test_image()
        response = requests.post(
            f"{base_url}/chat/conversations/{conversation_id}/messages",
            headers=headers,
            json={
                "content": "这是一张测试图片",
                "images": [test_image]
            }
        )
        response.raise_for_status()
        print("✅ 消息发送成功")
    except Exception as e:
        print(f"❌ 发送消息失败: {e}")
        return False

    # 4. 等待处理
    print("\n[4/6] 等待消息处理...")
    time.sleep(2)

    # 5. 重新加载消息
    print("\n[5/6] 重新加载消息（模拟刷新页面）...")
    try:
        response = requests.get(
            f"{base_url}/chat/conversations/{conversation_id}/messages",
            headers=headers
        )
        response.raise_for_status()
        messages = response.json()
        print(f"✅ 加载到 {len(messages)} 条消息")
    except Exception as e:
        print(f"❌ 加载消息失败: {e}")
        return False

    # 6. 验证图片是否存在
    print("\n[6/6] 验证图片持久化...")
    user_messages = [m for m in messages if m["role"] == "user"]

    if not user_messages:
        print("❌ 没有找到用户消息")
        return False

    last_message = user_messages[-1]

    # 检查 images_json 字段
    if "images_json" not in last_message:
        print("❌ 消息中没有 images_json 字段")
        print(f"   消息内容: {last_message}")
        return False

    if not last_message["images_json"]:
        print("❌ images_json 字段为空")
        return False

    if len(last_message["images_json"]) == 0:
        print("❌ images_json 数组为空")
        return False

    print("✅ 图片持久化成功！")
    print(f"   图片数量: {len(last_message['images_json'])}")
    print(f"   图片大小: {len(last_message['images_json'][0])} 字符")

    return True


def test_database_directly():
    """直接检查数据库"""
    print("\n" + "=" * 60)
    print("数据库直接检查")
    print("=" * 60)

    try:
        import psycopg2

        conn = psycopg2.connect(
            host="localhost",
            port=5433,
            database="cypherguard",
            user="postgres",
            password="postgres"
        )

        cursor = conn.cursor()

        # 检查表结构
        print("\n[1/2] 检查 messages 表结构...")
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'images_json'
        """)
        result = cursor.fetchone()

        if result:
            print(f"✅ images_json 列存在 (类型: {result[1]})")
        else:
            print("❌ images_json 列不存在")
            return False

        # 检查数据
        print("\n[2/2] 检查最近的图片消息...")
        cursor.execute("""
            SELECT id, role, content,
                   CASE
                       WHEN images_json IS NOT NULL THEN jsonb_array_length(images_json)
                       ELSE 0
                   END as image_count,
                   created_at
            FROM messages
            WHERE images_json IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 5
        """)

        rows = cursor.fetchall()

        if rows:
            print(f"✅ 找到 {len(rows)} 条包含图片的消息:")
            for row in rows:
                print(f"   - ID: {row[0]}, 角色: {row[1]}, 图片数: {row[3]}, 时间: {row[4]}")
        else:
            print("⚠️  数据库中没有包含图片的消息")

        cursor.close()
        conn.close()

        return True

    except ImportError:
        print("⚠️  psycopg2 未安装，跳过数据库检查")
        print("   安装命令: pip install psycopg2-binary")
        return None
    except Exception as e:
        print(f"❌ 数据库检查失败: {e}")
        return False


def main():
    import argparse

    parser = argparse.ArgumentParser(description='验证图片持久化功能')
    parser.add_argument('--base-url', type=str, default='http://localhost', help='API 基础 URL')
    parser.add_argument('--username', type=str, default='admin@cypherguard.local', help='用户名')
    parser.add_argument('--password', type=str, default='admin123', help='密码')
    parser.add_argument('--db-only', action='store_true', help='仅检查数据库')
    args = parser.parse_args()

    if args.db_only:
        test_database_directly()
    else:
        # API 测试
        api_result = test_image_persistence(args.base_url, args.username, args.password)

        # 数据库测试
        db_result = test_database_directly()

        # 总结
        print("\n" + "=" * 60)
        print("测试总结")
        print("=" * 60)
        print(f"API 测试: {'✅ 通过' if api_result else '❌ 失败'}")
        if db_result is not None:
            print(f"数据库检查: {'✅ 通过' if db_result else '❌ 失败'}")
        else:
            print(f"数据库检查: ⚠️  跳过")

        if api_result and (db_result is None or db_result):
            print("\n🎉 图片持久化功能正常！")
        else:
            print("\n⚠️  图片持久化功能存在问题，请检查日志")


if __name__ == '__main__':
    main()
