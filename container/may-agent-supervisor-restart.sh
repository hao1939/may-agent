#!/bin/sh
set -eu

bundle="${MAY_AGENT_BUNDLE_PATH:-/app/projects/may-agent/bundle/may-agent}"
target="${MAY_AGENT_BIN_PATH:-/usr/local/bin/may-agent}"
deploy_marker="${MAY_AGENT_DEPLOY_MARKER:-/app/projects/may-agent/bundle/deploy-requested}"
install_tmp="${target}.next.$$"
backup="${target}.prev.$$"
services_stopped=0
deployed=0

cleanup() {
  rm -f "$install_tmp"
  rm -f "$backup"
  if [ "$services_stopped" = "1" ]; then
    supervisorctl start may-agent may-agent-web || true
  fi
}

trap cleanup EXIT

echo "[may-agent-restarter] requested at $(date -Iseconds)"
sleep "${MAY_AGENT_RESTART_DELAY:-0.2}"

if [ -e "$deploy_marker" ]; then
  if [ ! -x "$bundle" ]; then
    echo "[may-agent-restarter] deploy marker exists but bundle is missing or not executable: $bundle" >&2
    exit 1
  fi
  echo "[may-agent-restarter] staged deploy detected: $bundle -> $target"
fi

supervisorctl stop may-agent may-agent-web || true
services_stopped=1

if [ -e "$deploy_marker" ]; then
  cp -f "$target" "$backup"
  install -m 755 -o mayagent -g mayagent "$bundle" "$install_tmp"
  mv -f "$install_tmp" "$target"
  rm -f "$deploy_marker"
  deployed=1
fi

supervisorctl start may-agent may-agent-web
services_stopped=0
supervisorctl status may-agent may-agent-web || true

if [ "$deployed" = "1" ]; then
  health_ok=0
  attempts="${MAY_AGENT_HEALTH_ATTEMPTS:-12}"
  delay="${MAY_AGENT_HEALTH_DELAY:-1}"
  i=1
  while [ "$i" -le "$attempts" ]; do
    if supervisorctl status may-agent may-agent-web | grep -q "^may-agent[[:space:]].*RUNNING" \
      && supervisorctl status may-agent may-agent-web | grep -q "^may-agent-web[[:space:]].*RUNNING" \
      && curl -fsS "http://127.0.0.1:${WEB_PORT:-8080}/api/projects" >/dev/null 2>&1; then
      health_ok=1
      break
    fi
    sleep "$delay"
    i=$((i + 1))
  done

  if [ "$health_ok" != "1" ]; then
    echo "[may-agent-restarter] health check failed after deploy; rolling back to previous binary" >&2
    supervisorctl stop may-agent may-agent-web || true
    services_stopped=1
    install -m 755 -o mayagent -g mayagent "$backup" "$target"
    supervisorctl start may-agent may-agent-web
    services_stopped=0
    supervisorctl status may-agent may-agent-web || true
    exit 1
  fi
fi

echo "[may-agent-restarter] finished at $(date -Iseconds)"
