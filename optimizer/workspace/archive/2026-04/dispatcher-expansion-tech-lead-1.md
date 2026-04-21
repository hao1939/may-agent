# Dispatcher Expansion — Tech-Lead Analysis

**Date**: 2026-04-07
**Author**: Optimizer
**Status**: Ready for deployment
**Prerequisite**: Bob & Coach dispatcher deployments (both stable, verified)

---

## 1. Current State & Cost Baseline (7-day data)

### Heartbeat Metrics

| Metric | Tech-Lead | Bob (pre-disp) | Coach (pre-disp) | Optimizer (post-disp) |
|--------|-----------|-----------------|-------------------|-----------------------|
| HBs/7d | 55 | 120 | 85 | ~8/13h |
| Avg Ops | 44.3 | 26.2 | 30.5 | **9.0** |
| Avg Cost | $1.93 | $2.78 | $1.91 | **$0.15** |
| Max Ops | 202 | — | — | — |
| Error Rate | 21.8% (12 errs) | 12.5% | 11.8% | **0%** |
| HB Cost/Day | ~$14.85* | $47.26 | $23.13 | **$3.57** |
| Total HB Cost/7d | $103.97 | $330.29 | $160.80 | — |

*Note: Tech-lead's cost is heavily weighted toward the last 48h when it had sustained implementation work.

### Critical Trend: Cost Acceleration

| Period | HB Count | Avg Ops | Avg Cost | Total Cost | Errors |
|--------|----------|---------|----------|------------|--------|
| Days 3-7 ago | 28 | 14.5 | $0.43 | $12.11 | 9 |
| Last 48h | 27 | **75.2** | **$3.53** | **$91.86** | 3 |

**The last 48h cost $91.86 — that's 87.5% of the entire 7-day total.** This happened because tech-lead entered a sustained implementation phase (session digest system, evaluator recalibration, dependency upgrade) and did ALL work inline in heartbeats.

### Error Breakdown

| Error Type | Count | Description |
|-----------|-------|-------------|
| Turn limit (31/30) | 2 | Old 30-turn limit sessions |
| Turn limit (41/40) | 9 | Current 40-turn limit sessions |
| Timeout | 1 | Long research session |
| **Total** | **12** | **21.8% error rate** |

All 12 errors are turn-limit or timeout — the exact pathology that dispatcher mode eliminates. Tech-lead has the **highest error rate** of any agent being evaluated for dispatcher mode.

### Ops Distribution (heartbeats only)

| Ops Bucket | Count | % | Cumulative % |
|-----------|-------|---|-------------|
| ≤10 | 19 | 34.5% | 34.5% |
| 11-20 | 1 | 1.8% | 36.4% |
| 21-30 | 6 | 10.9% | 47.3% |
| 31-40 | 5 | 9.1% | 56.4% |
| 41-60 | 7 | 12.7% | 69.1% |
| 61-80 | 5 | 9.1% | 78.2% |
| 81-100 | 6 | 10.9% | 89.1% |
| **100+** | **6** | **10.9%** | 100% |

**Key insight**: Tech-lead is bimodal:
- **34.5% of heartbeats are already lean** (≤10 ops) — these are quick triage sessions
- **43.6% exceed 40 ops** — these are implementation sessions doing real building work
- **10.9% exceed 100 ops** (!!!) — these are massive sessions (up to 202 ops) doing multi-file implementation

This is **far worse than Bob (26%) or Coach (33%)** for the >40 ops bucket. And the magnitude is worse too: Bob's max was ~60 ops, tech-lead hits 202.

---

## 2. What Tech-Lead Does in Heartbeats

### Work Categories (from high-ops session analysis)

| Category | Example Sessions | Ops Range | Forkable? |
|----------|-----------------|-----------|-----------|
| **Multi-file implementation** | Session digest phases, evaluator recalibration | 100-202 | ✅ Absolutely |
| **Test writing** | Evaluator heuristic tests (100 new tests) | 80-125 | ✅ Yes |
| **System investigation** | Evaluator analysis, turn budget debugging | 60-100 | ✅ Yes |
| **Dependency upgrade** | pi-agent-core 0.58→0.65 | 77 | ✅ Yes |
| **Build & deploy** | Binary building, supervisord restart | 50-70 | ✅ Yes |
| **Quick triage** | Read todo, check health, acknowledge | ≤10 | ❌ Keep inline |

**Every category above 10 ops is forkable.** Unlike Bob (where research feels "amorphous") or Coach (where gym runs are discrete), tech-lead's work has a natural unit: the implementation task. It already arrives as well-scoped tasks (from May's job dispatch or from design docs).

### Zero Delegation Pattern

A critical finding: **tech-lead has 0 child sessions in the last 7 days**. It never calls `agents.call("coder", ...)` or `agents.fork(...)`. All work is done inline in the heartbeat session itself.

This means:
1. Every implementation task consumes heartbeat turn budget
2. Complex tasks hit the 40-turn limit and error out
3. Work that takes 100+ ops succeeds only because of compaction extending effective turns

The dispatcher pattern doesn't just fork work — it **creates the session boundary that tech-lead currently lacks**.

### Quality is High — When It Completes

Successful high-ops heartbeats score quality=5, efficiency=4. Tech-lead does excellent work. The problem is purely structural:
- Turn limits kill sessions mid-implementation
- 21.8% error rate wastes completed work
- Resumed sessions have to re-read context, adding cost

---

## 3. Tech-Lead-Specific Design Considerations

### Consideration 1: Implementation Requires Code Access

Unlike Bob (knowledge files) or Coach (gym scenarios), tech-lead edits `src/*.ts` files and runs `npm run check`. The work session must:
- Have the `coding` tool preset (already in agent.json: ✅)
- Include `npm run check` as a verification step
- Use review branches for src/ changes
- Be scoped tightly to avoid drift

**Design response**: Work session templates include explicit "Verify:" and "Constraints:" sections.

### Consideration 2: Multi-Phase Work

Tech-lead often does multi-phase implementations (e.g., Session Digest had 4 phases). Currently it tries to do multiple phases in one heartbeat. The dispatcher approach:
- Fork Phase 1 → heartbeat exits
- Next heartbeat checks Phase 1 completion → forks Phase 2
- Each phase gets a full turn budget
- Each phase is independently verifiable

This is actually **better** than the current approach because each phase gets tested and committed before the next begins.

### Consideration 3: Jobs from May

Tech-lead already receives scoped "jobs" (kind=job) from May for implementation work. These 10 non-heartbeat sessions in the last 7 days are well-scoped and successful (avg 50 ops, all completed). The dispatcher pattern extends this: instead of May dispatching jobs, tech-lead dispatches them to itself.

### Consideration 4: Coder Delegation

The heartbeat.md should encourage using `agents.call("coder", task)` INSIDE work sessions (not inside heartbeats) for well-scoped sub-tasks. Tech-lead's context.md already has guidance on coder delegation with explicit file scope boundaries.

### Consideration 5: Build/Deploy Operations

Build and deploy operations (binary building, supervisord restart) are inherently time-consuming. They MUST be forked — they're the sessions most likely to hit timeout errors.

---

## 4. Projected Savings

### Heartbeat Cost Reduction

| Scenario | Avg HB Cost | HBs/Day | HB Cost/Day |
|----------|-------------|---------|-------------|
| **Current (last 48h)** | $3.53 | ~13.5 | **$47.66** |
| **Current (7d avg)** | $1.93 | ~7.9 | **$14.85** |
| **Dispatcher (projected)** | ~$0.25 | ~7.9 | **~$1.98** |

Conservative estimate: **87% heartbeat cost reduction** (using 7d average baseline).

Using the last-48h spike as a "burst" baseline: **96% reduction** during implementation phases.

### Error Rate Impact

| Metric | Current | Projected |
|--------|---------|-----------|
| Heartbeat error rate | 21.8% | ~0% |
| Errors/7d | 12 | ~0 |
| Wasted work from errors | ~12 × $1.93 = $23.16 | ~$0 |

### Total Cost Impact (estimated)

| Metric | Current (7d) | Projected (7d) |
|--------|-------------|---------------|
| HB cost | $103.97 | ~$13.86 |
| Work session cost (new) | $0 | ~$60-80* |
| Error waste | ~$23 | ~$0 |
| **Net total** | **$126.97** | **~$75-95** |

*Work sessions will cost money, but they'll complete successfully and produce better results. The 202-ops heartbeat that cost $12.11 would still cost ~$12 as a work session — but it wouldn't risk turn-limit kills, and the heartbeat that dispatched it would cost $0.25 instead of $12.11.

### Annual Projection (all 4 dispatcher agents)

| Agent | HB Cost/Day (before) | HB Cost/Day (after) | Savings/Day |
|-------|---------------------|---------------------|-------------|
| Optimizer (actual) | $31.35 | $3.57 | $27.78 |
| Bob (projected) | $47.26 | ~$4.73 | ~$42.53 |
| Coach (projected) | $23.13 | ~$2.31 | ~$20.82 |
| **Tech-Lead (projected)** | **$14.85** | **~$1.98** | **~$12.87** |
| **4-agent total** | **$116.59** | **~$12.59** | **~$104.00** |

**Annual HB overhead savings: ~$104/day × 365 = ~$37,960/year**

---

## 5. Rollout Plan

### Deployment

**Day 1: Deploy**
- Replace `agents/tech-lead/heartbeat.md` with dispatcher version
- Monitor first 3-4 heartbeats for correct dispatcher behavior
- Check: does tech-lead fork when encountering implementation work?

**Days 2-3: Stabilize**
- Target: ≥6 heartbeats under dispatcher mode
- Success criteria:
  - Heartbeat ops < 15 (avg)
  - Error rate = 0%
  - At least 1 work session successfully forked and completed
  - Cost/heartbeat < $0.50

**Rollback trigger**: If >2 heartbeats do substantial implementation inline, revert and investigate.

### Monitoring Query

```sql
-- Run daily during stabilization
SELECT 
  date(s.startedAt/1000, 'unixepoch') as day,
  SUM(CASE WHEN s.task LIKE '%heartbeat%' THEN 1 ELSE 0 END) as hb_count,
  SUM(CASE WHEN s.task LIKE '%WORK SESSION%' THEN 1 ELSE 0 END) as ws_count,
  ROUND(AVG(CASE WHEN s.task LIKE '%heartbeat%' THEN s.opCount END), 1) as hb_avg_ops,
  ROUND(AVG(CASE WHEN s.task LIKE '%heartbeat%' THEN json_extract(e.usage, '$.cost') END), 2) as hb_avg_cost,
  SUM(CASE WHEN s.task LIKE '%heartbeat%' AND s.status='error' THEN 1 ELSE 0 END) as hb_errors,
  ROUND(AVG(CASE WHEN s.task LIKE '%WORK SESSION%' THEN s.opCount END), 1) as ws_avg_ops,
  SUM(CASE WHEN s.task LIKE '%WORK SESSION%' AND s.status='error' THEN 1 ELSE 0 END) as ws_errors
FROM sessions s
LEFT JOIN evaluations e ON e.sessionId = s.sessionId
WHERE s.startedAt > ?  -- 24h ago
  AND s.agent = 'tech-lead'
GROUP BY day
```

### Success Criteria

| Metric | Target |
|--------|--------|
| Heartbeat error rate | 0% |
| Heartbeat avg ops | < 15 |
| Heartbeat avg cost | < $0.50 |
| Work session completion rate | > 80% |
| Work session quality | ≥ 4.0/5 |
| Total daily cost (vs baseline) | < 70% |

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Tech-lead ignores dispatcher, does implementation inline | Explicit "DO NOT" warnings for code editing, test running, building in heartbeats |
| Work sessions too large (>100 ops) | Templates encourage phase decomposition; heartbeat re-checks between phases |
| Coder delegation adds complexity | Templates show when to use coder (well-scoped sub-tasks) vs self-implementation |
| Multi-phase work loses context between heartbeats | Work sessions write checkpoints; todo.md tracks phase progress |
| Review branch requirement slows work | Work sessions handle branching; heartbeats just verify merge status |
| Build/deploy operations need long timeouts | Work sessions can set appropriate timeouts; heartbeats can't |

---

## 7. Summary

Tech-lead is the **strongest candidate** for dispatcher mode conversion among remaining agents:

1. **Highest error rate** (21.8%) — all from turn limits, all preventable
2. **Most extreme ops distribution** — 10.9% of heartbeats exceed 100 ops (max 202)
3. **Zero delegation pattern** — never uses coder or forks, everything inline
4. **Naturally decomposable work** — implementation tasks have clear scope boundaries
5. **Proven pattern** — already receives well-scoped "jobs" from May that succeed consistently

The dispatcher pattern transforms tech-lead's heartbeat from a "do-everything" loop into a lightweight dispatcher that identifies what needs building and creates focused work sessions to build it.

### Files Produced

- `agents/optimizer/workspace/proposed-tech-lead-heartbeat.md` — Drop-in replacement for `agents/tech-lead/heartbeat.md`
- `agents/optimizer/workspace/dispatcher-expansion-tech-lead.md` — This analysis document

### Deployment Command

```bash
cp agents/optimizer/workspace/proposed-tech-lead-heartbeat.md agents/tech-lead/heartbeat.md
cd agents && git add tech-lead/heartbeat.md && git commit -m "feat(tech-lead): convert heartbeat to dispatcher mode (EXP-034 expansion)"
```
