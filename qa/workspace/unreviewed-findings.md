# QA Heartbeat — Unreviewed Findings (2026-04-29)

## Environment / repo
- Project root `/app` is **not** a git repository; the git repo is under `/app/agents`.

## Findings
### CRITICAL — TypeScript build currently fails
- `./node_modules/.bin/tsc --noEmit` fails in `/app/agents`:
  - Error: `shared/lib/project-health.ts(219,7): TS2741 Property 'comment' is missing in type '{ type: "launch-workflow"; reason: string; }' but required in type 'HealthAction'.`
- Evidence: `cd agents && ./node_modules/.bin/tsc --noEmit` (exit code 2).

### Note — Tests pass
- `./node_modules/.bin/vitest --run` passes: **191 tests**.

## Suspected cause
- In `agents/shared/lib/project-health.ts`, `HealthAction` requires `comment: string`.
- In `diagnoseProject()`, branch for `status === "closed"` with unread discussion returns `{ type: "launch-workflow", reason: "..." }` without `comment`.

## Recommended fix
- Add `comment: ""` to that return object (or make `comment` optional for `launch-workflow` type), and re-run `tsc --noEmit`.
