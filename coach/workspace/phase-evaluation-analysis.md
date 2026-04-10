# Phase Evaluation Analysis — Production Data Deep Dive

**Date**: 2026-04-10  
**Analyst**: Coach  
**Period**: Last 7 days (Apr 3–10, 2026)  
**Database**: `.state/may.db` (75MB production data)

---

## Executive Summary

The reported "70% failure rate" for Phase 1/Phase 2 pipeline sessions is **mostly an artifact of three compounding measurement bugs**, not a genuine quality problem. When corrected:

| Metric | Reported | Corrected | Root Cause of Error |
|--------|----------|-----------|-------------------|
| Phase failure rate | ~70% | ~74% "acceptable or good" | Scale mismatch: Q≥3 threshold on 0-1 scores |
| Phase vs non-phase gap | 80pp worse | 19pp worse | Comparing different evaluator methods |
| Failed session count | 61 | ~26 | Duplicate evaluations inflated by 2x |

**True finding**: Phase sessions are evaluated 19 percentage points worse than non-phase sessions when both use LLM evaluation (26% "good" vs 45% "good"). This IS a real gap, but it's much smaller than the 70pp gap originally observed, and has identifiable causes.

---

## Finding 1: Scale Mismatch (Critical Bug)

### The Bug
The evaluator has two scoring paths:
- **Heuristic evaluator** (line 1571-1572 of evaluator.ts): Quality scale **1–5**, "good" at Q≥4
- **LLM evaluator** (DOMAIN.md scoring section): Quality scale **0.0–1.0**, "good" at Q≥0.7

These two paths were never harmonized. The DOMAIN.md was updated to 0-1 at some point, but the heuristic evaluator still uses 1-5.

### Evidence
```
ALL AGENTS, LLM vs HEURISTIC:
agent        Method    N    good  %good  avg_q  max_q
bob          LLM     108      0     0%   0.77   0.92
bob          HEUR    324    319    99%   4.00   5.00
coach        LLM      13      0     0%   0.65   0.90
coach        HEUR    413    406    98%   4.02   5.00
tech-lead    LLM       9      0     0%   0.38   0.80
tech-lead    HEUR    240    232    97%   4.12   5.00
```

**If you use Q≥3 as "good"**, the LLM evaluator has a **0% pass rate** across ALL agents (0/132). This is physically impossible to achieve on the 0-1 scale. The max LLM score ever given is 0.92.

### Impact
Any query using `quality >= 3` as a threshold will report 0% pass for LLM-evaluated sessions. Since phase sessions are always child sessions (always LLM-evaluated), they appear to have a 0% pass rate vs 99% for heuristic root sessions.

---

## Finding 2: Evaluation Method Selection Bias

### The Pattern
- **Root sessions** (no parent) → Heuristic evaluator → avg Q=4.0
- **Child sessions** (have parent) → LLM evaluator → avg Q=0.77

Phase 1/2 are ALWAYS child sessions (called by an orchestrator parent). Non-phase Bob sessions are almost always root sessions.

### The Numbers
```
Session Type     Method     N     "good"   %good
Root bob         HEUR     324      319     98.5%
Child bob        LLM      108        0      0.0%  (using Q≥3)
                                    37     34.3%  (using verdict)
```

### Impact
The "70% failure rate" for phase sessions is largely comparing **heuristic-evaluated roots** against **LLM-evaluated children**. These are two different rubrics applied to two different session types.

---

## Finding 3: Duplicate Evaluations (100% of Pipeline Pairs)

### The Bug
When the evaluator processes a pipeline (parent with P1 and P2 children), it:
1. Sends ONE combined transcript to the LLM
2. The LLM outputs ONE score per **agent name** (not per session)
3. Since both P1 and P2 are `agent="bob"`, the code at line 763 overwrites: `result.agents[child.agent] = ...`
4. Both sessions get the IDENTICAL evaluation

### Evidence
```
Total pipeline P1/P2 pairs: 26
Pairs with identical evaluations: 26 (100%)
Pairs with identical quality scores: 26 (100%)
```

Every single pipeline pair has the exact same quality score, efficiency score, and issue text.

### Impact
Each pipeline task failure is counted TWICE (once for P1, once for P2), doubling the apparent failure count from ~26 to ~52+ failed sessions.

---

## Finding 4: The Real Gap (After Corrections)

### Fair Comparison (LLM-evaluated only, by verdict)

| Metric | Phase | Non-Phase | Gap |
|--------|-------|-----------|-----|
| Total sessions | 61 | 47 | — |
| "good" | 16 (26%) | 21 (45%) | -19pp |
| "acceptable" | 43 (70%) | 22 (47%) | +23pp |
| "needs_improvement" | 2 (3%) | 4 (9%) | +6pp |
| Avg quality | 0.76 | 0.78 | -0.02 |
| Avg efficiency | 0.59 | 0.65 | -0.06 |

**Phase sessions are slightly worse but NOT catastrophically so.** The average quality gap is only 0.02. The verdict gap is 19pp — significant but not alarming.

### Deduplicated Pipeline Results
After removing duplicate evaluations, the 61 "failed phase sessions" become:
- **32 unique pipeline tasks**
- **8 rated "good"** (25%)
- **~22 rated "acceptable"** (69%)
- **~2 rated "needs_improvement"** (6%)

---

## Finding 5: What's Actually Wrong with Phase Sessions

### Issue Categories (across 32 unique issue sets)

| Category | Frequency | Description |
|----------|-----------|-------------|
| FM-3.3 Verification gap | 81% (26/32) | Missing or weak post-edit verification |
| Phase boundary violation | 47% (15/32) | P1 writes files when told "DO NOT WRITE" |
| FM-2.6 Spec mismatch | 28% (9/32) | Wrong deliverable or missing required files |
| Ghost deliverable block | 25% (8/32) | finish() blocked for claimed-but-unwritten files |
| FM-1.3 Path guessing | 25% (8/32) | Wrong paths, failed greps |
| FM-3.1 Deliverable issues | 25% (8/32) | Claimed deliverables don't exist |
| P2 no work | 19% (6/32) | P2 has nothing to do because P1 did everything |

### Key Insight: Phase Structure Creates Unique Failure Modes

1. **Phase Boundary Violation (47%)**: The "DO NOT WRITE" instruction in P1 is frequently ignored. Bob reads the task, understands it, and just does it — because that's what Bob has been trained to do. The artificial constraint of "plan but don't execute" goes against the grain of the agent's training.

2. **P2 Has Nothing To Do (19%)**: When P1 ignores the boundary and writes files, P2 arrives to find the work already done. P2 then either: (a) does nothing and claims success → fails verification, or (b) re-does the work → wastes effort.

3. **Verification Is Harder Across Phases**: A single-phase session can verify its own work because it made the changes. In a two-phase pipeline, P2 may need to verify P1's work, but the evaluator expects P2 to produce evidence of its OWN actions.

### Non-Phase Sessions Have Similar Issues
The "acceptable" non-phase LLM-evaluated sessions show the SAME failure patterns:
- FM-3.3 verification gaps
- FM-3.1 ghost deliverable blocks  
- Path guessing / error chains
- Finish() blocked for missing evidence

The phase structure doesn't create NEW issue types — it just amplifies existing ones.

---

## Recommendations

### Immediate Fix: Scale Harmonization (Evaluator Bug)
**Priority: P0** — The 0-1 vs 1-5 scale mismatch makes ALL cross-method quality comparisons meaningless.

Options:
1. Update DOMAIN.md to use 1-5 scale (matching heuristic evaluator)
2. Update heuristic evaluator to use 0-1 scale
3. Normalize scores when saving to DB (multiply LLM scores by 5)

### Immediate Fix: Per-Session Evaluation for Pipelines
**Priority: P0** — The evaluator should key scores by **session ID**, not agent name. When multiple children share the same agent, they need individual evaluations.

Fix in evaluator.ts line 763: Change from `result.agents[child.agent]` to `result.agents[child.sessionId]` or similar.

### Phase Structure Improvements
**Priority: P1** — The 47% phase boundary violation rate suggests the two-phase structure needs rethinking:

1. **Option A**: Remove the "DO NOT WRITE" constraint — let P1 write, and P2 verifies/polishes
2. **Option B**: Enforce the boundary technically (make P1 read-only)
3. **Option C**: Abandon two-phase for simple tasks, only use phases for complex multi-step work

### Evaluation Fairness
**Priority: P1** — Consider applying the same evaluation method to all sessions, or calibrating the heuristic evaluator to be closer to LLM strictness. Currently, 98% of root sessions auto-pass while child sessions are held to a much higher standard.

---

## Data Appendix

### Raw Numbers
- Total bob sessions (7d): 432
- Heuristic-evaluated: 324 (all root, 99% "good")
- LLM-evaluated: 108 (all child)
  - Phase sessions: 61 (26% "good", 70% "acceptable")
  - Non-phase sessions: 47 (45% "good", 47% "acceptable")
- Pipeline pairs: 32 (26 with both P1 and P2)
- All 26 pairs have IDENTICAL evaluations (100%)
- Unique issue patterns: 32
