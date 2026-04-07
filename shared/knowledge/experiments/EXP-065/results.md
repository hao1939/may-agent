# EXP-065: Production-Gym Gap Analysis — Results

**Date**: 2026-04-07
**Author**: Coach
**Status**: COMPLETE
**Tags**: gym, production, gap-analysis, failure-modes, architecture

## Summary

Analyzed 893 error log entries across 3 agents (Coach: 449, Optimizer: 302, Coder: 142) and mapped the top 10 production failure modes against gym coverage. **The gym-production gap is structural, not behavioral.** The model's capabilities are identical in both settings — production fails because production is harder.

## Key Findings

### 1. Gym Saturation
25/26 gym scenarios at ceiling (96.2%). Skills have zero measurable effect (EXP-041b, EXP-061).

### 2. Production Failure Frequency

| Rank | FM Code | Count | Description | Gym Coverage |
|------|---------|-------|-------------|--------------|
| 1 | FM-3.3 | 165 | Verification gaps | PARTIAL — 6 scenarios, all ceiling |
| 2 | FM-2.1 | 144 | Tool misuse/hallucination | PARTIAL — 3 scenarios, all ceiling |
| 3 | FM-2.2 | 141 | Slippery edit acceptance | WEAK — 1 scenario, ceiling |
| 4 | FM-1.1 | 73 | Process misalignment | WEAK — 2 scenarios, ceiling |
| 5 | FM-2.4 | 53 | Path/environment assumptions | WEAK — 2 scenarios, ceiling |
| 6 | FM-2.6 | 50 | Reasoning-action mismatch | **NONE — 0 scenarios** |
| 7 | FM-1.3 | 49 | Looping/thrashing | WEAK — 2 scenarios, ceiling |
| 8 | FM-1.4 | 50 | Unresolved failure chains | NONE — 0 scenarios |
| 9 | FM-3.2 | 34 | Infrastructure/scoring confusion | N/A (meta-failure) |
| 10 | FM-3.1 | 33 | Ghost deliverables | NONE — 0 scenarios |

### 3. Three Structural Gaps

**Gap 1 — Context Scale**: Production has 11,229 files and 17,000+ sessions. Gym has 3-12 files and no history. This causes FM-1.3 (looping), FM-2.4 (path assumptions), FM-2.1 (tool hallucination).

**Gap 2 — Instruction Complexity**: Production tasks arrive embedded in multi-page context with stale references, competing priorities, and checkpoint data. Gym has clean 5-20 line task.md files. This causes FM-2.6 (instruction drift), FM-1.1 (process misalignment), FM-3.1 (ghost deliverables).

**Gap 3 — Compound Verification**: Production tasks require editing 3-5 interdependent files. Gym scenarios typically have 1-3 independent files. This causes FM-3.3 (verification gaps) and FM-2.2 (slippery edit acceptance).

### 4. Architecture-Limited Gaps (Cannot Test in Current Gym)

| Gap | Why Untestable | Impact |
|-----|----------------|--------|
| Tool hallucination (FM-2.1, 144 entries) | Gym uses same tool surface as production | Cannot present unfamiliar tools |
| Stale session context (FM-2.6) | Gym runner doesn't inject fake checkpoints/history | Cannot simulate context accumulation |
| Multi-session drift | Gym supports 2-3 phases, not 10+ session chains | Cannot test gradual context degradation |
| Ghost deliverables (FM-3.1) | Requires finish() infrastructure changes | Cannot test empty-success patterns |

### 5. New Scenarios Built — ALL CEILING

Three FM-2.6 scenarios designed and tested:
- `instruction-noise-compliance`: 6/6 CEILING
- `scope-creep-resistance`: 3/3 CEILING
- `stale-plan-compliance`: 3/3 CEILING

**Why all ceiling**: Production FM-2.6 requires multi-session context accumulation, competing SOUL.md priors, and cognitive load from extended work — none replicable in fresh single-session gym runs.

## Implications

1. **96% gym ceiling ≠ 96% production success.** Gym tests isolated competencies; production requires combining them under noise, scale, and time pressure.
2. **Three failure modes have zero gym coverage**: FM-2.6 (50 entries), FM-1.4 (50), FM-3.1 (33) = 133 entries (14.9% of errors).
3. **Most promising next direction**: Compound-edit-verification for FM-3.3 (tested in EXP-066 — also ceiling), and framework-level enforcement for C2.3.
4. **Gym graduation recommended**: With 96% ceiling, gym's primary value is as a regression suite, not a training tool.

## Source
Full analysis with methodology: `agents/coach/workspace/experiments/EXP-065/analysis.md`
