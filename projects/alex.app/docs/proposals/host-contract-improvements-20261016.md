# Host follow-up: remaining adoption and performance questions

**Supports:** [Keep the Host boring and let Apps change](host-stability-and-app-extensibility-20261005.md).
**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first)
and [Host mechanics / App meaning](../2a-design/system-boundary.md).

**Status — 2026-11-12:** The October review, implementation sequence and trial
details are preserved in the
[dated Host-contract record](../archive/reviews/host-contract-improvements-20261016.md).
The [proposal status review](../archive/reviews/design-and-proposal-status-review-20261111.md)
identifies the listed source repairs as merged. Neither that history nor this
consolidation identifies today's installation or establishes improved outcomes.

This page keeps independent adoption/performance questions discoverable.
The [recovery proposal](unified-agent-recovery-20261017.md) alone owns the
connected failure → capable help → exact return → original-outcome trial.
Its unresolved boundaries should not generate parallel recovery plans here.

## Query cost and control responsiveness

**Owners:** Apps own query meaning and mitigation; Host owns bounded execution
and responsive controls. Current contracts are
[Metrics](../2a-design/metrics.md), [Storage](../2a-design/storage.md) and
[Runtime](../2a-design/runtime.md).

The [October 17 query-cost trial](../archive/reviews/metric-query-cost-20261017.md)
established passive cost collection, an App-owned investigation rule and dated
activation. It also retained slow natural executions and an unfinished
investigation. The [earlier responsiveness record](../archive/reviews/responsive-host-recovery-20261002.md)
preserves control latency, query-plan and rollout evidence. These records do not
establish present performance or a completed mitigation.

The remaining useful question is whether a representative current slow query
or recovery pass blocks acknowledgement, reads or cancellation, and whether its
owner follows the retained finding to a verified outcome. Measure the actual
expensive path and compare like workloads; a row limit does not bound total
query work, and lower Host counters after moving work do not prove lower cost.

Retain the current direct-SQL choice unless current evidence justifies changing
it. If isolation is selected, keep App declarations unchanged, bound the whole
operation and demonstrate actual cancellation, worker failure and the next
scheduled sample. A JavaScript timer cannot interrupt synchronous SQL. The
[metric operator guide](../2b-manual/metric-alerts.md#investigating-query-cost)
owns the practical investigation procedure.

## App result admission and owner follow-through

**Owners:** Each App owns its contribution schema, admission and disposition;
Host owns generic execution/feedback. The
[common contribution contract](../2a-design/execution-contributions.md#common-contract-for-code-and-agents)
remains authoritative.

The [judgment rollout](../archive/reviews/judgment-contract-20261017.md) and
[report-validation trial](../archive/reviews/agent-judgment-and-code-paths-20261016.md#october-17-report-validation)
retain the implemented examples. The earlier
[ordered gap review](../archive/reviews/host-contract-improvements-20261016.md#remaining-gaps-and-fix-order)
is historical, not a new backlog of unimplemented validators.

For a concrete remaining consumer, check both code and the actual model-tool
path against the App's declared acceptance. Preserve valid partial work and
make correctable errors usable before exit. A shared reader alone does not
prove tool-validator parity. Verify that accepted findings are consumed and
lead to the owner's useful next action; a valid report alone is insufficient.

If setup, admission or late rejection leaves the owner unable to act, use the
single recovery scenario rather than adding a second recovery strategy here.
Broader adoption and measured correction cost remain App-specific evidence.

## Private recovery paths and narrower historical concerns

Backend-specific ownership/cleanup checks remain at the adapter. The
[merged #376 trial](../archive/reviews/host-recovery-evidence-20261017.md)
establishes its covered boundaries, not every live backend's behavior.
Any reproduced private-adapter gap belongs to that adapter; its connected
delivery and return acceptance belongs to the recovery proposal.

The older [backup-restore finding](../archive/reviews/database-recovery-20261017.md)
must remain inspectable. Before treating its then-open #379 as work, refresh
source against the [current storage contract](../2a-design/storage.md#opening-a-database-is-not-permission-to-roll-work-back)
and recheck the defect. Archiving the review does not establish a fix or live
data loss. Existing narrow model-fallback behavior likewise does not justify a
general model router without a concrete capability/cost need.

Select one demonstrated gap, fix its owner and verify the affected path plus
a relevant contrast. Preserve exact source/installation evidence and update its
owning contract when behavior changes. There is no new omnibus Host project
or requirement to rerun every historical trial.
