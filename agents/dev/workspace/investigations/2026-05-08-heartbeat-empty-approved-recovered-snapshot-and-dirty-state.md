# Heartbeat: empty Approved queue, recovered snapshot handler, dirty-state risk

## Context

Dev heartbeat on 2026-05-08 found no Approved work-queue items and no dev-owned unresolved metric alerts. The live heartbeat prompt said no active alerts; direct DB inspection showed three unresolved alerts, all owned by other agents (`scout` or `evaluator`).

## Signals checked

- `agents/shared/work-queue.md` has an empty `## Approved` section.
- Recent `handler.failed` events include two `metrics-snapshot` import failures:
  - `Export named 'validateProjectFormat' not found in module '/app/agents/shared/lib/project-health.ts'.`
- Current metric rows show handler health recovered:
  - `handler.failed-count = 2`, below threshold `10`.
  - `handler.success-rate = 0.9954`, above threshold `0.8`.
- Recent metrics-snapshot events are now `handler.completed`; latest checked row was a completion with duration ~11.7s.
- `metrics` has no active metric lacking a snapshot in the last hour.
- Recent session errors have `error = NULL` and `opCount = 0`, so they do not expose a concrete stack/error string from the sessions table alone.

## Judgment

No code fix is warranted this heartbeat: the `metrics-snapshot` import failure appears recovered in the current code/runtime, and the file currently exports/imports `validateProjectFormat` consistently. The highest-confidence actionable finding is repository hygiene: the repo already contains unrelated dirty runtime files and one shared-project edit not produced by this heartbeat.

## Dirty-state classification

`git status --short` initially showed pre-existing modifications to:

- `arc/last-session.md`, `evaluator/last-session.md`, `may/last-session.md`, `scout/last-session.md`: generated last-session runtime files.
- `heartbeat-log.md`: generated/operational heartbeat log.
- `shared/projects/ruflo-learning-loop/project.md`: a transient source/project-file edit with a one-line body-level `**Status**: active` addition despite YAML frontmatter already carrying `status: active`.

A later status check showed only the generated runtime files still dirty; the transient `ruflo-learning-loop` diff had cleared before dev committed this artifact. Per heartbeat guidance, generated `last-session.md` and shared log churn are not staged by dev unless they are the explicit deliverable.

## Follow-up

If the `ruflo-learning-loop` duplicate body-status edit reappears, its owner should normalize `shared/projects/ruflo-learning-loop/project.md` to canonical frontmatter-only status metadata or explicitly commit it with rationale. Dev should continue to avoid committing generated `last-session.md` and shared log churn unless they are the explicit deliverable.
