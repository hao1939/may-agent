# Unreviewed findings (QA heartbeat) — 2026-04-26

## Environment/test runner issues
- `./node_modules/.bin/tsc --noEmit` does not run a project build; it prints TypeScript CLI help and exits with code 1. This strongly suggests the repo root is missing a `tsconfig.json`, or the command is being run from a directory without one. Evidence: QA heartbeat tool output (tsc help text, exit code 1).
- `./node_modules/.bin/vitest --run` is not present (`No such file or directory`, exit code 127). Evidence: QA heartbeat tool output.

Impact: QA cannot currently perform the mandatory verification steps in this environment as specified (tsc + vitest). This is a pre-existing environment/config issue to resolve if TypeScript/vitest checks are intended at repo root.

## Recent change spot-check
- Latest commit `0901093` adds `.state/experiments/EXP-230-concept-lookup-deployment.md` which claims a new tool `agents/shared/knowledge/ke-lookup.sh`.
- Verified `agents/shared/knowledge/ke-lookup.sh` exists and runs for a sample query (`verification`), returning KE links as expected.

Potential issue to verify: the script assumes `concept-index.md` exists at `agents/shared/knowledge/concept-index.md`; if absent or moved, the script will fail under `set -euo pipefail`. Consider adding an explicit check/error message.
