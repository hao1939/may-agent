# Alert 287 Heartbeat Nudge Recheck — 2026-05-11

## Goal

Judge the repeated `session.finish-blocked-uncommitted-count-24h` heartbeat alert and May nudge without staging unrelated worktree state.

## Signals

- Active alert: `session.finish-blocked-uncommitted-count-24h` current `58`, threshold `50`, target `0`, priority `P2`, owner `dev`.
- Paired strict metric: `session.finish-blocked-unresolved-count-24h` current `0`, threshold `0`, priority `P1`.
- Open alert row: alert `287` remains unresolved for the raw metric.
- May nudge said the agents worktree has ~30 dirty files and asked dev to triage/commit/clean intentional changes.

## Evidence

Metric rows from heartbeat SQL:

- `session.finish-blocked-uncommitted-count-24h`: `current=58`, `threshold=50`, `target=0`, `alert_op='>'`, `updated_at=1778502661327`.
- `session.finish-blocked-unresolved-count-24h`: `current=0`, `threshold=0`, `target=0`, `alert_op='>'`, `updated_at=1778502661327`.

Recent snapshots hold the raw metric at `58` while the strict metric stays `0` through `measured_at=1778502661327`.

Fresh raw 24h classification query result:

| bucket | count |
| --- | ---: |
| repaired_success | 55 |
| repaired_partial | 1 |
| terminal_no_recovery | 2 |

No row classified as `other_unresolved`.

Top source attribution still shows repaired/terminal friction, not a fresh unresolved dirty-exit source:

| source | count | repaired_success | repaired_partial | terminal_no_recovery | other_unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
| workflow:scout-heartbeat | 17 | 16 | 0 | 1 | 0 |
| workflow:scout-explore | 15 | 15 | 0 | 0 | 0 |
| workflow:closed-loop-steward | 9 | 9 | 0 | 0 | 0 |
| workflow:may-heartbeat | 5 | 5 | 0 | 0 | 0 |
| workflow:arc-heartbeat | 4 | 3 | 1 | 0 | 0 |
| closed-loop-steward | 3 | 2 | 0 | 1 | 0 |

## Dirty Worktree Classification

`cd /app/agents && git status --short` shows many pre-existing dirty paths. I did not stage them because they are unrelated to this heartbeat or appear owned by other agents/projects:

- Runtime/session noise: `.state/iteration-log.json`, `*/last-session.md`.
- Dev context runtime state: `dev/context.md`.
- Other-agent/source docs: `master/AGENTS.md`, `master/tools/**`, `shared/may-agent-docs/**`, `shared/skills/**`.
- Other shared projects: `shared/projects/aks-rp-e2e/**`, `shared/projects/daily-alert-review/**`, `shared/projects/ruflo-learning-loop/project.md`, `shared/projects/v2-spec-coverage-buildout/journal.md`, `shared/projects/master-worker-context-sharing/project.md`.

These paths may be intentional deliverables from other sessions or generated runtime files. Cleaning them from this heartbeat would risk losing unrelated work and would be metric gaming rather than fixing alert 287's measured raw 24h history.

## Pending Event Disposition

- `message.created` P1 May nudge: acted by rechecking the metric, raw/strict classification, and git status; unable to safely commit/clean unrelated paths.
- `handler.workflow_dispatched` and `metric.alert_judged`: acknowledged as prior metric-alert-triage/closed-loop activity; latest judgment remains consistent with fresh evidence.
- `guard.triggered`: real ambient dirty-worktree warning, but not caused by this heartbeat's deliverable; do not stage unrelated files.
- `session.end`: reviewed for recent steward/evaluator context; no new dev-owned code fix surfaced.

## Judgment

Chosen operation: `waiting_with_evidence` / document exception pending safe runtime annotation.

The raw breach is real and should remain visible, but the paired strict unresolved metric is healthy and fresh classification found `0` unresolved dirty exits. A root-cause workflow patch is not indicated from this evidence. Dev also lacks safe authority to resolve/downgrade/annotate the runtime alert directly, and committing or cleaning unrelated dirty paths would be unsafe.

## Next Validation

Validate on the next `metrics-snapshot`. Resume `finish-blocked-hygiene-reduction` immediately if `session.finish-blocked-unresolved-count-24h` breaches or a future raw classification shows any `other_unresolved` rows.
