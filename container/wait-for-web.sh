#!/bin/bash
# Wait for the web UI to be ready, then launch Chrome pointing at it.
# Used by supervisord to ensure Chrome doesn't hit a connection-refused error page.

WEB_PORT="${WEB_PORT:-8080}"
MAX_WAIT=30

for i in $(seq 1 $MAX_WAIT); do
  if curl -sf -o /dev/null "http://localhost:${WEB_PORT}/"; then
    break
  fi
  sleep 1
done

exec "$@" "http://localhost:${WEB_PORT}/"
