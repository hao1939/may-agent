# QA Heartbeat — Unreviewed Findings

## Context
Recent commits in last 6h (git log):
- ea93870 fix: use docker instead of podman in scripts
- d5b30e8 fix: decouple log.ts from EventBus to eliminate circular dependency
- c2a8a94 fix: prevent infinite recursion in event-bus emit/log cycle

## Evidence-based findings

### 1) TypeScript build is currently failing (prevents confident verification)
**Severity:** CRITICAL

`./node_modules/.bin/tsc --noEmit` reports multiple errors (agents/shared/agent-sdk.ts TS5097 import with .ts extension; evaluator.ts index type; finish-guard.ts TaskResult typing).

Evidence: tsc output in this heartbeat (see QA run log).

### 2) Vitest run fails due to missing modules + PATH/bun assumptions
**Severity:** CRITICAL

`./node_modules/.bin/vitest --run` fails with:
- Missing modules imported by tests (e.g. `../agents/shared/workflows/auto-loop.js`, `../src/lib/lessons.ts`, `../../agents/may/handlers/error-log-scanner.js`).
- `src/lib/tools/bash-path.test.ts` expects `.state/.bun/bin` and bun availability, but the actual PATH shows `/home/hao/.bun/bin` and bun is not found under minimal PATH.
- `test/handlers/system-status.test.ts` expects `tscResult === "PASS"` but received `"SKIP (no tsconfig.json)"`.

Evidence: vitest output in this heartbeat.

## Notes
These failures look like environment/repo consistency problems, not directly tied to the docker/podman script change alone. However, they block a PASS for any recent changes until resolved.
