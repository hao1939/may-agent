#!/bin/bash
set -e

export HOME="${HOME:-/var/lib/mayagent}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"

if [ ! -f "${CODEX_HOME:-${MAY_CODEX_HOME:-${HOME}/.codex}}/config.toml" ]; then
  source /usr/local/bin/setup-codex-config.sh
fi

for arg in "$@"; do
  case "$arg" in
    -V|--version|-h|--help|help|completion|doctor|login|logout|mcp|plugin|features|archive|unarchive|delete|migrate-rollouts|migrate-nfs-db|debug|cloud|exec-server|remote-control)
      exec /opt/may-agent-cli/node_modules/.bin/codex "$@"
      ;;
  esac
done

extra_flags=()
has_hook_trust=false
for arg in "$@"; do
  if [ "$arg" = "--dangerously-bypass-hook-trust" ]; then
    has_hook_trust=true
    break
  fi
done
if [ "$has_hook_trust" = "false" ]; then
  extra_flags+=("--dangerously-bypass-hook-trust")
fi

exec /opt/may-agent-cli/node_modules/.bin/codex "${extra_flags[@]}" "$@"
