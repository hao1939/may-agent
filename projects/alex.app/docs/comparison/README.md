# Candidate comparison within Alex

**Supports:** [Evidence-backed improvement](../2a-design/practice-learning-loop.md).
Compare a concrete candidate against a pinned baseline when that evidence helps
decide whether a change is worthwhile. **Choice basis:**
[Simple first](../1-principles/core-principles.md#simple-first).
Reuse the standalone Gym runner through one focused App-local workflow.

Alex can select the `gym` specialist and `compare-candidate` workflow, or
admit its structured comparison input. The workflow verifies frozen source,
benchmark, scorer, model, objective and allowance identities before execution.
It returns a bounded receipt with invalid or inconclusive trials disclosed.
A comparison does not approve or apply the candidate.

The [frozen comparison contract](frozen-comparison-service.md) and
[evidence reliability guide](evidence-reliability.md) explain the method.
Their earlier trial records retain the old Gym App names as provenance. The
current implementation is under `alex.app/agents/gym/workflows/`; the standalone
`projects/gym/` package remains available independently.

Run the workflow regression with `bun run gym:app:check`. Retained comparison
evidence and historical experiments remain reachable through
[retirement and preservation](../../archive/retired-apps/README.md).

The [standalone improvement trial plan](standalone-improvement-plan.md) describes
manual experiments alongside Alex's Host work, from reproducible stage execution
through one trustworthy cycle and later Host-driven execution.

Use the [manual stage runner guide](standalone-stage.md) for executable inputs,
fixture/live mode, observation and result interpretation.
The [first standalone trial](standalone-first-trial-20261116.md) records exercised
behavior, corrections, cost limits and the prepared next experiment.
The [snapshot execution trial](standalone-snapshot-trial-20261116.md) follows that
experiment through implementation, failed controls, repair and Alex's disposition.
The [recovery and no-change trial](standalone-recovery-trial-20261116.md) records
manual checkpoint reuse, interrupted work preservation and non-actionable decisions.
The [Host handover readiness rehearsal](host-handover-rehearsal-20261116.md) records
an accepted read-only Alex Task, separate restart checks and the remaining activation gap.
The [definition activation and hosted diagnosis trial](host-diagnosis-trial-20261116.md)
closes that activation gap and records an accepted owner no-change decision on real retained evidence.
The [diagnosis grounding trial](diagnosis-grounding-trial-20261116.md) repairs
unsupported specialist recommendations, compares retained and synthetic inputs,
and records Alex's source-adoption decision with mixed cost and explicit limits.
The [Alex-owned activation and fresh replay](alex-owned-activation-replay-20261116.md)
verifies the later source-root repair in hosted execution and records remaining
binding, evidence-retention, cost-scope and publication follow-through gaps.
The [cycle evidence handoff trial](cycle-evidence-handoff-trial-20261116.md)
keeps the cycle itself as the target and verifies a durable record after closure,
including an independently rejected first version and Alex's corrected revision.
The [deterministic evidence implementation trial](deterministic-cycle-evidence-trial-20261116.md)
delivers a reusable generator/validator through Alex-owned review, integration,
hosted execution and automatic post-dependency continuation, with operator
corrections and full model estimates disclosed.
The [normal development path trial](normal-development-path-trial-20261116.md)
verifies a bounded repair through integration, activation and a fresh normal
workflow, with zero operator correction messages and explicit status/retention
limits. Alex also hands off available Task estimates with its live tail marked.
The [representative Gym reporting delivery](gym-reporting-delivery-trial-20261116.md)
produces a tested, reviewed candidate and retained report replays, with integration
deferred to preserve concurrent migration edits. It also exposes seven internal
rounds across three workflow calls, narrowing the earlier round-accounting claim.
The [cumulative review-round repair](alex-review-rounds-repair-20261116.md)
reserves rounds before work across live reentry and command changes. Its
deterministic regressions preserve unfinished acceptance and exact verification.
The subsequent [hosted cumulative-round trial](alex-review-rounds-hosted-20261116.md)
records exact-source integration and activation, cumulative usage of 1/2/3/3,
and Alex's automatic follow-through and closure. It retains a separate check-name
reporting defect and leaves the existing daily system-wide review as the next
operational checkpoint.
The [standing-review incident handoff repair](alex-incident-handoff-repair-20261116.md)
guards development against the broad recurring Task and prepares existing ignored
Apps dependencies before spending a round. Deterministic tests cover both gaps;
the candidate remains local and the exhausted reporting incident is unchanged.
