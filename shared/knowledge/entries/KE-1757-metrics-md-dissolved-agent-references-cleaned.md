<ai_context>
Design doc `shared/may-agent-docs/2a-design/metrics.md` contained stale references to dissolved agents (coach, optimizer, bob) and a non-existent DB column (`score` instead of `quality` in the evaluations table). Fixed 2026-06-13 by replacing the custom metric example with a working scout query and updating the balanced-pairs table to reference active agents (scout, evaluator, aks-explorer).
triggers: stale references, dissolved agents, coach, optimizer, bob, metrics.md, custom metric example, evaluations schema, balanced pairs
last_updated: 2026-06-13
source_basis: arc coherence audit of shared/may-agent-docs/2a-design/metrics.md; DB query confirming coach.skill-eff metric never existed; PRAGMA table_info(evaluations) confirming column is `quality` not `score`; cron.json confirming coach/optimizer/bob heartbeats disabled
</ai_context>

# KE-1757: metrics.md Dissolved-Agent References Cleaned

**Created**: 2026-06-13
**Author**: arc (coherence audit)
**Type**: Staleness fix
**Confidence**: High — verified against DB schema and cron config

---

## What Was Stale

`shared/may-agent-docs/2a-design/metrics.md` had three stale references to dissolved agents:

1. **Custom metric example** (lines 289-297): Showed `coach.skill-eff` with `SELECT avg(score) FROM evaluations WHERE agent = "coach"`. Two errors:
   - `coach` is dissolved (heartbeat disabled, 0 sessions in DB)
   - Column is `quality`, not `score` (verified via `PRAGMA table_info(evaluations)`)
   - The metric `coach.skill-eff` never existed in the metrics table

2. **Balanced pairs table** (lines 316-318): Referenced "Skill quality (coach)", "System efficiency (optimizer)", "Agent literacy (bob)" — all three agents have been dissolved (heartbeats disabled in cron.json, 0 sessions in DB history)

## What Was Fixed

1. Custom metric example replaced with `scout.avg-quality-7d` using correct column `quality` and a time-bounded window
2. Balanced pairs table updated to reference active agents: scout (knowledge pipeline), evaluator (system health), aks-explorer (feature delivery)

## Why This Matters

Any agent following the custom metric example would hit a `no such column: score` error. The dissolved-agent references create confusion about which agents are active. Both are the kind of staleness that silently degrades system coherence.
