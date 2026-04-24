# QA heartbeat — unreviewed findings

Date: 2026-04-24

## Inbox / Events
- Waste alert: 5 identical "Quick Code Review" requests dispatched. **Dismiss as duplicate waste**.
  - Reason: no distinct scope attached; reviewing once covers all.
  - Action needed by dispatcher: dedupe notifications / coalesce identical requests.

## Recent changes (last 6h)
From `agents` repo git log:
- `6d0ffc85b` — H-EXP-015 Phase 2 complete (compliance resilient under load)
- Multiple commits updating `*/last-session.md` (bob/evaluator/optimizer/scout)
- Prior QA-related commit in window: `ae9a660bc` — qa heartbeat findings on evaluator fallback + vitest missing

## Verification performed (independent)
### Read changed code
- Read evidence: `agents/shared/evaluation/evaluator.ts` (lines 1-240)
  - Observed `extractAssistantText()` now attempts to read assistant text via:
    1) `ctx.readSessionMessages`
    2) `ctx.readArchivedSessionMessages`
    3) JSONL fallback from `.state/sessions/<id>/session.jsonl` and `.state/sessions/history/<id>/session.jsonl`

### Typecheck
- `cd /app/agents && ./node_modules/.bin/tsc --noEmit` => **PASS** (no output, exit 0)

### Tests
- `cd /app/agents && ./node_modules/.bin/vitest --run` => **FAIL (environment/tooling)**
  - Error: `./node_modules/.bin/vitest: No such file or directory` (exit 127)
  - Evidence: `ls node_modules/.bin` shows `tsc/tsserver` etc, but no `vitest`.

## Issues
### IMPORTANT — environment/tooling regression
- This repo currently cannot satisfy the mandated QA step of running `vitest --run` because vitest is not installed/available in `agents/node_modules/.bin`.
  - Impact: prevents independent test verification of recent changes.
  - Suggested fix (owner: tooling/maintainers): add vitest to devDependencies and ensure `pnpm/npm install` is run for this repo in CI/agent env.

### IMPORTANT — silent failure risk in evaluator fallback
- In `extractAssistantText()`, JSONL fallback uses a broad `try { ... JSON.parse(...) ... } catch { /* continue */ }` and returns "" if anything goes wrong.
  - Risk: corrupted/partial JSONL lines (or read/IO errors) silently degrade evaluation quality (false negatives / missing assistant text) with no log.
  - Recommendation: in the catch, call `appendErrorLogs(...)` with at least the sessionId + error message (or narrow catch to parse errors).

## Verdict (for code inspected this heartbeat)
**CONDITIONAL**
- Functional/type safety: typecheck passes.
- Test verification: blocked by missing vitest in environment.
- Code concern: silent failure risk in JSONL fallback should be logged to avoid hiding corruption.
