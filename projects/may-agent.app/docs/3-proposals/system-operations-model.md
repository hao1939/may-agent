# System Operations Convergence Tracker

**Status:** Active tracker.
**Design authority:** [Architecture](../2a-design/architecture.md),
[Metrics](../2a-design/metrics.md), [Events](../2a-design/events.md), and
[Agent App Contract](../2a-design/agent-app.md).

## Goal

Keep platform operational health under `may-agent.app` ownership while shared
infrastructure remains mechanical:

```text
infrastructure observes, persists, routes, and recovers
  -> may-agent.app owner judges platform meaning
  -> finite repair work uses the normal task controller
```

This tracker does not introduce a system-ops app, controller, task type, or
parallel health lifecycle.

## Current runtime

The current global May handler set is intentionally small:

| Handler                | Responsibility                                                |
| ---------------------- | ------------------------------------------------------------- |
| `metric-alert-reactor` | Deduplicate and route metric breaches                         |
| `session-recovery`     | React to failed/interrupted sessions and stale immediate work |
| `escalation`           | Route explicit cross-owner requests                           |
| `metrics-snapshot`     | Measure and persist runtime health                            |
| `coaching-consumer`    | Consume bounded evaluation/coaching signals                   |
| `feedback-echo-sync`   | Project evaluator feedback into agent-facing context          |

Project steward, creative-audit, closed-loop-steward, daily-alert-review, and
eval-llm-scan control paths are retired. Project-specific schedules, watchers,
event correlation, task state, and judgment live in their owning apps.

`may-agent.app` owns platform review, operations health review, and the daily
operations digest through tech-lead-owned workflows and app schedules.

## Remaining convergence

### 1. Coaching ownership

Decide whether `coaching-consumer` remains a mechanical global observation or
moves completely under Evaluation/Coach app ownership. Migration requires one
accountable owner, no duplicate route, replay coverage, and removal of the old
handler only after replacement proof.

### 2. Feedback projection ownership

Decide whether `feedback-echo-sync` remains shared mechanical projection or
moves under Evaluation. Preserve agent-context delivery and idempotency without
creating a second evaluation lifecycle.

### 3. Operational evidence hygiene

Keep volatile incidents, metric snapshots, and migration measurements in dated
evidence. Stable design documents contain only current ownership and runtime
contracts.

## Migration gate

Before retiring either remaining handler, prove:

1. the replacement signal and accountable owner;
2. the exact event/task path that closes the loop;
3. one replay or regression test for the original failure class;
4. no duplicate live route after reload/restart; and
5. current metrics and human readouts remain truthful.

## Completion

This tracker is complete when both remaining handlers have an explicit retained
or migrated disposition, tests prove the selected paths, and the current
handler inventory is documented only in runtime configuration and audit tools.
