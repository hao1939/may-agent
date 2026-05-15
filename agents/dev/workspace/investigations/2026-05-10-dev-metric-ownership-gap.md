# Dev Metric Ownership Gap — 2026-05-10 Heartbeat

## Question

Dev's heartbeat prompt says there are no metrics owned by dev, while Dev's role is system debugging and metrics engineering. Does that absence hide a live failure, or is Dev intentionally using shared/system metrics owned by May/Optimizer/Evaluator?

## Evidence

- The approved work queue was empty at heartbeat start, so there was no approved implementation item to pick up.
- Live metric ownership query returned active metric owners only for `may` (39), `evaluator` (12), `scout` (6), and `optimizer` (2); `owner='dev'` returned no active rows.
- Current dev-relevant runtime signals are healthy enough for watch-only: `handler.success-rate=1`, `handler.failed-count=0`, and `session.error-rate-6h=0.038`, with no unresolved dev-owned alert.
- The direct unresolved-alert query showed only `project.iterations-24h`, `scout.good-session-rate-24h`, and `scout.operational-friction-rate-24h`; none are dev-owned.
- `eval-llm-lane-restoration` remains live in pending-review: direct DB validation found latest non-heuristic evaluation at `2026-05-10 13:59:37` UTC and 21 non-heuristic evaluations in the last 24h; metrics report `eval.llm-coverage-lag-h=0.38` and `eval.llm-evals-24h=21`.
- `finish-blocked-hygiene-reduction` remains correctly blocked: the split metrics `session.finish-blocked-uncommitted-count-24h` and `session.finish-blocked-unresolved-count-24h` are still absent from `metrics`, so the existing safe-write blocker remains external.
- The metrics design doc says registry/source of truth is the DB/`metrics-snapshot.ts`, and lists infrastructure metrics such as `handler.success-rate`, `session.error-rate-6h`, and `metric.stale-active-count` as system vital signs. It does not require every agent role to own named metric rows.

## Judgment

This is a visibility/accountability gap, not a runtime outage. Dev is accountable for investigating failures, but the active metric rows that surface those failures are currently owned by May/Optimizer/Evaluator. Because P0 metrics fork owners directly, a future infra-critical breach could route away from Dev even when Dev is the natural debugger. However, changing metric owners is a policy/registry decision and requires a safe write path or approved implementation request; doing it from this heartbeat would be an unsafe/unapproved DB mutation.

## Recommendation

Do **not** create synthetic dev-owned metrics just to satisfy the prompt. Instead, propose/approve a narrow ownership alignment later: either make Dev the owner of one or more failure-investigation vitals (`handler.failed-count`, `session.error-rate-6h`, `metric.stale-active-count`) or keep May as owner but document that May delegates infra-debugging breaches to Dev through the work queue. Until then, Dev heartbeat should continue querying system-level metrics directly and treating non-dev ownership as a routing signal rather than proof that no Dev action is needed.

## Pending Event Disposition

- Artifact-gate/session-start warnings: acted by producing this evidence-bearing investigation artifact.
- Recent session-end recovery notes: dismissed as duplicates after a fresh queue, metric, alert, and project recheck.
- May's blocked-project nudge for `finish-blocked-hygiene-reduction`: acted by revalidating that the required split metrics remain absent; blocker stays with May/human safe runtime DB registration.
- Non-dev unresolved alerts: dismissed for direct Dev action because ownership is May/Scout and no Approved queue item delegates a patch to Dev.
