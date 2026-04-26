# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Context
Heartbeat run with no explicit pending review tasks. I performed basic repo hygiene checks and attempted the mandatory QA compile/test commands.

## Findings
### 1) Repo root is not a git repository (IMPORTANT)
- Evidence: running `git log --oneline -10` from `/app` fails with `fatal: not a git repository`.
- I was able to access git history in `/app/agents`.

**Impact:** QA cannot reliably scan “recent commits” for the main project from root; only the `agents/` subrepo has git metadata.

### 2) TypeScript project configuration missing at repo root (IMPORTANT)
- Evidence: `./node_modules/.bin/tsc --noEmit` prints TypeScript help and exits code 1, consistent with no `tsconfig.json` present in `/app`.

**Impact:** Mandatory `tsc --noEmit` check cannot be executed meaningfully without a tsconfig or explicit `-p`.

### 3) Vitest binary missing (IMPORTANT)
- Evidence: `./node_modules/.bin/vitest --run` fails: `No such file or directory`.

**Impact:** Mandatory `vitest --run` cannot be executed. Likely vitest is not installed or dependencies are incomplete.

## Next suggested actions
- Confirm whether `/app` is expected to be a git repo; if yes, restore `.git` or adjust QA heartbeat instructions to use the correct repo path.
- If TypeScript/Vitest checks should be run for a specific package/workspace, provide the correct working directory and config paths (e.g., `cd <pkg> && tsc -p tsconfig.json`).
- If vitest is required, add it to dependencies and ensure it is installed in the correct workspace.
