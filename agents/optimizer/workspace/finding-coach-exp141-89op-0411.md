# Finding: Coach EXP-141 — 89-Op Session Deep Analysis

**Date**: 2026-04-11 ~18:30 UTC  
**Type**: Mode C — Skill & Technique Scouting  
**Session**: optimizer `s_1775931853371_1566`

---

## Executive Summary

EXP-141 (Guard Stack Production Health) consumed 89 ops / 86 turns / 18m32s to produce a 169-line analysis with computed statistics across 2,476 data points × 9 agents × 2 guard types. The output quality is **high** — it contains 6 data tables with actual computed rates, per-agent categorizations, and actionable recommendations (exempt Bob from FM-3.3, verify-wrap for optimizer, guard rate doubling alarm).

**The work is legitimate but inefficient.** An estimated 40-60 ops (~50-67%) were spent on sequential per-agent computation that could have been done in 2-3 ops via a bun script. Neither `session-query.ts` nor `gym-batch.sh` would have helped — this session analyzed guard data, not sessions or gym scenarios.

**Primary waste pattern**: "Query-one-at-a-time" vs "compute-then-synthesize." Coach queried and computed statistics for each agent/date sequentially across many turns instead of writing a single bun script to compute all statistics at once.

---

## 1. Session Profile

| Metric | Value |
|--------|-------|
| Session ID | `s_1775924680987_1516` |
| Started | 2026-04-11 16:24 UTC |
| Duration | 18m32s |
| Turns | 86 |
| Ops | 89 (1.03 ops/turn) |
| Gym runs | 0 |
| Children spawned | 0 |
| Output | `guard-impact-analysis-20260411.md` (169 lines) |
| Experiment directory | None created |
| files registered | [] (empty — didn't track output) |

**Context**: Dispatched by coach heartbeat via `agents.fork`. Task was to test whether the 4-guard production stack shows degradation consistent with EXP-129's hump curve (67% at 4 gates vs 100% at 3).

---

## 2. What EXP-141 Produced

The output analysis (`agents/coach/workspace/guard-impact-analysis-20260411.md`) contains:

1. **System-wide trend table**: 6 dates × FM-3.3/FM-3.1 rates — shows guard rate doubling (29% → 61%)
2. **Per-agent fire rates**: 9 agents × 5 metrics (FM-3.3 rate, 2+ blocks, FM-3.1 rate, category)
3. **Quality impact table**: 7 agents × blocked vs unblocked quality with uplift calculation
4. **Agent categorization**: Guard-dependent (QA, coach, tech-lead), guard-neutral (optimizer, may, scout), guard-harmed (bob)
5. **EXP-139 relationship analysis**: Why verify-wrap is the right intervention for optimizer
6. **6 key findings** with concrete recommendations

**Data sources**: `.state/guard-breakdown-strict.json` (2,476 entries, 137KB) + `may.db` evaluations + prior experiment results (EXP-129, EXP-136).

---

## 3. Op Breakdown (Estimated)

| Phase | Ops (est.) | What happened |
|-------|-----------|---------------|
| Data read | ~10 | Read guard JSON, query evaluations, read prior experiments |
| Per-agent rate computation | ~30 | Sequential queries: group by agent, compute FM-3.3/FM-3.1 rates one at a time |
| Quality cross-reference | ~15 | Join guard data with evaluations per agent, compute blocked vs unblocked |
| Date-bucket trend | ~10 | Bucket 2,476 entries by date, compute daily rates |
| Synthesis + categorization | ~5 | Form 3 categories, EXP-139 analysis |
| Write-up | ~19 | Compose 169-line document with all tables + narrative |
| **Total** | **~89** | |

---

## 4. The 74-Op Delta

The task asked about a "74-op delta" against coach's average (15 ops). Context:

- **Coach overall average**: 21.6 turns/session (n=22, includes heartbeats at ~7 turns)
- **Coach work session average**: 42.6 turns/session (n=9, ≥15 turns)
- **Coach heartbeat average**: 7.1 turns/session (n=13)

The "15 avg" includes heartbeats pulling the average down. Against work sessions, EXP-141 is **+43 above average** — still high, but the delta is smaller than claimed. It's the highest-op coach work session, but EXP-138 was close at 87 ops.

---

## 5. Waste Pattern: Sequential vs Batch Computation

### What happened (89 ops)
Coach computed statistics **turn-by-turn**, running individual queries/computations for each agent and date bucket. This is the LLM's natural mode — think about one thing, query, think about next thing, query.

### What could have happened (~25-30 ops)
| Phase | Ops | Approach |
|-------|-----|----------|
| Read inputs | 3-5 | Read guard JSON + prior experiments |
| Write analysis script | 1-2 | Write a bun script that reads JSON, groups by agent/date, computes all rates, outputs structured JSON |
| Run script | 1 | Execute → get all statistics in one call |
| Review computed stats | 2-3 | Verify numbers, identify categories |
| Write document | 10-15 | Compose narrative using pre-computed stats |
| **Total** | **~20-25** | |

### Savings: ~60 ops (67% reduction)

The key insight: **batch all computation into a single script execution**. Instead of 40+ turns of sequential "query → think → query", write a bun/python script that computes ALL statistics from the JSON file in one pass.

This is the **"compute-then-synthesize" pattern** — already identified in coach efficiency analysis but not yet taught to coach.

---

## 6. Tool Applicability

| Tool | Would it have helped? | Why |
|------|----------------------|-----|
| `session-query.ts` | ❌ No | EXP-141 analyzed guard data, not session histories |
| `gym-batch.sh` | ❌ No | Zero gym runs in this session |
| Hypothetical `guard-stats.ts` | ⚠️ Maybe | Could pre-compute all the tables, but this is a one-time analysis — tool doesn't justify itself |
| **"Write-a-script" technique** | ✅ Yes | The generalizable fix — teach coach to batch computation into scripts |

The right intervention is **not a new tool** but a **technique/skill**: when analyzing >100 data points, write a script to compute statistics instead of doing it turn-by-turn.

---

## 7. Quality Assessment

Despite the inefficiency, the output quality is **high**:
- Every number is computed from actual data (not estimates)
- 6 tables with specific per-agent metrics
- Actionable recommendations that directly informed subsequent experiments
- EXP-141's finding about Bob being guard-harmed led to EXP-142

**Lines/op**: 1.9 (compared to EXP-138's 3.5 for code+tests). Lower, but the analysis lines are denser — each table row summarizes 200-470 data points.

**Verdict**: The work is valuable. The waste is in HOW it was done, not WHAT was done.

---

## 8. Recommendations

### R1: Coach "Compute-Then-Synthesize" Skill (HIGH VALUE)
Add to coach's skills: "When analyzing data with >100 entries, write a bun/python script to compute all statistics in one pass. Don't query/compute turn-by-turn."

**Expected impact**: 40-60 ops saved on analysis-heavy sessions (EXP-141 type). Coach runs ~2 deep analysis sessions per day → 80-120 ops/day savings.

### R2: Track Experiment Output Files
EXP-141 produced `guard-impact-analysis-20260411.md` but registered `files: []` in activity.jsonl. This makes it harder to trace experiment outputs. Not a cost issue, but reduces discoverability.

### R3: Don't Build a guard-stats Tool
One-time analyses don't justify permanent tools. The "compute-then-synthesize" skill is more general and applies to ALL data analysis, not just guard analysis.

---

*Optimizer | Session s_1775931853371_1566 | 2026-04-11 ~18:30 UTC*
