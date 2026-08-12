# Scout Explore Attention Frontier Review — 2026-08-06

## Trigger

Evaluation project-health review `20260806T144030418Z` kept
`scout-knowledge-lib.app` at **watch** with one bounded concern: outputs and
metrics are healthy, but `explore-arxiv` and `explore-github` remain P1
attention items with no active/runnable frontier, and recent blocked
`scout-explore` runs ended with empty local recovery results.

## Primary Evidence Checked

- `/app/projects/scout-knowledge-lib.app/.state/tasks/tree.json`
- `/app/projects/evaluation.app/reports/project-health/scout-knowledge-lib.app/20260806T144030418Z.md`
- `/app/projects/scout-knowledge-lib/README.md`
- `/app/projects/scout-knowledge-lib/knowledge/README.md`
- `/app/projects/scout-knowledge-lib/knowledge/INDEX.md`

## Current Project State

| Artifact | Observation |
|---|---|
| `project.json` | Project goal is active and unchanged: maintain source-grounded research plus library quality. |
| `tree.json` | `active_task_ids` now contains `repair-scout-explore-attention-frontier`; the prior "no runnable frontier" gap has been narrowed to one still-unlinked repair path. |
| `repair-scout-explore-attention-frontier` | `phase=running`, `generation=1`, `observed_generation=0`, output: this report. |
| `explore-arxiv` | `phase=attention`, `generation=12`, summary: `Scout exploration session failed`, evidence: `workflow-run:wr_1786018113220_8qqx`. |
| `explore-github` | `phase=attention`, `generation=41`, summary: `Scout exploration removed primary sources from an existing output`, evidence: `workflow-run:wr_1786024531992_tymv`. |
| workflow contract | `scout-explore.ts` still emits blocked outcomes such as `Scout exploration session failed` and `Scout exploration removed primary sources from an existing output`; the repair task still needs a local-recovery linkage step so future blocked runs cite a durable task/report reference instead of remaining isolated run evidence. |
| evaluator review | Confirms healthy metrics but calls for explicit linkage or closure for the two attention items and non-empty local recovery on future blocked runs. |
| library navigation | `knowledge/README.md` and `knowledge/INDEX.md` already exist, so this trigger did not justify a navigation edit. |

## Smallest Useful Maintenance Step

Corrected this operations report to match the now-verified task tree, then
reduced the remaining repair scope to the smallest owner action still missing:
explicitly link the two attention items to the running repair task and keep the
blocked-run contract gap visible until a bounded follow-up changes workflow
behavior.

## Current Remediation Frontier

The remediation task now exists, so the next useful change is narrower than the
original recommendation.

- **Already created:** `repair-scout-explore-attention-frontier`
- **Immediate task-tree linkage still missing:**
  - `explore-arxiv` should depend on `repair-scout-explore-attention-frontier`
  - `explore-github` should depend on `repair-scout-explore-attention-frontier`
- **Remaining bounded gap after linkage:** blocked `scout-explore` runs still
  need a workflow-level recovery reference contract so future blocked results
  point to a task/report/retry decision instead of only a raw workflow run id.
- **Best next bounded follow-up:** one child task under
  `repair-scout-explore-attention-frontier` to patch or verify the blocked-run
  recovery-reference behavior.

## Exact No-op Boundaries

- No knowledge note was added: the trigger was about task frontier hygiene, not
  a new source-grounded research signal.
- No knowledge landing-page change was needed: `knowledge/README.md` already
  serves the human-facing role and `knowledge/INDEX.md` remains navigable.
- No task tree was edited directly: Scout records the recommended change here
  and returns any task mutation only through typed workflow actions.
