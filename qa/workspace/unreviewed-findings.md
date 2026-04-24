# QA heartbeat — unreviewed findings (2026-04-24)

## Inbox: duplicate "Quick Code Review" waste alerts
- Action: **dismiss as duplicates** and request upstream deduplication.
- Evidence: multiple pending events in inbox all describing 5 identical requests.

## Tooling / process issues found
### IMPORTANT: repo root mismatch caused false failure in mandatory checks
- I initially ran `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest --run` from `/app` and both failed because `/app` is not the Node project root.
- Evidence: `/app` has no `node_modules/` (see `ls -la` in root). Actual project is `/app/agents` which contains `node_modules/` and `.git`.

### IMPORTANT: vitest not installed as a dependency (but tests can run via npx)
- `./node_modules/.bin/vitest` missing in `/app/agents`.
- `npx vitest --run` succeeds (145 tests).
- Risk: any workflow hardcoding `./node_modules/.bin/vitest` will fail in this repo configuration.

## Recent changes sampled
- Commit `423809308` only touches agent session logs and experiment run jsonl; no production code changes observed.
