# Iteration 1 Addendum: Orchestrator and Goal-Driver Finish Hygiene Patch

## Why this addendum exists

The first iteration patch covered the dominant heartbeat, closed-loop steward, metric-alert triage, and project-worker prompt paths. A fresh 24h source attribution after that work still showed two unpatched lower-volume but concrete buckets:

| Source | Agent | Count |
| --- | --- | ---: |
| workflow:orchestrator | may | 18 |
| workflow:goal-driver | scout | 5 |

Together these accounted for 23 additional finish/uncommitted evaluations in the current 24h window.

## Concrete patches in this addendum

### `agents/shared/workflows/master-worker.ts`

`workflow:orchestrator` maps to the master-worker workflow's orchestrator session. I added finish-hygiene instructions in two places:

1. A reusable `FINISH_HYGIENE_INSTRUCTIONS` block requiring read-back, explicit git status classification, explicit-path staging only, no opportunistic unrelated commits, post-commit clean-status recheck, and finish evidence with commit id.
2. Orchestrator-specific guidance for the project-maintainer prompt: if the orchestrator edits `project.md`, it must read back `project.md`, inspect and classify `git status --short`, stage only the `project.md` path explicitly, commit it, re-run status, and avoid committing unrelated dirty files.
3. The worker completion prompt now appends the reusable hygiene block after the existing verify-after-edit warning, so worker sub-sessions receive the same closeout sequence before successful finish.

### `agents/shared/workflows/goal-driver.ts`

`workflow:goal-driver` worker prompts now include a mandatory finish-hygiene section. The previous prompt only said to commit intentional changes before finishing; the new section gives the exact safe sequence and explicitly tells workers to finish partial/blocked rather than committing unrelated dirty agent/runtime files.

## Coverage update

The combined first-iteration prompt coverage now targets the measured high-volume buckets from the latest query:

- `workflow:scout-heartbeat` — 56
- `closed-loop-steward` — 40
- `workflow:may-heartbeat` — 33
- `workflow:metric-alert-triage` — 28 combined May/Scout
- `workflow:dev-heartbeat` — 22
- `workflow:project` — 25 combined May/Arc/Scout
- `workflow:orchestrator` — 18
- `workflow:arc-heartbeat` — 5
- `workflow:goal-driver` — 5

That covers 232 of the 236 measured 24h finish/uncommitted evaluations by direct source-path prompt changes, leaving only very low-volume socket/null/worker residuals for a later iteration.

## Validation performed

- Read-back verified the modified `master-worker.ts` sections containing the reusable finish-hygiene block, orchestrator `project.md` closeout instruction, and worker prompt injection.
- Read-back verified the modified `goal-driver.ts` worker prompt finish-hygiene block.
- A TypeScript syntax check should be run from `/app/agents` before commit: `bunx tsc --noEmit --skipLibCheck --allowImportingTsExtensions --moduleResolution bundler --module esnext --target es2022 --types node shared/workflows/master-worker.ts shared/workflows/goal-driver.ts`.
