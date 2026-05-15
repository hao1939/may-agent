# QA Heartbeat — Unreviewed Findings (2026-04-21)

## Scope / context
This heartbeat attempted to run the standard QA gates (changed-file read, `tsc --noEmit`, `vitest --run`) but hit **tooling/repo layout blockers**.

Primary observations (verified via tools in this session):
- `/app` is **not** a git repo, but `/app/agents` **is** a git repo.
- The most recent commit in `/app/agents` is **af4ce44c4** and it only touches heartbeat/context/log files (no product code).
- TypeScript and Vitest CLIs are **not installed in a normal `node_modules/.bin` layout** in this environment; `./node_modules/.bin/tsc` is missing.
- A Vite cache directory exists at `/app/node_modules/.vite/vitest/.../results.json`, but it is **not an executable Vitest runner**, so `node node_modules/.vite/vitest --run` fails.

## Mandatory QA steps status (blocked)
1) Read at least one changed file: **DONE**
   - Read `agents/qa/workspace/heartbeat-context.md` (auto-generated heartbeat context).

2) `./node_modules/.bin/tsc --noEmit`: **BLOCKED**
   - Command fails: `./node_modules/.bin/tsc: No such file or directory`.

3) `./node_modules/.bin/vitest --run`: **BLOCKED**
   - No `./node_modules/.bin/vitest` present; Vite cache exists but not runnable.

## Changed files (from `git show --name-only -1` in /app/agents)
- `qa/ERROR_LOG.jsonl` — updated (contains evaluator critiques / error patterns)
- `qa/workspace/heartbeat-context.md` — updated (auto-generated)
- plus other agents’ heartbeat-context files and coach/evaluator last-session docs

No code-quality review of application source (`src/**`) was possible because no source changes were present in the latest commit.

## Findings / risks
### IMPORTANT — Tooling prevents standard QA verification
- Lack of executable `tsc`/`vitest` in expected location means the mandated gates cannot be executed as specified.
- This will continue to cause QA heartbeat sessions to be unable to produce PASS/FAIL evidence for actual code changes.

### MINOR — Repo-root confusion risk
- Running git commands at `/app` fails; reviewers must `cd /app/agents` for git-based review.

## Recommended follow-ups
1) Provide/restore a runnable TypeScript and Vitest entrypoint in this environment (e.g., add `typescript` + `vitest` to `agents/package.json` or document the correct invocation path).
2) Clarify which repo is the target of QA gates (root `/app` vs `/app/agents`).
3) If tests are intentionally not runnable here, define an accepted alternative evidence gate for heartbeats.
