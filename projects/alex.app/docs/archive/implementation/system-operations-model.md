# System Operations Convergence

**Historical context:** [Host Runtime](../../2a-design/runtime.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


**Status:** Completed.
**Design authority:** [Work model](../../1-principles/work-model.md),
[Metrics](../../2a-design/metrics.md), [Events](../../2a-design/events.md), and
[Agent App Contract](../../2a-design/agent-app.md).

## Result

Platform operations belong to `may-agent.app`; domain operations belong to
their domain apps. May owns the immediate conversation and no standing
background schedules.

```text
infrastructure observes, persists, routes, and recovers
  -> owning app judges meaning and reconciles durable work
  -> May reviews the result and closes the human conversation
```

Current ownership:

| Responsibility | Owner |
| --- | --- |
| Runtime session cleanup and bounded recovery | `may-agent.app/session-recovery` |
| Canonical escalation delivery | `may-agent.app/escalation` |
| Platform health measurement | `may-agent.app/metrics-snapshot` |
| Metric judgment and follow-through | The metric's owning app |
| Reviewed May-session learning intake | `gym.app` |
| Evaluator feedback projection | `evaluation.app` |

The global metric reactor and file-based coaching queue were removed. Metric
events now enter the owning app directly; its regular owner review is the
Kubernetes-style recovery path. This avoids a second scheduler that calls app
agents from outside their ownership boundary.

Evaluation feedback is event-driven. `evaluation.recorded` and
`evaluation.deep_recorded` facts resolve one stable maintain task per agent;
that task projects the latest fact under
`evaluation.app/generated/agent-feedback/`. There is no hourly SQL scan and no
cross-App mutation of agent source directories.

## Proof

The migration retained or added focused tests for escalation delivery, session
recovery, metric ownership, app metric routing, Gym evaluation intake, and
evaluation feedback projection. Each old May schedule was removed only after
its replacement or obsolescence was established.

## Ongoing review

Regular design-versus-implementation review should continue to check that:

- no May-owned schedule or background queue returns;
- every operational signal has one app owner and a terminal disposition;
- app schedules do not duplicate auto-generated heartbeats; and
- mechanical observers remain separate from owner judgment.
