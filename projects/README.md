# Projects

`/app/projects` contains several kinds of folders. Do not infer one execution
model from the directory name alone; classify by markers.

## Classification Rules

- `*.app/` with `app.ts` and `project.json` is a **May-agent project app**.
  It is a control plane: events, handlers, schedules, task tree, project UI,
  and app-local runtime state.
- A sibling folder without `project.md` but with domain assets is a
  **domain workspace**. It should be portable and useful without May-agent.
- A folder with `project.md` is a **legacy project workspace**. Its status and
  type come from front matter.
- A standalone portable project without an Agent App sibling must be listed
  explicitly in this index; it remains useful through its own CLI/library
  boundary.
- Physical cleanup archives live outside `/app`, conventionally under
  `~/workspace-archive/`; curated project history stays with its owner.
- Folders with no project markers are **ambiguous/stale** until adopted or
  removed.

Stable links matter, so classification does not automatically imply moving a
folder. Move only when the owner explicitly decides that link breakage is worth
the cleanup.

## Top-Level Policy

The top level is intentionally small:

- active project apps
- domain workspaces required by those apps
- explicitly listed standalone projects

Legacy `project.md` workspaces should live in the external archive unless
explicitly restored for migration or review.

## Current Active Project Apps

- `alex.app/` - system improvement, maintenance, independent evaluation, comparison,
  and the shared system design manual.
- `may.app/` - May's human conversation and routing App.
- `scout-knowledge-lib.app/` - May-agent app that drives Scout's knowledge
  library project.

## Domain Workspaces

- `may-agent/` - May-agent platform/runtime code workspace. This is a separate
  git repo and should remain usable without the project app.
- `scout-knowledge-lib/` - portable Scout knowledge library workspace with
  knowledge notes, reports, and design material.

## Standalone Projects

- `gym/` - portable agent evaluation project containing scenarios, fixtures,
  benchmarks, scorers, reports, and human review records. It remains runnable
  without Alex; Alex supplies an optional comparison workflow without becoming
  a dependency of the project.
- `herdr-supervisor/` - standalone Herdr supervisor project and Git repository.
- `aks-rp-e2e-app/` - standalone AKS RP E2E App project and Git repository.

## Local compatibility data

- `platform/` is a runtime compatibility path containing the current UI link,
  owned by Host deployment and ignored by the workspace repository.

Temporary clones and worktrees belong outside `/app`, for example under
`~/workspace-worktrees/`. The shared checkout remains on `main`.

## Legacy Project Workspaces

These folders were old `project.md`-based project workspaces. They are not v3
apps and were moved out of the active project list. Historical layout material
is under:

```text
<external-archive>/legacy-project-layout-20260819/
```

Their current state should be read from front matter before use.

Waiting or paused legacy folders archived in this batch:

- `evaluator-aftermath-duplicate-review-loop/`
- `ruflo-learning-loop/`
- `scout-second-brain-learning/`

Done or closed milestone/archive folders archived in this batch:

- `agent-convention-compliance/`
- `agent-memory-learning/`
- `agent-system-evolution/`
- `agent-system-literacy/`
- `closed-loop-reliability/`
- `coach-quality/`
- `cross-agent-collaboration/`
- `daily-alert-review/`
- `documentation-gen/`
- `empty-assistant-stop-runtime-retry/`
- `eval-llm-lane-restoration/`
- `evaluation-revival/`
- `evaluator-aftermath-null-trigger-loop/`
- `evaluator-aftermath-p114-drift/`
- `evaluator-aftermath-routing-drift/`
- `evaluator-good-repair-contradiction/`
- `evaluator-low-quality-rate-calibration/`
- `evaluator-receipt-coverage/`
- `evaluator-session-aftermath-scan-timeouts/`
- `finish-blocked-hygiene-reduction/`
- `gym-quality-improvement/`
- `handler-reliability/`
- `hao-alignment/`
- `heartbeat-efficiency/`
- `master-worker-context-sharing/`
- `prompt-efficiency/`
- `proof-of-life-dashboard/`
- `request-deduplication/`
- `retry-budget-integration/`
- `retry-removal/`
- `skill-workflow-audit/`
- `system-efficiency/`
- `system-operations/`
- `test-coverage/`
- `v2-conformance-and-visibility/`
- `v2-spec-coverage-buildout/`
- `workflow-reliability/`

## Physical Archive

- The external archive contains verified recovery bundles and historical material.
  Keep it read-only unless intentionally restoring context.

## Suggested Cleanup Path

1. Keep active v3 apps and domain workspaces at top level.
2. Keep system-improvement capabilities and useful knowledge in `alex.app/`,
   and `may-agent/` as the separately managed Host source repository.
3. Keep legacy folders in the external archive unless intentionally restoring one
   for migration or review.
4. Keep ambiguous local scratch out of the top-level project list.
