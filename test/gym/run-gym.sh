#!/usr/bin/env bash
# Thin wrapper — delegates to the canonical gym runner in scripts/.
exec "$(cd "$(dirname "$0")/../../.." && pwd)/scripts/gym-run.sh" "$@"
