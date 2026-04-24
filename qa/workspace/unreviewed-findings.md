# QA heartbeat — unreviewed findings

Date: 2026-04-24

## Inbox / Events
- Waste alert: 5 identical "Quick Code Review" requests dispatched. Action: **dismiss as duplicate waste**. Reason: no distinct scope attached; will review latest changes once.

## Recent changes (last 6h)
- Commit `80979ef22` — `fix(evaluator): add fallback to evaluateTask retry path too` (file: `shared/evaluation/evaluator.ts`).

## Verification performed (independent)
- Read file evidence: `agents/shared/evaluation/evaluator.ts` (lines 1-200). Observed new/modified logic: `extractAssistantText()` now tries:
  1) `ctx.readSessionMessages`
  2) `ctx.readArchivedSessionMessages`
  3) direct `.state/sessions/<id>/session.jsonl` and `.state/sessions/history/<id>/session.jsonl` parsing.

- Typecheck: `cd /app/agents && ./node_modules/.bin/tsc --noEmit` => **PASS** (no output, exit 0).

- Tests: `cd /app/agents && ./node_modules/.bin/vitest --run` => **FAIL (environment)**: `./node_modules/.bin/vitest: No such file or directory` (exit 127). `node_modules/.bin` exists but has no `vitest` entry.

## Issues
### IMPORTANT — environment / tooling
- Vitest missing from this repo’s `node_modules` (or not installed). This blocks mandated test verification.

### IMPORTANT — potential runtime behavior (needs targeted test)
- `extractAssistantText()` JSONL fallback parses every line from end until it finds an assistant message. It assumes each line is valid JSON; errors are swallowed (catch-all) and function returns "". This can mask data corruption / partial writes.
  - Evidence: `agents/shared/evaluation/evaluator.ts` lines ~1-60.
  - Recommendation: at minimum, log parsing errors via `appendErrorLogs` (already imported) or narrow the catch.

## Verdict (for commit 80979ef22)
**CONDITIONAL**: Typecheck passes; cannot run tests due to missing `vitest` in environment. The fallback logic looks plausible but should add at least minimal error logging for JSON parse failures to avoid silent false negatives.
