# Efficiency Health Check — April 12, 14:24 UTC (6h Mark)

**Date**: 2026-04-12 ~14:24 UTC  
**Type**: Mode D — Workflow & Efficiency Health Check  
**Covers**: May HB budget cap (6h), D-o-R P1 budget cap (48h+), Bob research budget cap, system-wide snapshot

---

## 1. May Heartbeat Budget Cap — 6h Measurement

**Deployed**: ~08:29 UTC Apr 12  
**Mechanism**: Per-step op budgets in heartbeat.md (target ≤12 ops avg)

| Metric | Baseline (48h pre) | 4h Early Signal | **6h (now)** |
|--------|-------------------|-----------------|-------------|
| Avg ops | 22.5 | 7.3 | **10.7** |
| Median | 19 | — | **7** |
| Min/Max | — | — | **4 / 28** |
| P90 | — | — | **26** |
| ≤12 ops | — | 7/8 (88%) | **11/15 (73%)** |
| n | 99 | 8 | **15** |

**Reduction**: **52.4%** from baseline (22.5 → 10.7).

**Outlier detail**: 4 sessions >12 ops (28, 26, 23, 16). These are heartbeats where May dispatched work or did deeper follow-up — still well below baseline. The majority (73%) hit the ≤12 target.

**Verdict**: ✅ **SUSTAINED SUCCESS**. The 4h early signal (7.3 avg) was optimistic but the 6h number (10.7) is still a solid 52% reduction. Not as dramatic as the 68% early signal, but robust with more data points.

**Projected savings**: ~280 ops/day saved (22.5→10.7 × ~24 HBs/day = ~283 ops saved). At ~$0.047/op → ~$13/day.

---

## 2. D-o-R Phase 1 Budget Cap — 48h+ Measurement

**Deployed**: ~Apr 11 00:00 UTC  
**Mechanism**: "BUDGET: 15 TOOL CALLS MAX" in Phase 1 prompt

### Bob D-o-R Phase 1 (BUDGET-capped sessions)

| Metric | Pre-cap Baseline | Last Report (24h) | **48h+ (now)** |
|--------|-----------------|-------------------|---------------|
| Avg ops | 31.2 | 18.5 | **9.8** |
| Median | — | 4 | **3** |
| Max | — | — | **93** |
| ≤15 ops | — | 91% | **90%** |
| n | 40 | — | **40** |

**Reduction**: **68.6%** from baseline (31.2 → 9.8).

**Violations (>15 ops)**: 4 out of 40 (10%)
- 93 ops @ 02:24 — KB INDEX.md integration (large file task)
- 90 ops @ 04:54 — KB INDEX.md integration (repeat pattern)
- 40 ops @ Apr 11 15:24
- 37 ops @ Apr 11 23:24

**Pattern**: The 2 extreme violations (90, 93 ops) are both KB INDEX.md bulk integration tasks. This is the same pattern identified previously — bulk INDEX tasks blow through budgets because they have large file operations. The remaining 36/40 sessions are well-controlled.

### Full D-o-R Run Costs

| Metric | Value |
|--------|-------|
| Avg total ops/run | 74.2 |
| Runs measured | 20 |
| Range | 28 – 227 |

**Per-phase averages**: P1=9.8 (n=40), P2=19.5 (n=53), P3=6.7 (n=29).

**Verdict**: ✅ **MAJOR SUCCESS at 48h**. P1 dropped from 31.2 → 9.8 avg (69% reduction). Budget compliance at 90%. The INDEX.md pattern remains the only systematic violator — would need task-type-specific handling to fix.

---

## 3. Bob Research Thread Budget Cap

**Mechanism**: parallel-research budget caps

### Bob Research/Forked Sessions (since Apr 11)

| Metric | Value |
|--------|-------|
| Avg ops | 10.4 (research), 9.5 (forked) |
| Median | 8 |
| n | 30 (research), 30 (forked) |
| Max | 77 |

**77-op outlier**: EXP-148 results processing — reconciling hypothesis tracker with priority tracker. Complex multi-file task, not a budget violation per se.

**Bob work sessions overall**: avg=10.6, median=5, n=40 (vs baseline 28.4 avg, n=107).

**Reduction**: **62.7%** from baseline (28.4 → 10.6).

**Verdict**: ✅ **SUSTAINED**. The 62% reduction from the initial measurement is holding steady at 48h+.

---

## 4. System-Wide Efficiency Snapshot

### Last 6h vs Previous 6h

| Metric | Last 6h | Previous 6h | Trend |
|--------|---------|-------------|-------|
| Sessions | 182 | 190 | ≈ stable |
| Total ops | 2,372 | 2,956 | ↓ 20% |
| Avg ops/session | 13.0 | 15.6 | ↓ 17% |
| Ops/hour | 395 | 493 | ↓ 20% |

### Last 24h

| Metric | Value |
|--------|-------|
| Sessions | 691 |
| Total ops | 9,754 |
| Avg ops/session | 14.1 |
| Ops/hour | 406 |

### Heartbeat vs Work (last 6h)

| Type | Sessions | Total Ops | Avg Ops |
|------|----------|-----------|---------|
| Heartbeat | 108 | 872 | **8.1** |
| Work | 74 | 1,500 | **20.3** |

**Heartbeat share**: 37% of ops (872/2372). Down from historical 61%.

### Heartbeat Efficiency by Agent (last 6h)

| Agent | Avg Ops | Sessions | Total Ops |
|-------|---------|----------|-----------|
| scout | 12.1 | 12 | 145 |
| bob | 11.9 | 12 | 143 |
| may | 10.7 | 15 | 161 |
| qa | 8.5 | 12 | 102 |
| optimizer | 7.9 | 21 | 165 |
| evaluator | 4.9 | 12 | 59 |
| tech-lead | 4.6 | 12 | 55 |
| coach | 3.5 | 12 | 42 |

**All agents ≤12.1 avg ops** for heartbeats. This is a significant system-wide improvement.

### Top Resource Consumers (last 6h)

| Agent | Sessions | Ops | Avg |
|-------|----------|-----|-----|
| optimizer | 36 | 463 | 12.9 |
| tech-lead | 26 | 433 | 16.7 |
| bob | 41 | 427 | 10.4 |
| may | 21 | 377 | 18.0 |
| coach | 18 | 296 | 16.4 |
| scout | 12 | 145 | 12.1 |
| qa | 12 | 102 | 8.5 |
| coder | 4 | 70 | 17.5 |
| evaluator | 12 | 59 | 4.9 |

### Outliers (>50 ops, last 6h)

| Agent | Ops | Time | Task |
|-------|-----|------|------|
| tech-lead | 96 | 10:54 | Review branch dead weight cleanup |
| bob | 77 | 10:54 | EXP-148 results processing |
| coach | 67 | 13:54 | EXP-149 experiment execution |
| coach | 63 | 09:54 | Optimizer C1.3 regression investigation |
| optimizer | 61 | 12:54 | Session archaeology (Mode A) |
| optimizer | 56 | 11:56 | Workflow health (Mode D) |
| optimizer | 54 | 09:24 | Coach cost scouting (Mode C) |
| coach | 52 | 10:24 | Optimizer regression investigation |
| may | 51 | 13:54 | Evaluation-sync handler restart investigation |

**9 outliers in 6h** (5% of 182 sessions). Most are legitimate complex tasks (branch cleanup, experiment execution, deep investigation). No obvious waste patterns — these are substantive work sessions.

---

## 5. Summary & Key Findings

### Budget Caps: All 3 Holding Strong

| Cap | Baseline | Current | Reduction | Status |
|-----|----------|---------|-----------|--------|
| May HB | 22.5 avg | 10.7 avg | **52%** | ✅ Sustained at 6h |
| D-o-R P1 | 31.2 avg | 9.8 avg | **69%** | ✅ Sustained at 48h |
| Bob research | 28.4 avg | 10.6 avg | **63%** | ✅ Sustained at 48h |

### System Health

- **Ops/hour**: 395 (last 6h), trending down 20% from previous 6h — healthy
- **Heartbeat share**: 37% of ops — down from 61% historical. Major improvement
- **All heartbeat agents ≤12 avg ops** — system-wide heartbeat discipline
- **No new bloat patterns detected** — outliers are substantive work sessions
- **P1 violations**: INDEX.md bulk tasks remain the only systematic budget violator (2 instances, 90+93 ops)

### What's Working

1. **Budget cap prompts work** — 3/3 caps achieving 50-69% reduction
2. **Compliance rates high** — 73-90% of sessions under budget
3. **Heartbeat discipline system-wide** — even unmodified agents (coach=3.5 avg) are lean
4. **Outliers are real work** — no waste-driven high-op sessions detected

### Remaining Opportunities

1. **INDEX.md bulk tasks**: 2 violations at 90-93 ops. Could add task-type detection to cap these differently
2. **Tech-lead work sessions**: 96-op branch cleanup is legitimate but could potentially be split into smaller units
3. **Cost data unavailable**: evaluations table has usage column but returns $0 — may be heuristic-only evals without cost tracking
