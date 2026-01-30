#!/usr/bin/env python3
"""Test model-config-service routes"""

import sys
sys.path.insert(0, 'services/model-config-service')

from app.main import app

print("Available routes in model-config-service:")
print("=" * 60)

for route in app.routes:
    if hasattr(route, 'path'):
        methods = getattr(route, 'methods', {'GET'})
        print(f"{', '.join(methods):10} {route.path}")

print("=" * 60)
print("\nLooking for test-ollama-connection endpoint...")

found = False
for route in app.routes:
    if hasattr(route, 'path') and 'test-ollama-connection' in route.path:
        print(f"✓ Found: {route.path}")
        print(f"  Methods: {route.methods}")
        found = True

if not found:
    print("✗ test-ollama-connection endpoint NOT found!")
    print("\nThis means the endpoint was not registered properly.")
