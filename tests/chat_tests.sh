#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"

echo "[chat] list modes"
MODES_RESPONSE=$(curl -s "${BASE_URL}/chat/modes")
HAS_QUICK=$(echo "${MODES_RESPONSE}" | python -c "import sys, json; modes=json.load(sys.stdin); print(any(m.get('name')=='quick' for m in modes))")
if [ "${HAS_QUICK}" != "True" ]; then
  echo "[chat] quick mode not found"
  echo "${MODES_RESPONSE}"
  exit 1
fi

echo "[chat] create conversation"
CONV_RESPONSE=$(curl -s -X POST "${BASE_URL}/chat/conversations" \
  -H "Content-Type: application/json" \
  -d '{"mode_name":"quick","title":"test"}')
CONV_ID=$(echo "${CONV_RESPONSE}" | python -c "import sys, json; print(json.load(sys.stdin).get('id',''))")
if [ -z "${CONV_ID}" ]; then
  echo "[chat] create conversation failed"
  echo "${CONV_RESPONSE}"
  exit 1
fi

echo "[chat] send message"
MSG_RESPONSE=$(curl -s -X POST "${BASE_URL}/chat/conversations/${CONV_ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{"content":"What is this system?"}')
ANSWER=$(echo "${MSG_RESPONSE}" | python -c "import sys, json; print(json.load(sys.stdin).get('answer',''))")
if [ -z "${ANSWER}" ]; then
  echo "[chat] message failed"
  echo "${MSG_RESPONSE}"
  exit 1
fi

echo "[chat] list messages"
MESSAGES_RESPONSE=$(curl -s "${BASE_URL}/chat/conversations/${CONV_ID}/messages")
COUNT=$(echo "${MESSAGES_RESPONSE}" | python -c "import sys, json; print(len(json.load(sys.stdin)))")
if [ "${COUNT}" -lt 1 ]; then
  echo "[chat] no messages returned"
  echo "${MESSAGES_RESPONSE}"
  exit 1
fi

echo "[chat] ok"
