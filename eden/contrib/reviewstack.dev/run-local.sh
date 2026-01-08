#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REVIEWSTACK_IMAGE="${REVIEWSTACK_IMAGE:-reviewstack-dev:local}"
OAUTH_IMAGE="${OAUTH_IMAGE:-reviewstack-oauth:local}"

FRONTEND_PORT="${FRONTEND_PORT:-8080}"
OAUTH_PORT="${OAUTH_PORT:-8081}"

FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:${FRONTEND_PORT}}"
OAUTH_SERVICE_ORIGIN="${OAUTH_SERVICE_ORIGIN:-http://localhost:${OAUTH_PORT}}"

CONFIG_FILE="${CONFIG_FILE:-${SCRIPT_DIR}/config.local.js}"
CONFIG_AUTH_MODE="${CONFIG_AUTH_MODE:-oauth}"
CONFIG_HOSTNAME="${CONFIG_HOSTNAME:-github.com}"
CONFIG_ALLOW_PAT_FALLBACK="${CONFIG_ALLOW_PAT_FALLBACK:-true}"
CONFIG_OAUTH_AUTHORIZE_URL="${CONFIG_OAUTH_AUTHORIZE_URL:-${OAUTH_SERVICE_ORIGIN}/authorize}"
CONFIG_OAUTH_CLIENT_ID="${CONFIG_OAUTH_CLIENT_ID:-}"
CONFIG_OAUTH_SCOPE="${CONFIG_OAUTH_SCOPE:-user repo}"
CONFIG_OAUTH_TOKEN_PARAM="${CONFIG_OAUTH_TOKEN_PARAM:-token}"
CONFIG_OAUTH_ERROR_PARAM="${CONFIG_OAUTH_ERROR_PARAM:-error}"
CONFIG_OAUTH_CALLBACK_PATH="${CONFIG_OAUTH_CALLBACK_PATH:-/oauth-callback.html}"

GITHUB_BASE_URL="${GITHUB_BASE_URL:-https://github.com}"
GITHUB_AUTHORIZE_PATH="${GITHUB_AUTHORIZE_PATH:-/login/oauth/authorize}"
GITHUB_TOKEN_PATH="${GITHUB_TOKEN_PATH:-/login/oauth/access_token}"
GITHUB_SCOPE="${GITHUB_SCOPE:-user repo}"
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-your-client-id}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-your-client-secret}"

"${SCRIPT_DIR}/build-image.sh" "${REVIEWSTACK_IMAGE}"
"${SCRIPT_DIR}/oauth-service/build-image.sh" "${OAUTH_IMAGE}"

cat > "${CONFIG_FILE}" <<EOF
window.REVIEWSTACK_CONFIG = {
  auth: {
    mode: "${CONFIG_AUTH_MODE}",
    hostname: "${CONFIG_HOSTNAME}",
    allowPatFallback: ${CONFIG_ALLOW_PAT_FALLBACK},
    oauth: {
      authorizeUrl: "${CONFIG_OAUTH_AUTHORIZE_URL}",
      clientId: "${CONFIG_OAUTH_CLIENT_ID}",
      scope: "${CONFIG_OAUTH_SCOPE}",
      tokenParam: "${CONFIG_OAUTH_TOKEN_PARAM}",
      errorParam: "${CONFIG_OAUTH_ERROR_PARAM}",
      callbackPath: "${CONFIG_OAUTH_CALLBACK_PATH}"
    }
  }
};
EOF

docker rm -f reviewstack-dev reviewstack-oauth >/dev/null 2>&1 || true

docker run -d --name reviewstack-oauth -p "${OAUTH_PORT}:8081" \
  -e PORT=8081 \
  -e FRONTEND_ORIGIN="${FRONTEND_ORIGIN}" \
  -e OAUTH_SERVICE_ORIGIN="${OAUTH_SERVICE_ORIGIN}" \
  -e FRONTEND_CALLBACK_PATH="${CONFIG_OAUTH_CALLBACK_PATH}" \
  -e GITHUB_BASE_URL="${GITHUB_BASE_URL}" \
  -e GITHUB_AUTHORIZE_PATH="${GITHUB_AUTHORIZE_PATH}" \
  -e GITHUB_TOKEN_PATH="${GITHUB_TOKEN_PATH}" \
  -e GITHUB_SCOPE="${GITHUB_SCOPE}" \
  -e GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID}" \
  -e GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET}" \
  "${OAUTH_IMAGE}" >/dev/null

docker run -d --name reviewstack-dev -p "${FRONTEND_PORT}:8080" \
  -v "${CONFIG_FILE}:/usr/share/nginx/html/config.js:ro" \
  "${REVIEWSTACK_IMAGE}" >/dev/null

echo "ReviewStack: ${FRONTEND_ORIGIN}"
echo "OAuth proxy: ${OAUTH_SERVICE_ORIGIN}"
