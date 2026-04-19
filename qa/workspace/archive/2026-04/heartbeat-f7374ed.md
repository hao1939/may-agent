# QA Heartbeat — 2026-04-04

Reviewed HEAD: `f7374ed` (since last-reviewed `c7ef321`).

## Scope / Diffs
- `git diff --name-only c7ef321..HEAD`:
  - `src/app/may.ts`
  - `src/lib/manager.ts`
  - `src/lib/persistence.ts`

## Checks (mandatory)
- `./node_modules/.bin/tsc --noEmit`: PASS (exit 0).
- `./node_modules/.bin/vitest --run`: FAIL.
  - Summary: **12 failed / 1657 total** (123 files).
  - Failures observed:
    1) `test/verify-parallel.test.ts`: cannot import `../agents/tech-lead/workflows/verify-parallel.ts` (file missing).
    2) `test/chat-session.test.ts`: "handles @agent prefix for direct invocation" expected agent `coder` but got `may`.

## Review Notes / Concerns
- `src/app/may.ts`: changes `models.opus` selection. When `ANTHROPIC_API_KEY` is not set, `models.opus` now falls back to `claude-sonnet-4-20250514` via proxy with `contextWindow=72000`, and no longer sets `id: "claude-opus-4.6"`. This is plausibly correct, but it is an externally visible behavior change (model id reported / logs / metrics).
- `src/lib/persistence.ts`: adds `PersistedSession.maxTurns?: number` for crash recovery.
- `src/lib/manager.ts`:
  - Persists `maxTurns` into meta.json via RegistryStore saveSession.
  - On resume, restores `maxTurns` from persisted meta.
  - Extends `cleanupZombieSessions()` to also update the SQLite `sessions` table by importing `getDb`/`updateSessionDb` from `./requests.js` and scanning for stale `status='running'` rows.

Potential issue to flag: `manager.ts` now has a **direct import** of `./requests.js` even though the file contains a comment claiming requests uses `bun:sqlite` and is "not available in vitest". Vitest passed module loading here, but this may still create an environment coupling risk (node vs bun sqlite differences).

## Verdict
CONDITIONAL (gates failing on HEAD). The code changes reviewed do not obviously break type-checking (`tsc` green), but the repo does not pass vitest due to missing workflow file and a failing ChatSession behavior test.
