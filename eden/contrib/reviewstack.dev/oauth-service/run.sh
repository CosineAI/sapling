#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:-reviewstack-oauth:local}"

docker run --rm -p 8081:8081 \
  -e PORT=8081 \
  -e FRONTEND_ORIGIN="https://reviewstack.example.com" \
  -e OAUTH_SERVICE_ORIGIN="https://oauth.reviewstack.example.com" \
  -e FRONTEND_CALLBACK_PATH="/oauth-callback.html" \
  -e GITHUB_BASE_URL="https://github.com" \
  -e GITHUB_AUTHORIZE_PATH="/login/oauth/authorize" \
  -e GITHUB_TOKEN_PATH="/login/oauth/access_token" \
  -e GITHUB_SCOPE="user repo" \
  -e GITHUB_CLIENT_ID="your-client-id" \
  -e GITHUB_CLIENT_SECRET="your-client-secret" \
  "${IMAGE_TAG}"
