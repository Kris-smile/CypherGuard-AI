#!/usr/bin/env python3
"""生成测试文档用于性能测试"""

import argparse
import os
from pathlib import Path
from datetime import datetime
import random

# 网络安全相关的测试内容
SECURITY_TOPICS = [
    "SQL注入攻击",
    "跨站脚本攻击(XSS)",
    "跨站请求伪造(CSRF)",
    "文件上传漏洞",
    "命令注入",
    "XML外部实体注入(XXE)",
    "服务器端请求伪造(SSRF)",
    "不安全的反序列化",
    "安全配置错误",
    "敏感数据泄露",
]

CVE_EXAMPLES = [
    "CVE-2024-1234",
    "CVE-2024-5678",
    "CVE-2023-9999",
    "CVE-2023-1111",
]

IP_EXAMPLES = [
    "192.168.1.1",
    "10.0.0.1",
    "172.16.0.1",
    "8.8.8.8",
]

DOMAIN_EXAMPLES = [
    "example.com",
    "malicious-site.net",
    "phishing-domain.org",
    "attacker-server.io",
]


def generate_content(topic: str, index: int) -> str:
    """生成测试文档内容"""
    cve = random.choice(CVE_EXAMPLES)
    ip = random.choice(IP_EXAMPLES)
    domain = random.choice(DOMAIN_EXAMPLES)

    content = f"""# {topic} - 测试文档 #{index}

## 概述

本文档介绍了 {topic} 的相关知识，包括攻击原理、危害分析和防御措施。

## 漏洞编号

相关漏洞：{cve}

## 攻击原理

{topic} 是一种常见的网络安全威胁。攻击者通过利用应用程序的安全漏洞，
可以执行未授权的操作，获取敏感信息，或者破坏系统的正常运行。

## 攻击示例

攻击者可能从 IP 地址 {ip} 发起攻击，目标域名为 {domain}。

## 危害分析

1. **数据泄露**：敏感信息可能被窃取
2. **系统破坏**：系统功能可能被破坏
3. **权限提升**：攻击者可能获得更高权限
4. **拒绝服务**：系统可能无法正常提供服务

## 防御措施

### 输入验证

对所有用户输入进行严格验证和过滤：

```python
def validate_input(user_input):
    # 白名单验证
    if not re.match(r'^[a-zA-Z0-9_]+$', user_input):
        raise ValueError("Invalid input")
    return user_input
```

### 输出编码

对输出内容进行适当编码：

```python
from html import escape

def safe_output(content):
    return escape(content)
```

### 使用安全框架

使用经过安全审计的框架和库，避免重复造轮子。

## 检测方法

1. **日志分析**：监控异常访问模式
2. **入侵检测系统(IDS)**：部署 IDS 检测攻击行为
3. **Web应用防火墙(WAF)**：使用 WAF 过滤恶意请求
4. **定期安全审计**：进行代码审计和渗透测试

## 相关资源

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- CWE 数据库: https://cwe.mitre.org/
- NVD 漏洞库: https://nvd.nist.gov/

## 总结

{topic} 是一个严重的安全威胁，需要开发人员和安全团队共同努力，
通过代码审查、安全测试和持续监控来防范此类攻击。

---

**文档生成时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**文档编号**：TEST-DOC-{index:04d}
"""
    return content


def main():
    parser = argparse.ArgumentParser(description='生成测试文档')
    parser.add_argument('--count', type=int, default=10, help='生成文档数量')
    parser.add_argument('--output', type=str, default='test_data', help='输出目录')
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"开始生成 {args.count} 个测试文档...")

    for i in range(1, args.count + 1):
        topic = random.choice(SECURITY_TOPICS)
        content = generate_content(topic, i)

        filename = f"test_doc_{i:04d}.md"
        filepath = output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        if i % 10 == 0:
            print(f"已生成 {i}/{args.count} 个文档")

    print(f"\n✅ 完成！所有文档已保存到 {output_dir}")
    print(f"📁 总计：{args.count} 个文档")


if __name__ == '__main__':
    main()
