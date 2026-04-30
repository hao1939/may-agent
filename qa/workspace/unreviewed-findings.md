# QA Heartbeat — Unreviewed Findings (2026-04-30)

## Context
- Repo root `/app` is **not** a git repository; the active git repo is `/app/agents`.
- Recent commits are mostly evaluator auto-log updates. No product-feature change reviewed this heartbeat.

## Findings
### IMPORTANT — TypeScript build currently failing in `/app/agents`
`./node_modules/.bin/tsc --noEmit` fails with duplicate export names in the shared library barrel:
- `shared/lib/index.ts` exports multiple modules that each export `IterationRecord` (at least `iteration-monitor.ts`, `workflow-metrics.ts`, `session-analyzer.ts`).
- It also exports multiple modules that export `ValidationResult` (`task-validator.ts`, `config-validator.ts`).

This produces TS2308 errors (ambiguous re-exports) and breaks consumers of `@shared/lib`.

### NOTE — Tests pass despite tsc failure
`./node_modules/.bin/vitest --run` passes (536 tests across 31 files), so the issue is specifically with TypeScript barrel export semantics, not runtime behavior.

## Evidence (tool outputs)
- `cd agents && ./node_modules/.bin/tsc --noEmit` → TS2308 errors in `shared/lib/index.ts`.
- `cd agents && ./node_modules/.bin/vitest --run` → 31 files, 536 tests passed.
