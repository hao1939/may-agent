# Unhandled signal metric classification — 2026-08-26

## Baseline

At the start of this repair, `event.unhandled-signal-count-1h` reported **1000** against threshold **5**. A grouped read of the rolling hour found the following unhandled event types.

| Event type | Count | Disposition |
| --- | ---: | --- |
| `project.task.reconcile.profiled` | 310 | Intentional profiling observation. It records timing after an App Task attempt and has no semantic delivery consumer. |
| `project.task.reconcile.started` | 281 | Intentional Task lifecycle observation. Runtime reconciliation already owns the attempt; no second event consumer is required. |
| `project.task.reconciled` | 275 | Intentional Task lifecycle/audit observation. The Task result is applied by the reconciler, not delivered through this fact. |
| `project.task.executor.progress` | 53 | Intentional progress observation. It updates attempt visibility and is not a domain request. |
| `project.task.reconcile.skipped` | 35 | Intentional reconciliation disposition/audit fact. Retry, attention, and child state remain owned by the reconciler. |
| `metric.breach` | 58 | Intentional observation-only metric fact unless an App explicitly subscribes. The metric manual says no route means retain it for observation, not an unhandled-delivery defect. |
| `conversation.updated` | 13 | Intentional App-inbox change observation. The conversation store is already updated; the fact is not another conversation request. |
| `gym.review.filtered` | 4 | Intentional terminal Gym review/audit fact; its durable review decision is already written. |
| `project.approval.resolved` | 4 | Intentional terminal approval/audit fact emitted with the Gym review disposition. |
| `project.ops_digest.created` | 2 | Intentional report-created observation; the report path is the artifact. |
| `project.ops_health.observed` | 1 | Intentional Host Operations health observation; the packet is the artifact. |
| `message.created` | 2 | **Unexpected and counted.** These were addressed to `human:operator`; the intended consumer is the human-message transport, but no consumer accepted them before timeout. This is an explicit missing-consumer disposition, not lifecycle noise. |

## Canonical calibration

Runtime source measurement now owns the metric definition in `src/app/metric-source-measurement.ts`. Its rolling-hour query excludes only the declared observation-only types above and preserves `message.created` and every unknown future event type as counted signals. Runtime startup repairs a stale historical `source_query` without overwriting live owner, threshold, priority, or alert configuration.

## Verification

Against the classified baseline corpus, the calibrated query returned **2**, both `message.created` rows with an intended human transport consumer and an explicit missing-consumer disposition. A fresh runtime read at verification time returned **1** because the older row aged out of the rolling hour; the only remaining type was still `message.created`. Any new unclassified unhandled type remains counted by default.

## Post-deploy convergence for routing-receipt false positives

A later residual review found four `handler.routed` rows paired with `session.recovery.requested` events. `handler.routed` records that routing already occurred; it is an observation receipt, not another request requiring a consumer. Commit `43fdb6cc5f9bef1466b1aa7ae650989537592916` therefore added only `handler.routed` to the intentional-observation allowlist, while the regression continued to count unconsumed `message.created` and `session.recovery.requested` events. This is a narrow false-positive correction: unknown and actionable signal types still count by default.

The exact deploy receipt is `/app/projects/may-agent/.state/deploy-receipts/unhandled-signal-calibration-43fdb6cc.json`, correlated as `unhandled-signal-calibration-43fdb6cc` to Host Operations Task `ops/calibrate-unhandled-signal-metric-2026-08-26`. It completed successfully with source commit `43fdb6cc5f9bef1466b1aa7ae650989537592916`, artifact SHA `1d4718f6a5d8a999bfbd2316ece80301b0d10d0b354b603c76611f49d79f720e`, matching `loadedArtifactSha`, healthy status, and `duplicateDeploy: false`. Bundle provenance and the live `/usr/local/bin/may-agent` SHA-256 match that artifact. `may-agent`, `may-agent-web`, and `may-agent-maintenance` were all running, and `/api/readiness` returned `ready: true` during the live check on 2026-08-26.

A fresh supported runtime source-query measurement at `1787762410338` stored snapshot `2141590` with value **2**, measured by `runtime:metric-source-query` and correlated to trigger event `6184442`; the accepted metric state was updated at `1787762412985`. The two residual rows were one `message.created` event addressed to the human transport and one `pipeline-artifact.unavailable` event owned by the AKS RP E2E App. Both had the explicit disposition `no responsible consumer accepted event before timeout`, so both are correctly retained as actionable signals rather than excluded as noise.

The value **2** is below threshold **5**. Threshold alert `4909` (which opened at value 9) has `resolved_at = 1787748315460`, and no later or open alert exists. The platform disposition is **resolved and healthy**: retain the calibrated metric as active, do not downgrade it, do not add an exception, and continue to count the two current actionable residuals.
