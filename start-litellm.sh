#!/bin/bash
# Convenience wrapper — start just the LiteLLM service from compose.
# Usage: ./start-litellm.sh [start|stop|logs|status]
set -euo pipefail
cd "$(dirname "$0")"

CMD="${1:-start}"
COMPOSE="podman-compose -f docker/docker-compose.yml"

case "$CMD" in
  start)  $COMPOSE up -d litellm && echo "Waiting for health..." && sleep 8 && curl -sf http://localhost:4000/health/liveliness && echo "" ;;
  stop)   $COMPOSE down litellm ;;
  logs)   podman logs -f may-agent-litellm ;;
  status) curl -sf http://localhost:4000/health/liveliness 2>/dev/null && echo " (localhost:4000)" || echo "❌ Not running" ;;
  *)      echo "Usage: $0 [start|stop|logs|status]" ;;
esac
