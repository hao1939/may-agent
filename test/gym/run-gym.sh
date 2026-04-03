#!/usr/bin/env bash
# Redirects to the canonical gym runner at scripts/gym-run.sh
exec "$(cd "$(dirname "$0")/../.." && pwd)/scripts/gym-run.sh" "$@"
