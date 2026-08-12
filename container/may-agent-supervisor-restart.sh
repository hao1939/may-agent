#!/bin/sh
set -eu

bundle="${MAY_AGENT_BUNDLE_PATH:-/app/projects/may-agent/bundle/may-agent}"
target="${MAY_AGENT_BIN_PATH:-/usr/local/bin/may-agent}"
deploy_marker="${MAY_AGENT_DEPLOY_MARKER:-/app/projects/may-agent/bundle/deploy-requested}"
receipt_tool="/app/projects/may-agent/scripts/deploy-receipt.ts"
install_tmp="${target}.next.$$"
backup="${target}.prev.$$"
services_stopped=0
deployed=0
finalized=0
runtime_services="may-agent may-agent-web"
receipt=""

emit_wake() {
  phase="$1"
  payload="$(bun -e 'const r=JSON.parse(await Bun.file(process.argv[1]).text()); console.log(JSON.stringify({project:r.project,taskId:r.taskId,task_id:r.taskId,reason:"restart-aware-deploy-receipt",deploymentCorrelation:r.correlation,deploymentPhase:process.argv[2]}))' "$receipt" "$phase")"
  "$target" --emit project.task.tick "$payload"
}

settle() {
  phase="$1"; sha="$2"; health="$3"; wake="$4"; failure="${5:-}"
  bun "$receipt_tool" settle "$receipt" "$phase" "$sha" "$health" "$wake" "$failure"
}

cleanup() {
  rc=$?
  rm -f "$install_tmp"
  if [ "$services_stopped" = "1" ]; then supervisorctl start $runtime_services || true; fi
  if [ "$deployed" = "1" ] && [ "$finalized" = "0" ] && [ -n "$receipt" ]; then
    loaded="$(sha256sum "$target" 2>/dev/null | awk '{print $1}' || echo unknown)"
    settle failed "$loaded" unhealthy false "restarter-exit-$rc" || true
    emit_wake failed || true
  fi
  rm -f "$backup"
  exit "$rc"
}
trap cleanup EXIT

echo "[may-agent-restarter] requested at $(date -Iseconds)"
sleep "${MAY_AGENT_RESTART_DELAY:-0.2}"

if [ -e "$deploy_marker" ]; then
  receipt="$(cat "$deploy_marker")"
  case "$receipt" in /app/projects/may-agent/.state/deploy-receipts/*.json) ;; *) echo "Unsafe deploy receipt path: $receipt" >&2; exit 1;; esac
  if [ ! -f "$receipt" ] || [ ! -x "$bundle" ]; then
    echo "[may-agent-restarter] receipt or bundle missing: $receipt $bundle" >&2
    exit 1
  fi
  echo "[may-agent-restarter] correlated staged deploy detected: $receipt"
  runtime_services="$runtime_services may-agent-maintenance"
fi

supervisorctl stop $runtime_services || true
services_stopped=1

if [ -n "$receipt" ]; then
  cp -f "$target" "$backup"
  install -m 755 -o mayagent -g mayagent "$bundle" "$install_tmp"
  mv -f "$install_tmp" "$target"
  rm -f "$deploy_marker"
  deployed=1
fi

supervisorctl start $runtime_services
services_stopped=0

if [ "$deployed" = "1" ]; then
  health_ok=0
  attempts="${MAY_AGENT_HEALTH_ATTEMPTS:-20}"
  delay="${MAY_AGENT_HEALTH_DELAY:-1}"
  i=1
  while [ "$i" -le "$attempts" ]; do
    if supervisorctl status $runtime_services | grep -q "^may-agent[[:space:]].*RUNNING" \
      && supervisorctl status $runtime_services | grep -q "^may-agent-web[[:space:]].*RUNNING" \
      && supervisorctl status $runtime_services | grep -q "^may-agent-maintenance[[:space:]].*RUNNING" \
      && curl -fsS "http://127.0.0.1:${WEB_PORT:-8080}/api/projects" >/dev/null 2>&1; then
      health_ok=1
      break
    fi
    sleep "$delay"
    i=$((i + 1))
  done

  if [ "$health_ok" = "1" ]; then
    loaded="$(sha256sum "$target" | awk '{print $1}')"
    emit_wake succeeded
    settle succeeded "$loaded" healthy true
    finalized=1
  else
    echo "[may-agent-restarter] health failed; rolling back" >&2
    supervisorctl stop $runtime_services || true
    services_stopped=1
    install -m 755 -o mayagent -g mayagent "$backup" "$target"
    supervisorctl start $runtime_services
    services_stopped=0
    sleep "$delay"
    loaded="$(sha256sum "$target" | awk '{print $1}')"
    rollback_health=unhealthy
    if supervisorctl status $runtime_services | grep -q "^may-agent[[:space:]].*RUNNING" \
      && curl -fsS "http://127.0.0.1:${WEB_PORT:-8080}/api/projects" >/dev/null 2>&1; then rollback_health=healthy; fi
    emit_wake rolled_back
    settle rolled_back "$loaded" "$rollback_health" true health-check-failed
    finalized=1
    exit 1
  fi
fi

supervisorctl status $runtime_services || true
echo "[may-agent-restarter] finished at $(date -Iseconds)"
