#!/bin/sh
set -eu

echo "[may-agent-restarter] requested at $(date -Iseconds)"
sleep "${MAY_AGENT_RESTART_DELAY:-0.2}"

supervisorctl restart may-agent may-agent-web || true
supervisorctl start may-agent may-agent-web || true
supervisorctl status may-agent may-agent-web || true

echo "[may-agent-restarter] finished at $(date -Iseconds)"
