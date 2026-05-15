#!/usr/bin/env bash
#
# Redirects to the canonical gym runner.
exec "$(cd "$(dirname "$0")/../../.." && pwd)/scripts/gym-run.sh" "$@"
