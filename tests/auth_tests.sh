#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
TS=$(date +%s)
EMAIL="test_${TS}@example.com"
USERNAME="testuser_${TS}"
PASSWORD="test123456"

echo "[auth] register"
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "${REGISTER_RESPONSE}" | python -c "import sys, json; print(json.load(sys.stdin).get('access_token',''))")
if [ -z "${TOKEN}" ]; then
  echo "[auth] register failed"
  echo "${REGISTER_RESPONSE}"
  exit 1
fi

echo "[auth] login"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

LOGIN_TOKEN=$(echo "${LOGIN_RESPONSE}" | python -c "import sys, json; print(json.load(sys.stdin).get('access_token',''))")
if [ -z "${LOGIN_TOKEN}" ]; then
  echo "[auth] login failed"
  echo "${LOGIN_RESPONSE}"
  exit 1
fi

echo "[auth] me"
ME_RESPONSE=$(curl -s -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/auth/me")
ME_EMAIL=$(echo "${ME_RESPONSE}" | python -c "import sys, json; print(json.load(sys.stdin).get('email',''))")
if [ "${ME_EMAIL}" != "${EMAIL}" ]; then
  echo "[auth] /auth/me failed"
  echo "${ME_RESPONSE}"
  exit 1
fi

echo "[auth] ok"
