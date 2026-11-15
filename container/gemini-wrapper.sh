#!/bin/bash
set -e

export HOME="${HOME:-/var/lib/mayagent}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-${MODEL_API_KEY}}"
export GOOGLE_GEMINI_BASE_URL="${GOOGLE_GEMINI_BASE_URL:-${MODEL_BASE_URL%/}}"
export GEMINI_CLI_NO_RELAUNCH="${GEMINI_CLI_NO_RELAUNCH:-true}"
gemini_title_preload="/opt/may-agent-cli/gemini-process-title.cjs"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=8192 --require=${gemini_title_preload}"

if [ ! -f "${GEMINI_CLI_HOME:-${HOME}}/.gemini/settings.json" ]; then
  source /usr/local/bin/setup-gemini-config.sh
fi

for arg in "$@"; do
  case "$arg" in
    -v|--version|-h|--help|--list-models|-l|--list-extensions|--list-sessions|--delete-session|mcp|extensions|extension|skills|skill|hooks|hook|gemma|models)
      exec /opt/may-agent-cli/node_modules/.bin/gemini "$@"
      ;;
  esac
done

has_approval=false
for arg in "$@"; do
  case "$arg" in
    -y|--yolo|--approval-mode|--approval-mode=*)
      has_approval=true
      break
      ;;
  esac
done

if [ "$has_approval" = "true" ]; then
  exec /opt/may-agent-cli/node_modules/.bin/gemini "$@"
fi

exec /opt/may-agent-cli/node_modules/.bin/gemini --yolo "$@"
