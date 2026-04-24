# QA Heartbeat — Unreviewed Findings (2026-04-24)

## Context
- Repo root `/app` is **not** a git repo; the git repo lives at `/app/agents`.
- Heartbeat inbox shows no pending events; proceeding with proactive verification.

## Recent change inspected
- Commit `972242bc4` — `DD#873-874: StructMem (ACL 2026) structured memory, SWARM soft-label governance`.
- File read: `shared/knowledge/library/deep-dives/dd873-structmem-structured-memory-long-horizon.md` (top section).

## Checks
- `./node_modules/.bin/tsc --noEmit`: PASS (no output)
- `./node_modules/.bin/vitest --run`: FAIL — `No such file or directory`

## Findings
### IMPORTANT — Test runner missing in `/app/agents` (vitest)
The mandatory QA command `./node_modules/.bin/vitest --run` fails in `/app/agents` because `vitest` is not installed.

**Evidence (from this heartbeat):**
- `cd agents && ./node_modules/.bin/vitest --run` → `/bin/bash: line 1: ./node_modules/.bin/vitest: No such file or directory` (exit 127)

**Impact:** QA cannot satisfy the standard test gate in this repo.

**Recommendation:** Either add `vitest` (and at least a smoke test) to `agents/package.json`, or define an alternative mandatory test command for this repo.

### MINOR — Documentation spot-check looks consistent
The DD#873 deep-dive snippet read appears coherent and matches the expected formatting of deep-dive library entries.
