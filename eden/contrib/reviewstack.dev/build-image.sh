#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRIB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="${1:-reviewstack-dev:local}"
DOCKERFILE="${SCRIPT_DIR}/Dockerfile"

docker build -f "${DOCKERFILE}" -t "${IMAGE_TAG}" "${CONTRIB_DIR}"
