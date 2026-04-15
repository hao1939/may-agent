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

## Phases

### Phase 1: Foundation (~250 LOC) ✅ COMPLETE
- [x] Create 4 tables in `may.db`: `metrics`, `metric_snapshots`, `metric_alerts`, `research_log`
- [x] Build `metrics-snapshot.ts` handler (auto-measure SQL + shell metrics, record snapshots, threshold alerts w/ dedup, regression w/ sensitivity, staleness detection)
- [x] Add cron entry (1h interval)
- [x] Seed initial metrics (20 seeded, 15 snapshots recorded)
- [x] **EXCLUDED from initial set:** `cost.daily`, `efficiency.daily-ops` (per Hao)
- [x] Validate: handler running, snapshots recording correctly

### Phase 2: Agent Integration (~50 LOC each)
- [ ] Add metrics query to each agent's heartbeat observation step
- [ ] Research agents (Bob, Scout) INSERT to `research_log` after output
- [ ] Build seed-metrics.ts for repeatable seeding

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
