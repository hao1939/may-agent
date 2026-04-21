# Unreviewed findings (QA heartbeat)

Date: 2026-04-21

## Environment checks

- Attempted to run `./node_modules/.bin/tsc --noEmit` from `agents/` per QA SOP.
  - Result: **FAIL** — `./node_modules/.bin/tsc: No such file or directory`.
  - Likely cause: dependencies not installed in `agents/` workspace (no `node_modules`).

- Attempted to run `./node_modules/.bin/vitest --run` from `agents/` per QA SOP.
  - Result: **FAIL** — `./node_modules/.bin/vitest: No such file or directory`.
  - Likely cause: dependencies not installed in `agents/` workspace.

## Recent change sampled

- Commit `3c7fa364b` (qa: update heartbeat context)
  - File: `qa/workspace/heartbeat-context.md`
  - Change appears to be an auto-generated context/status note (no executable code).

## Findings

- **IMPORTANT:** QA required checks (tsc/vitest) cannot be executed in this environment because `node_modules` is missing in the `agents` repo. If this is expected, QA SOP/tooling should be updated to run via package manager (e.g., `pnpm -C agents test`) or to install deps in CI/runner.
