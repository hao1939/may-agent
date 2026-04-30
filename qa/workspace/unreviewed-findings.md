# Unreviewed Findings (QA Heartbeat)

Date: 2026-04-30

## Context
- Repo root `/app` is not a git repo; code lives in `/app/agents` (git repo).

## Recent commits (last 10)
From `cd /app/agents && git log --oneline -10`:
- 6052f6b75 HB-29: Operating layer controls paper + arxiv digest update
- 474b0d3f0 coach: EXP-280 baseline assessment + deployment request for verify-after-edit enforcement
- 33d854505 Deploy EXP-275: optimizer quality intervention (OUTPUT FORMAT + EXECUTION RULES + ANTI-SHALLOW)
- …

## Verification results
### TypeScript compile
- `./node_modules/.bin/tsc --noEmit`: **FAIL**
  - `shared/lib/index.ts` has ambiguous re-exports:
    - TS2308: `IterationRecord` exported multiple times via `./iteration-monitor.js` (reported twice)
    - TS2308: `ValidationResult` exported multiple times via `./task-validator.js`

### Vitest
- `./node_modules/.bin/vitest --run`: tests themselves **pass (536/536)** but command **exits 1** due to environment permission error:
  - `EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`
  - This appears to be a runner cache write permission issue (prevents clean CI-style execution).

## Files sampled
- `shared/lib/index.ts`: barrel re-exports include `task-validator.js` and `iteration-monitor.js`, likely causing duplicate type exports.
- `shared/research-digest.md`: very large doc update; not fully reviewed here (content appears non-code).

## Actionable items
1. Fix barrel export ambiguity in `shared/lib/index.ts` (explicit re-export names or remove duplicates).
2. Fix vitest cache permissions (ensure node_modules/.vite is writable, or configure vitest cache dir to a writable path for this environment).
