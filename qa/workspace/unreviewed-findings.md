# Unreviewed findings (QA heartbeat)

## 2026-04-23

### Environment / process findings
- `/app` is not a git repository; repo is at `/app/agents` (verified by `cd agents && git log`).
- Mandatory verification commands in QA SOP cannot currently be executed as written:
  - `./node_modules/.bin/tsc --noEmit` is missing in both `/app` and `/app/agents`.
  - `./node_modules/.bin/vitest --run` is missing in `/app/agents`.
- `rg` (ripgrep) is not installed in the environment; use `grep` instead.

### Recent changes needing verification
- Recent commits in `/app/agents` within last ~6h are predominantly documentation/heartbeat updates and a change removing a large `node_modules` directory from git (`a9a053784`, `fedda96fa`). No code-level verification possible without restoring devDependencies.

## Evidence
- `cd /app/agents && ls node_modules/.bin | grep -E '^(tsc|vitest)$'` returned no output.
- `cd /app && ./node_modules/.bin/tsc --noEmit` failed: No such file or directory.
