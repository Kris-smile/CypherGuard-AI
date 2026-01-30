#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"

echo "[kb] list documents"
curl -s "${BASE_URL}/kb/documents" | python -m json.tool > /dev/null

TMP_FILE=$(mktemp)
echo "kb test content" > "${TMP_FILE}"

echo "[kb] upload document"
UPLOAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/kb/documents/upload" \
  -F "file=@${TMP_FILE}" \
  -F "title=kb-test" \
  -F "tags=test,ci")

DOC_ID=$(echo "${UPLOAD_RESPONSE}" | python -c "import sys, json; print(json.load(sys.stdin).get('id',''))")
if [ -z "${DOC_ID}" ]; then
  echo "[kb] upload failed"
  echo "${UPLOAD_RESPONSE}"
  exit 1
fi

echo "[kb] get document"
GET_RESPONSE=$(curl -s "${BASE_URL}/kb/documents/${DOC_ID}")
GET_ID=$(echo "${GET_RESPONSE}" | python -c "import sys, json; print(json.load(sys.stdin).get('id',''))")
if [ "${GET_ID}" != "${DOC_ID}" ]; then
  echo "[kb] get document failed"
  echo "${GET_RESPONSE}"
  exit 1
fi

echo "[kb] list tasks"
curl -s "${BASE_URL}/kb/tasks?document_id=${DOC_ID}" | python -m json.tool > /dev/null

rm -f "${TMP_FILE}"
echo "[kb] ok"
