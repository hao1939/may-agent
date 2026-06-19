#!/bin/sh
set -eu

bundle="${MAY_AGENT_BUNDLE_PATH:-/app/projects/may-agent/bundle/may-agent}"
target="${MAY_AGENT_BIN_PATH:-/usr/local/bin/may-agent}"
deploy_marker="${MAY_AGENT_DEPLOY_MARKER:-/app/projects/may-agent/bundle/deploy-requested}"
install_tmp="${target}.next.$$"
services_stopped=0

cleanup() {
  rm -f "$install_tmp"
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
  install -m 755 -o mayagent -g mayagent "$bundle" "$install_tmp"
  mv -f "$install_tmp" "$target"
  rm -f "$deploy_marker"
fi

supervisorctl start may-agent may-agent-web
services_stopped=0
supervisorctl status may-agent may-agent-web || true

echo "[may-agent-restarter] finished at $(date -Iseconds)"
