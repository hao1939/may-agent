# Unreviewed findings (QA heartbeat)

## Scope (this heartbeat)
- Checked recent commits in `/app/agents` and did a spot-read on recent workflow/handler changes.
- Attempted mandatory verification commands (`tsc`, `vitest`), but this repo’s dependencies do not include them, so independent verification is currently blocked.

## Recent commits (last ~6h)
- `48fa54a5e` — `chore(auto): 9 agents, 14 files: doc updates, workspace updates, skill update` (no executable code changes).
- Most recent *code* changes within the visible history are earlier (e.g. `de24b0f41` and `779fcf822`) and relate to project workflows.

## Mandatory checks (blocked by environment)
### `tsc --noEmit`
- FAIL (cannot run): `/bin/bash: ./node_modules/.bin/tsc: No such file or directory`
  - Evidence: ran `cd /app/agents && ./node_modules/.bin/tsc --noEmit`.
- `npx tsc --noEmit` also fails because TypeScript is not installed.
  - Evidence: `npx -y tsc --noEmit` prints: "This is not the tsc command you are looking for".

### `vitest --run`
- FAIL (cannot run): `/bin/bash: ./node_modules/.bin/vitest: No such file or directory`

### Root cause
- `/app/agents/package.json` only contains:
  - `dependencies: { "puppeteer-core": "^24.42.0" }`
- No `devDependencies` for `typescript` or `vitest`, so the mandated QA commands cannot execute.

## Code spot-check (read evidence)
### `agents/shared/federation/heartbeats/local.json`
- Read file; appears valid JSON with an `agents` list and `last_seen` timestamp.

### Project workflow fix commit reference (not fully verified)
- Commit `de24b0f41` touches:
  - `may/handlers/project.ts`
  - `shared/workflows/project.ts`
- I read the first 260 lines of each file.
  - `shared/workflows/project.ts` read was truncated (file continues), so any conclusions are limited.
  - No obvious issues in the read portions, but this does **not** substitute for typecheck + tests.

## Risks / Findings
### IMPORTANT: QA verification pipeline is non-functional in this repo
- Without `tsc` and `vitest` in `node_modules/.bin`, QA cannot follow the mandatory verification steps.

## Recommendations
1. Add `typescript` and `vitest` (and any required config) as `devDependencies` in `/app/agents/package.json`, or document the correct verification commands for this repo.
2. Once tools exist, rerun:
   - `./node_modules/.bin/tsc --noEmit`
   - `./node_modules/.bin/vitest --run`
