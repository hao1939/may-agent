# Persistent Task: Unified Metric System

**Owner:** May (system oversight)  
**Worker:** Tech-lead (implementation)  
**Status:** Phase 1 — COMPLETE, Phase 2 — COMPLETE, Phase 3 — BLOCKED (restart needed)  
**Created:** 2026-04-15  
**Approved by:** Hao (2026-04-15 ~14:50 UTC)

---

## Goal

Replace scattered tracking (dispatch board, todo.md, ad-hoc queries) with a unified `metrics` table in `may.db`. Every agent gets a queryable answer to "what should I work on?" — a concrete metric with owner, current value, target, and type.

## Design Doc

`agents/shared/may-agent-docs/design/metrics-system.md` — APPROVED by Hao.

## Evolution Roadmap

`agents/shared/may-agent-docs/design/metrics-evolution-roadmap.md` — Hao's long-term vision (Levels 1→4). Not for implementation now — guides Phase 1 design decisions.

## Hao's Key Decisions

1. **No cost metrics in Phase 1** — creativity first, cost optimization later
2. **Convention granularity: owner decides** — aggregate for May, per-convention for coach if needed
3. **Metric approval: May approves P2, Hao approves P0/P1**
4. **Gym quality: simple proxies** (pass rate, discrimination) — don't over-engineer
5. **May owns the system**, tech-lead implements the code
6. **Authoritative metric assignments** — Hao specified exact metric names per agent (2026-04-16)

## Authoritative Metric Assignments (from Hao, 2026-04-16 — revised round 2)

| Agent | Metrics | Types | Speed |
|-------|---------|-------|-------|
| May | `system.request-throughput`, `system.stuck-requests`, `system.agent-utilization` | health, health, continuous | daily, fast, daily |
| Bob | `bob.experiment-completion`, `bob.hypotheses-resolved`, `bob.designs-implemented` | health, continuous, continuous | fast, slow, slow |
| Tech-lead | `tech-lead.build-health`, `tech-lead.meaningful-changes`, `tech-lead.codebase-weight`, `tech-lead.delegation-quality` | health, continuous, continuous, continuous | fast, daily, slow, daily |
| Coach | `coach.intervention-hit-rate`, `coach.skill-effectiveness`, `coach.knowledge-to-action-latency` | continuous, continuous, continuous | fast, daily, daily |
| Optimizer | `optimizer.tool-adoption`, `optimizer.analysis-accuracy`, `optimizer.quality-preserved` | continuous, continuous, health | daily, daily, slow |
| Scout | `scout.hypotheses-generated`, `scout.findings-used`, `scout.coverage` | continuous, continuous, health | daily, slow, fast |
| Coder | `coder.quality`, `coder.first-pass-rate` | continuous, continuous | daily, daily |
| Evaluator | `evaluator.calibration`, `evaluator.coverage` | health, health | daily, daily |
| QA | `qa.review-coverage`, `qa.false-positive-rate` | health, continuous | daily, slow |

Total: 26 metrics (was 24). Key renames: `features-shipped`→`meaningful-changes`, `quality-improvement`→`intervention-hit-rate`, `gym-discrimination`→`knowledge-to-action-latency`, `waste-reduction`→`analysis-accuracy`, `discovery-rate`→`hypotheses-generated`. New: `tech-lead.delegation-quality`.

### Tension Pairs
- **Bob ↔ Tech-lead:** "What to build" vs "How to build it well"
- **Coach ↔ Optimizer:** "Agent quality" vs "Agent efficiency"

## Phases

### Phase 1: Foundation (~250 LOC) ✅ COMPLETE
- [x] Create 4 tables in `may.db`: `metrics`, `metric_snapshots`, `metric_alerts`, `research_log`
- [x] Build `metrics-snapshot.ts` handler (auto-measure SQL + shell metrics, record snapshots, threshold alerts w/ dedup, regression w/ sensitivity, staleness detection)
- [x] Add cron entry (1h interval)
- [x] Seed initial metrics (20 seeded, 15 snapshots recorded)
- [x] **EXCLUDED from initial set:** `cost.daily`, `efficiency.daily-ops` (per Hao)
- [x] Validate: handler running, snapshots recording correctly

### Phase 2: Agent Integration (~50 LOC each) ✅ COMPLETE
- [x] system_status shows "my metrics" per agent (agent param, shows owned or all)
- [x] Proof-of-life digest pulls from metric_snapshots (health metrics section)
- [x] heartbeat-context handler injects owned metrics
- [ ] Research agents (Bob, Scout) INSERT to `research_log` after output — deferred to Phase 3 adoption

### Phase 3: Dashboard (~100 LOC)
- [ ] Add metrics section to `system_status` tool
- [ ] Update proof-of-life digest to include metrics
- [ ] Web console dashboard

### Phase 4: Refinement (ongoing)
- [ ] Manual metrics recording helpers
- [ ] Metric proposal flow (agent proposes → May reviews)
- [ ] Intervention annotation tooling
- [ ] Evaluate dispatch board retirement (only if metrics prove superior)

## Iteration Log

| Date | Phase | What | Result |
|------|-------|------|--------|
| 2026-04-15 | Pre | Design brainstorm (5 agents) | All 5 responses synthesized |
| 2026-04-15 | Pre | Design approved by Hao | Proceed with Phase 1 |
| 2026-04-15 | 1 | Forked tech-lead for Phase 1 implementation | Pending |
| 2026-04-15 | 1 | Phase 1 COMPLETE — 4 tables, 20 metrics, 15 snapshots, cron active | ✅ Done |
| 2026-04-15 | — | Evolution roadmap saved (Hao's L1→L4 vision) | `metrics-evolution-roadmap.md` |
| 2026-04-15 | 2 | Phase 2 COMPLETE — system_status agent param, proof-of-life metrics, heartbeat-context injection | ✅ Done |
| 2026-04-15 | 3 | Phase 3 BLOCKED — needs process restart for new handlers to go live | ⏳ Blocked |
