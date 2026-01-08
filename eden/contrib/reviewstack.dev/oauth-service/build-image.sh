#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE_TAG="${1:-reviewstack-oauth:local}"
DOCKERFILE="${SCRIPT_DIR}/Dockerfile"

docker build -f "${DOCKERFILE}" -t "${IMAGE_TAG}" "${SCRIPT_DIR}"
