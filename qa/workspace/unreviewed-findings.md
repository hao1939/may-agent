# Unreviewed findings (heartbeat)

Date: 2026-04-21

## Context
- Repo root is `/app/agents` (git repo). `/app` is not a git repo.
- Recent changes are predominantly documentation and workflow edits across multiple agent workspaces.

## Mandatory QA checks attempted
- `./node_modules/.bin/tsc --noEmit` (from `/app/agents`) **FAILED**: `No such file or directory`.
- `./node_modules/.bin/vitest --run` (from `/app/agents`) **FAILED**: `No such file or directory`.

These failures appear **environmental/pre-existing**: the repo does not include a standard Node toolchain layout (`package.json` not found anywhere under `/app`/`/app/agents`, and `agents/node_modules` contains only `.vite/`).

## File read (evidence)
- Read `agents/shared/workflows/project.ts` (lines 1-220). Observations:
  - Adds/maintains parsing logic for legacy `.md` single-file project format vs new directory format (`project.md` + `journal.md`).
  - Uses regex-based field parsing and helpers for extracting/updating sections.

## Potential concerns to review (not yet fully verified)
- `agents/shared/workflows/project.ts` is a large file; only first 220 lines were read. The remaining logic (iteration loop, state updates, file writes) was not reviewed in this heartbeat.
- Multiple agent `workspace/heartbeat-context.md` and project journals are modified; these are likely operational state changes but should be sanity-checked for accidental content loss.

## Next steps
1. Determine correct way to run typecheck/tests in this repo (may use `may-agent-bin`, `bun`, `deno`, or a custom runner). Document it in QA knowledge.
2. Continue reading the rest of `agents/shared/workflows/project.ts` to assess correctness of workflow loop and file I/O safety.
