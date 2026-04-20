# Project File Review: Unified Metric System

**File:** `agents/shared/projects/metric-system.md`  
**Reviewed:** 2026-04-20  

## Summary

The Unified Metric System is a persistent task owned by May with tech-lead as implementer. It replaces scattered tracking with a unified `metrics` table in `may.db`.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation | ✅ COMPLETE | 4 tables, 20 metrics seeded, 15 snapshots, cron active |
| Phase 2: Agent Integration | ✅ COMPLETE | system_status agent param, proof-of-life metrics, heartbeat-context injection |
| Phase 3: Dashboard | ⏳ BLOCKED | Needs process restart for new handlers to go live |
| Phase 4: Refinement | Not started | Manual recording, proposal flow, intervention tooling |

## Key Facts

- **26 metrics** across 9 agents (May, Bob, Tech-lead, Coach, Optimizer, Scout, Coder, Evaluator, QA)
- **Design approved by Hao** (2026-04-15)
- **No cost metrics** in Phase 1 per Hao's directive
- **Blocker:** Phase 3 requires a process restart to activate new handlers

## Architecture

- Tables: `metrics`, `metric_snapshots`, `metric_alerts`, `research_log` in `may.db`
- Handler: `agents/may/handlers/metrics-snapshot.ts` (auto-measure SQL + shell metrics, threshold alerts, regression detection)
- Cron: 1h interval via `agents/may/cron.json`
- Seed: `scripts/seed-metrics.ts` (20 metrics seeded)

## Conclusion

The project is well-structured with clear phase boundaries. Phases 1-2 are complete with verified deliverables. Phase 3 is blocked on an operational concern (process restart), not a technical one.
