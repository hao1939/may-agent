#!/bin/sh
set -eu

export HOME="${HOME:-/app/.state}"
export XDG_CONFIG_HOME="${HOME}/herdr/config"
export XDG_STATE_HOME="${HOME}/herdr/state"
export XDG_RUNTIME_DIR="${HOME}/herdr/runtime"

exec /usr/local/bin/herdr "$@"
