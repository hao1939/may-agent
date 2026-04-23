# QA Heartbeat Findings (2026-04-23)

## Context
Attempted to execute the mandatory verification checks (`./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest --run`) per QA SOUL. This environment does not provide those binaries under either `/app` or `/app/agents`.

## Evidence
- `/app` is **not** a git repo (`git log` fails), while `/app/agents` **is** the git repo.
- `tsc` binary is missing:
  - At `/app`: `./node_modules/.bin/tsc --noEmit` → `No such file or directory`.
  - At `/app/agents`: `./node_modules/.bin/tsc --noEmit` → `No such file or directory`.
  - `agents/node_modules` contains only `.vite` directories (no `.bin`).
- `vitest` binary is missing:
  - At `/app/agents`: `./node_modules/.bin/vitest --run` → `No such file or directory`.

## Most recent change reviewed (content-level)
Read `agents/src/lib/finish-guard.ts` (FM-3.1/FM-3.3 tool-level enforcement): logic looks coherent; key behaviors:
- deliverables existence enforced for status != failure/blocked.
- verification evidence enforced for `status === "success"` with deliverables.
- warns (does not fail) on short evidence or “ghost keyword” patterns.

## Issues
### IMPORTANT — Verification tooling unavailable
QA cannot run the mandatory checks in this runtime because `tsc` and `vitest` are absent. This makes it impossible to independently verify recent code changes with the required commands.

### MINOR — Potential over-enforcement ambiguity
`validateFinishDeliverables()` enforces deliverables for `partial` as well as `success` (comment says “Only enforced for success and partial statuses”). This might be intended, but it is a policy choice that could block legitimate partial reports where a deliverable path is not yet created. Worth confirming against intended semantics.

## Suggested next step
Decide what the canonical verification command(s) are in this repo (likely `bun test` and a bun/ts check, or a different build pipeline), then update QA SOUL/guards accordingly or vendor the missing toolchain.
