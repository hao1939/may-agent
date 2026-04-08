#!/bin/bash
# Wrapper: source .env then exec the may-agent binary.
# This ensures env changes in .env take effect on every restart
# without needing to restart the entire container.
[ -f "${PROJECT_ROOT:-.}/.env" ] && export $(grep -v "^#" "${PROJECT_ROOT:-.}/.env" | xargs)
exec "${MAY_BIN:-/app/bundle/may-agent}" "$@"
