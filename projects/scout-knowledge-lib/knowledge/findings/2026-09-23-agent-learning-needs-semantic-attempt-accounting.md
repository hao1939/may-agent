<ai_context>
summary: "NEEDLE's attempt ledger shows why adaptive agent systems must classify orchestration outcomes, unknown cost, and evidence scope before feeding execution history into routing or self-improvement."
triggers: ["attempt accounting", "decomposed outcome", "unknown cost", "adaptive routing", "semantic denominator", "NEEDLE", "provisional resolution"]
last_updated: "2026-09-23"
source_basis: "Static inspection of jedarden/NEEDLE revision 2021e7f449b85e4353748a65c504ec919e2629a1, including ADR-024, ADR-030, the attempt-accounting implementation, outcome integration, statistics, evidence routing, and project-authored tests. Tests and historical production counts were not independently reproduced."
</ai_context>

# Agent Learning Needs Semantic Attempt Accounting

**Date:** 2026-09-23  
**Disposition:** New knowledge  
**Question:** What must an agent runtime preserve before execution history is safe to use for routing, competence estimates, cost controls, or self-improvement?

## Finding

[NEEDLE](https://github.com/jedarden/NEEDLE) exposes a subtle feedback-loop problem: a technically valid event can still be the wrong training or routing label. Its maintainers report that an earlier ledger counted a parent task split into children as `verified_success`. In the same historical window, fourth and later attempts consequently appeared far more successful, while 124 of 852 timed-out attempts were recorded at zero cost because killed processes never wrote the final result envelope. These are repository-authored operational counts, not independently reproduced measurements, but the pinned implementation contains concrete repairs for both failure modes.

A split now resolves locally as `decomposed`, neither success nor failure. Statistics remove decompositions from the judged denominator, evidence routing gives them no verified credit, and delivered work is credited only to the children's later attempts. The repository-authored tests explicitly add ten decompositions without changing a 1/2 verified yield. This is more than dashboard hygiene: if the same ledger drives routing and improvement proposals, treating decomposition as success teaches the system that moving work elsewhere is evidence of task competence.

Cost receives the same semantic treatment. NEEDLE first prefers a final agent result when one exists, but can reconstruct usage from per-message stream events after timeout or interruption. Repeated reports for one message are deduplicated by retaining per-field maxima, then summing across messages. When no priced usage evidence exists, the attempt is `costed: false`; it is not averaged as a free run. A checked-in killed-transcript test expects 36,007 input tokens, 1,100 output tokens, and a priced cost, while separate tests preserve unknown cost for adapters or models without sufficient reports. The reusable rule is that **missing measurement is a coverage state, not the number zero**.

The repository also separates local and fleet evidence. Routing can consult `(workspace, adapter)` history first, fall back to fleet-level adapter history below an evidence floor, and record which scope decided. A workspace where every sufficiently observed adapter performs poorly becomes a workspace signal rather than evidence that one adapter alone is bad. ADR-030 extends this idea to pre-existing red verification baselines: a matching post-run failure should be attributed to workspace condition rather than charged to the agent. Scout verified the implemented decomposition, usage, statistics, and workspace-routing paths; this scan did not establish that every ADR-030 baseline-classification path is fully integrated.

## The important boundary: a ledger row is not automatically a final resolution

NEEDLE's own ADR-024 distinguishes process exit, requested lifecycle action, evidence, authoritative state, and semantic resolution. The current outcome handler reinforces that boundary: exit code is stored only as an observation, while `outcome` carries the semantic class. It emits one `attempt.resolved` row across normal and exceptional handler paths and records the dispatch attempt ID.

However, the same source leaves `confirmed_state` unset because the requested action has not yet been authoritatively reread at that point. Direct handler calls can also remain provisional, and the backend currently lacks a native decomposition value, so local `decomposed` maps to backend `indeterminate` while the detailed reason travels separately. ADR-024 explicitly says the migration is complete only when crash-boundary and replay tests prove at most one durable resolution and completion event. The current code is therefore useful implementation evidence for more honest learning inputs, not proof that the full authoritative-resolution design is complete.

## Reusable design rule

Before an attempt ledger becomes input to adaptation, preserve at least:

1. a stable attempt identity and the task/workspace/revision it acted on;
2. a semantic outcome distinct from process exit and requested action;
3. orchestration-neutral classes such as decomposition, infrastructure failure, cancellation, and indeterminate;
4. measurement coverage (`costed`, verified, confirmed) separate from numeric values;
5. evidence scope and fallback provenance, especially workspace versus fleet;
6. authoritative post-action state before granting completion credit; and
7. compatibility mappings that do not erase richer local semantics when an older backend vocabulary is narrower.

Recompute every downstream denominator from the semantic classes rather than patching each consumer independently. Otherwise a new consumer can silently relearn the original error.

## Evidence and limitations

- **Repo:** https://github.com/jedarden/NEEDLE
- **Inspected revision:** [`2021e7f449b85e4353748a65c504ec919e2629a1`](https://github.com/jedarden/NEEDLE/commit/2021e7f449b85e4353748a65c504ec919e2629a1)
- **Primary sources:** [ADR-024 attempt/evidence/resolution contract](https://github.com/jedarden/NEEDLE/blob/2021e7f449b85e4353748a65c504ec919e2629a1/docs/adr/024-attempt-evidence-resolution-is-the-unit-of-work.md), [ADR-030 accounting decisions and historical observations](https://github.com/jedarden/NEEDLE/blob/2021e7f449b85e4353748a65c504ec919e2629a1/docs/adr/030-complete-attempt-accounting.md), [decomposition and usage accounting](https://github.com/jedarden/NEEDLE/blob/2021e7f449b85e4353748a65c504ec919e2629a1/src/attempt_accounting.rs), [outcome-ledger integration](https://github.com/jedarden/NEEDLE/blob/2021e7f449b85e4353748a65c504ec919e2629a1/src/outcome/mod.rs), [statistics](https://github.com/jedarden/NEEDLE/blob/2021e7f449b85e4353748a65c504ec919e2629a1/src/stats/mod.rs), and [workspace-scoped routing](https://github.com/jedarden/NEEDLE/blob/2021e7f449b85e4353748a65c504ec919e2629a1/src/evidence_routing.rs)
- **Coverage:** Complete recursive tree listing (`1,374` entries, `truncated: false`) plus the selected full source files above. Scout inspected project-authored tests but did not compile or run the repository, replay its private production ledger, or independently validate the historical counts. The README describes the project as alpha software operated primarily by its author.
- **Discovery query:** GitHub Repository Search API `topic:ai-agents pushed:>2026-09-22 stars:>20`, sorted by updated time; `total_count: 983`, `incomplete_results: false`.
