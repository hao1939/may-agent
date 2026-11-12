#!/bin/bash
set -e

export HOME="${HOME:-/app/.state}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"

if [ ! -f "${GEMINI_CLI_HOME:-${HOME}}/.gemini/settings.json" ]; then
  source /usr/local/bin/setup-gemini-config.sh
fi

exec /usr/local/bin/gemini-cli --yolo --skip-trust --no-sandbox "$@"
