#!/bin/sh
set -eu

bundle="${MAY_AGENT_BUNDLE_PATH:-/app/projects/may-agent/bundle/may-agent}"
target="${MAY_AGENT_BIN_PATH:-/usr/local/bin/may-agent}"
console_bundle="${MAY_CONSOLE_BUNDLE_PATH:-/app/projects/may-agent/bundle/may-console}"
console_target="${MAY_CONSOLE_BIN_PATH:-/usr/local/bin/may-console}"
deploy_marker="${MAY_AGENT_DEPLOY_MARKER:-/app/projects/may-agent/bundle/deploy-requested}"
sdk_marker="${MAY_AGENT_SDK_DEPLOY_MARKER:-/app/projects/may-agent/bundle/sdk-requested}"
sdk_root="${MAY_AGENT_DEPLOY_SDK_ROOT:-/app/projects/may-agent/bundle}"
sdk_link="${MAY_AGENT_SDK_LINK:-$sdk_root/sdk-current}"
receipt_tool="${MAY_AGENT_DEPLOY_RECEIPT_TOOL:-/app/projects/may-agent/bundle/deploy-receipt.ts}"
install_tmp="${target}.next.$$"
backup="${target}.prev.$$"
console_install_tmp="${console_target}.next.$$"
console_backup="${console_target}.prev.$$"
sdk_link_tmp="${sdk_link}.next.$$"
services_stopped=0
deployed=0
finalized=0
runtime_services="may-agent may-agent-web"
receipt=""
sdk_release=""
previous_sdk_release=""
health_attempts="${MAY_AGENT_HEALTH_ATTEMPTS:-90}"
health_delay="${MAY_AGENT_HEALTH_DELAY:-1}"

wait_for_health() {
  i=1
  while [ "$i" -le "$health_attempts" ]; do
    if supervisorctl status $runtime_services | grep -q "^may-agent[[:space:]].*RUNNING" \
      && supervisorctl status $runtime_services | grep -q "^may-agent-web[[:space:]].*RUNNING" \
      && supervisorctl status $runtime_services | grep -q "^may-agent-maintenance[[:space:]].*RUNNING" \
      && curl -fsS --max-time 6 "http://127.0.0.1:${WEB_PORT:-8080}/api/readiness" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$health_delay"
    i=$((i + 1))
  done
  return 1
}

emit_wake() {
  phase="$1"
  payload="$(bun -e 'const r=JSON.parse(await Bun.file(process.argv[1]).text()); console.log(JSON.stringify({project:r.project,taskId:r.taskId,task_id:r.taskId,reason:"restart-aware-deploy-receipt",deploymentCorrelation:r.correlation,deploymentPhase:process.argv[2]}))' "$receipt" "$phase")"
  "$target" --emit project.task.tick "$payload"
}

settle() {
  phase="$1"; sha="$2"; health="$3"; wake="$4"; failure="${5:-}"
  bun "$receipt_tool" settle "$receipt" "$phase" "$sha" "$health" "$wake" "$failure"
}

switch_sdk() {
  release="$1"
  rm -f "$sdk_link_tmp"
  ln -s "$release" "$sdk_link_tmp"
  mv -Tf "$sdk_link_tmp" "$sdk_link"
}

cleanup() {
  rc=$?
  rm -f "$install_tmp" "$console_install_tmp" "$sdk_link_tmp"
  if [ "$services_stopped" = "1" ]; then supervisorctl start $runtime_services || true; fi
  if [ "$deployed" = "1" ] && [ "$finalized" = "0" ] && [ -n "$receipt" ]; then
    loaded="$(sha256sum "$target" 2>/dev/null | awk '{print $1}' || echo unknown)"
    settle failed "$loaded" unhealthy false "restarter-exit-$rc" || true
    emit_wake failed || true
  fi
  rm -f "$backup" "$console_backup"
  exit "$rc"
}
trap cleanup EXIT

echo "[may-agent-restarter] requested at $(date -Iseconds)"
sleep "${MAY_AGENT_RESTART_DELAY:-0.2}"

if [ -e "$deploy_marker" ]; then
  receipt="$(cat "$deploy_marker")"
  case "$receipt" in /app/projects/may-agent/.state/deploy-receipts/*.json) ;; *) echo "Unsafe deploy receipt path: $receipt" >&2; exit 1;; esac
  if [ ! -f "$receipt" ] || [ ! -x "$bundle" ] || [ ! -x "$console_bundle" ]; then
    echo "[may-agent-restarter] receipt or bundle missing: $receipt $bundle $console_bundle" >&2
    exit 1
  fi
  source_commit="$(bun -e 'const r=JSON.parse(await Bun.file(process.argv[1]).text()); if (!/^[0-9a-f]{40}$/.test(r.sourceCommit)) throw new Error("invalid sourceCommit"); process.stdout.write(r.sourceCommit)' "$receipt")"
  sdk_release="$(cat "$sdk_marker" 2>/dev/null || true)"
  if [ "$sdk_release" != "sdk-$source_commit" ] || [ ! -f "$sdk_root/$sdk_release/package.json" ]; then
    echo "[may-agent-restarter] SDK release missing or mismatched: $sdk_release" >&2
    exit 1
  fi
  if [ -L "$sdk_link" ]; then
    previous_sdk_release="$(readlink "$sdk_link")"
  elif [ -e "$sdk_link" ]; then
    echo "[may-agent-restarter] SDK current path is not a symlink: $sdk_link" >&2
    exit 1
  fi
  echo "[may-agent-restarter] correlated staged deploy detected: $receipt"
  runtime_services="$runtime_services may-agent-maintenance"
fi

supervisorctl stop $runtime_services || true
services_stopped=1

if [ -n "$receipt" ]; then
  cp -f "$target" "$backup"
  cp -f "$console_target" "$console_backup"
  switch_sdk "$sdk_release"
  install -m 755 -o mayagent -g mayagent "$bundle" "$install_tmp"
  mv -f "$install_tmp" "$target"
  install -m 755 "$console_bundle" "$console_install_tmp"
  mv -f "$console_install_tmp" "$console_target"
  rm -f "$deploy_marker" "$sdk_marker"
  deployed=1
fi

supervisorctl start $runtime_services
services_stopped=0

if [ "$deployed" = "1" ]; then
  if wait_for_health; then
    loaded="$(sha256sum "$target" | awk '{print $1}')"
    emit_wake succeeded
    settle succeeded "$loaded" healthy true
    finalized=1
  else
    echo "[may-agent-restarter] health failed; rolling back" >&2
    supervisorctl stop $runtime_services || true
    services_stopped=1
    install -m 755 -o mayagent -g mayagent "$backup" "$target"
    install -m 755 "$console_backup" "$console_target"
    if [ -n "$previous_sdk_release" ]; then
      switch_sdk "$previous_sdk_release"
    fi
    supervisorctl start $runtime_services
    services_stopped=0
    loaded="$(sha256sum "$target" | awk '{print $1}')"
    rollback_health=unhealthy
    if wait_for_health; then rollback_health=healthy; fi
    rollback_wake=false
    if emit_wake rolled_back; then rollback_wake=true; fi
    settle rolled_back "$loaded" "$rollback_health" "$rollback_wake" health-check-failed
    finalized=1
    exit 1
  fi
fi

supervisorctl status $runtime_services || true
echo "[may-agent-restarter] finished at $(date -Iseconds)"
