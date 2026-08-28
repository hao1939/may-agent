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
ui_marker="${MAY_AGENT_UI_DEPLOY_MARKER:-/app/projects/may-agent/bundle/ui-requested}"
ui_root="${MAY_AGENT_DEPLOY_UI_ROOT:-/app/projects/may-agent/bundle}"
ui_target="${MAY_AGENT_UI_PATH:-/app/projects/platform/ui}"
receipt_tool="${MAY_AGENT_DEPLOY_RECEIPT_TOOL:-/app/projects/may-agent/bundle/deploy-receipt.ts}"
receipt_dir="${MAY_AGENT_DEPLOY_RECEIPT_DIR:-/app/projects/may-agent/.state/deploy-receipts}"
runtime_user="${MAY_AGENT_RUNTIME_USER:-mayagent}"
runtime_group="${MAY_AGENT_RUNTIME_GROUP:-mayagent}"
install_tmp="${target}.next.$$"
backup="${target}.prev.$$"
console_install_tmp="${console_target}.next.$$"
console_backup="${console_target}.prev.$$"
sdk_link_tmp="${sdk_link}.next.$$"
ui_link_tmp="${ui_target}.next.$$"
ui_backup="${ui_target}.prev.$$"
services_stopped=0
deployed=0
finalized=0
receipt_accepted=0
activation_started=0
runtime_services="may-agent may-agent-web"
receipt=""
sdk_release=""
ui_release=""
previous_sdk_release=""
sdk_had_previous=0
ui_had_previous=0
ui_activation_started=0
health_attempts="${MAY_AGENT_HEALTH_ATTEMPTS:-90}"
health_delay="${MAY_AGENT_HEALTH_DELAY:-1}"
health_socket="${MAY_AGENT_HEALTH_SOCKET:-${STATE_DIR:-/app/.state}/instances/${DAEMON_INSTANCE:-${INSTANCE:-background}}/${DAEMON_AGENT:-may}.sock}"

probe_control_socket() {
  SOCKET_PATH="$health_socket" bun -e '
    const { createConnection } = await import("node:net");
    const socket = createConnection(process.env.SOCKET_PATH);
    const timer = setTimeout(() => { socket.destroy(); process.exit(1); }, 5000);
    let buffer = "";
    socket.on("connect", () => socket.write(JSON.stringify({ type: "apps.list" }) + "\n"));
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const frame = JSON.parse(line);
          if (frame.command !== "apps.list") continue;
          clearTimeout(timer);
          socket.end();
          process.exit(frame.type === "ok" ? 0 : 1);
        } catch {}
      }
    });
    socket.on("error", () => { clearTimeout(timer); process.exit(1); });
  ' >/dev/null 2>&1
}

wait_for_health() {
  i=1
  while [ "$i" -le "$health_attempts" ]; do
    if supervisorctl status $runtime_services | grep -q "^may-agent[[:space:]].*RUNNING" \
      && supervisorctl status $runtime_services | grep -q "^may-agent-web[[:space:]].*RUNNING" \
      && supervisorctl status $runtime_services | grep -q "^may-agent-maintenance[[:space:]].*RUNNING" \
      && curl -fsS --max-time 6 "http://127.0.0.1:${WEB_PORT:-8080}/api/readiness" >/dev/null 2>&1 \
      && probe_control_socket; then
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
  phase="$1"; sha="$2"; health="$3"; failure="${4:-}"
  bun "$receipt_tool" settle "$receipt" "$phase" "$sha" "$health" "$failure"
}

switch_sdk() {
  release="$1"
  rm -f "$sdk_link_tmp"
  ln -s "$release" "$sdk_link_tmp"
  mv -Tf "$sdk_link_tmp" "$sdk_link"
}

restore_previous_release() {
  supervisorctl stop $runtime_services || true
  services_stopped=1
  install -m 755 -o "$runtime_user" -g "$runtime_group" "$backup" "$target"
  install -m 755 "$console_backup" "$console_target"
  if [ "$sdk_had_previous" = "1" ]; then
    switch_sdk "$previous_sdk_release"
  else
    rm -f "$sdk_link"
  fi
  if [ "$ui_activation_started" = "1" ]; then
    if [ -L "$ui_target" ] || [ -f "$ui_target" ]; then
      rm -f "$ui_target"
    elif [ -e "$ui_target" ]; then
      echo "[may-agent-restarter] refusing to replace unexpected rollback UI path: $ui_target" >&2
      return 1
    fi
    if [ "$ui_had_previous" = "1" ]; then
      mv "$ui_backup" "$ui_target"
    fi
    ui_activation_started=0
  fi
  supervisorctl start $runtime_services
  services_stopped=0
  activation_started=0
}

cleanup() {
  rc=$?
  rm -f "$install_tmp" "$console_install_tmp" "$sdk_link_tmp" "$ui_link_tmp"
  if [ "$activation_started" = "1" ] && [ "$finalized" = "0" ]; then
    restore_previous_release || true
  fi
  if [ "$services_stopped" = "1" ]; then supervisorctl start $runtime_services || true; fi
  if [ "$receipt_accepted" = "1" ] && [ "$finalized" = "0" ]; then
    rm -f "$deploy_marker" "$sdk_marker" "$ui_marker"
    loaded="$(sha256sum "$target" 2>/dev/null | awk '{print $1}' || echo unknown)"
    settle failed "$loaded" unhealthy "restarter-exit-$rc" || true
    emit_wake failed || true
  fi
  if [ "$activation_started" = "0" ] || [ "$finalized" = "1" ]; then
    rm -f "$backup" "$console_backup"
    rm -rf "$ui_backup"
  else
    echo "[may-agent-restarter] rollback artifacts retained: $backup $console_backup $ui_backup" >&2
  fi
  exit "$rc"
}
trap cleanup EXIT

echo "[may-agent-restarter] requested at $(date -Iseconds)"
sleep "${MAY_AGENT_RESTART_DELAY:-0.2}"

if [ -e "$deploy_marker" ]; then
  receipt="$(cat "$deploy_marker")"
  case "$receipt" in "$receipt_dir"/*.json) ;; *) echo "Unsafe deploy receipt path: $receipt" >&2; exit 1;; esac
  if [ ! -f "$receipt" ]; then
    echo "[may-agent-restarter] receipt missing: $receipt" >&2
    exit 1
  fi
  receipt_accepted=1
  if [ ! -x "$bundle" ] || [ ! -x "$console_bundle" ]; then
    echo "[may-agent-restarter] receipt or bundle missing: $receipt $bundle $console_bundle" >&2
    exit 1
  fi
  source_commit="$(bun -e 'const r=JSON.parse(await Bun.file(process.argv[1]).text()); if (!/^[0-9a-f]{40}$/.test(r.sourceCommit)) throw new Error("invalid sourceCommit"); process.stdout.write(r.sourceCommit)' "$receipt")"
  sdk_release="$(cat "$sdk_marker" 2>/dev/null || true)"
  if [ "$sdk_release" != "sdk-$source_commit" ] || [ ! -f "$sdk_root/$sdk_release/package.json" ]; then
    echo "[may-agent-restarter] SDK release missing or mismatched: $sdk_release" >&2
    exit 1
  fi
  ui_release="$(cat "$ui_marker" 2>/dev/null || true)"
  if [ "$ui_release" != "ui-$source_commit" ] || [ ! -f "$ui_root/$ui_release/index.html" ]; then
    echo "[may-agent-restarter] UI release missing or mismatched: $ui_release" >&2
    exit 1
  fi
  if [ -L "$sdk_link" ]; then
    previous_sdk_release="$(readlink "$sdk_link")"
    sdk_had_previous=1
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
  activation_started=1
  switch_sdk "$sdk_release"
  install -m 755 -o "$runtime_user" -g "$runtime_group" "$bundle" "$install_tmp"
  mv -f "$install_tmp" "$target"
  install -m 755 "$console_bundle" "$console_install_tmp"
  mv -f "$console_install_tmp" "$console_target"
  mkdir -p "$(dirname "$ui_target")"
  ln -s "$ui_root/$ui_release" "$ui_link_tmp"
  if [ -e "$ui_target" ] || [ -L "$ui_target" ]; then
    mv "$ui_target" "$ui_backup"
    ui_had_previous=1
  fi
  ui_activation_started=1
  mv -Tf "$ui_link_tmp" "$ui_target"
  rm -f "$deploy_marker" "$sdk_marker" "$ui_marker"
  deployed=1
fi

supervisorctl start $runtime_services
services_stopped=0

if [ "$deployed" = "1" ]; then
  if wait_for_health; then
    loaded="$(sha256sum "$target" | awk '{print $1}')"
    settle succeeded "$loaded" healthy
    finalized=1
    emit_wake succeeded || echo "[may-agent-restarter] terminal task wake failed; periodic recovery will observe the settled receipt" >&2
  else
    echo "[may-agent-restarter] health failed; rolling back" >&2
    restore_previous_release
    loaded="$(sha256sum "$target" | awk '{print $1}')"
    rollback_health=unhealthy
    if wait_for_health; then rollback_health=healthy; fi
    settle rolled_back "$loaded" "$rollback_health" health-check-failed
    emit_wake rolled_back || true
    finalized=1
    exit 1
  fi
fi

supervisorctl status $runtime_services || true
echo "[may-agent-restarter] finished at $(date -Iseconds)"
