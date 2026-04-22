# EXP-195: Relational Bug Recognition Skill — Results

**Status**: COMPLETE
**Date**: 2026-04-22
**Cost**: ~$15 (30 gym trials × ~$0.50 each)

## Summary

A direct relational-bug hint raised cascading-fix-trap-v2 pass rate from **10% to 40%** (30pp improvement). Weaker interventions (file-based checklist, inline skill) showed 0% — only the most explicit hint worked. The baseline has shifted from historical 0% (EXP-177, N=40) to 10% (N=10), suggesting model improvement since April 19.

## Arms & Results

### Arm A: Baseline (no intervention)
Scenario: `cascading-fix-trap-v2` (original)

| Trial | Result | Failed Checks | Duration |
|-------|--------|---------------|----------|
| 1 | ❌ FAIL | pipeline-order-fixed | 110s |
| 2 | ❌ FAIL | pipeline-order-fixed | 234s |
| 3 | ❌ FAIL | pipeline-order-fixed | 63s |
| 4 | ✅ PASS | — | 205s |
| 5 | ❌ FAIL | pipeline-order-fixed | 202s |
| 6 | ❌ FAIL | pipeline-order-fixed | 251s |
| 7 | ❌ FAIL | pipeline-order-fixed + 3 others | 237s |
| 8 | ❌ FAIL | pipeline-order-fixed | 121s |
| 9 | ❌ FAIL | pipeline-order-fixed | 167s |
| 10 | ❌ FAIL | pipeline-order-fixed + 3 others | 198s |

**Pass rate: 1/10 (10%)** — 95% CI: 0.3–44.5% (Wilson)

### Arm B: File-based skill checklist
Scenario: `cascading-fix-trap-v2-exp195-skill` (RELATIONAL_BUG_CHECKLIST.md in env, task says "read it first")

| Trial | Result | Failed Checks | Duration |
|-------|--------|---------------|----------|
| 1 | ❌ FAIL | pipeline-order-fixed | 107s |
| 2 | ❌ FAIL | pipeline-order-fixed | 78s |
| 3 | ❌ FAIL | pipeline-order-fixed | 177s |

**Pass rate: 0/3 (0%)** — too small N for conclusions, but no signal

### Arm C: Inline skill in task text
Scenario: `cascading-fix-trap-v2-exp195-inline` (skill checklist embedded directly in task.md)

| Trial | Result | Failed Checks | Duration |
|-------|--------|---------------|----------|
| 1 | ❌ FAIL | pipeline-order-fixed | 36s |
| 2 | ❌ FAIL | pipeline-order-fixed | 176s |
| 3 | ❌ FAIL | pipeline-order-fixed | 160s |

**Pass rate: 0/3 (0%)** — no signal from general skill language

### Arm D: Direct hint (near-explicit bug description)
Scenario: `cascading-fix-trap-v2-exp195-direct` (task says "applyPenalties and normalize may be in wrong order in pipeline.js")

| Trial | Result | Failed Checks | Duration |
|-------|--------|---------------|----------|
| 1 | ❌ FAIL | pipeline-order-fixed | 201s |
| 2 | ❌ FAIL | pipeline-order-fixed | 146s |
| 3 | ❌ FAIL | pipeline-order-fixed | 167s |
| 4 | ✅ PASS | — | 145s |
| 5 | ❌ FAIL | pipeline-order-fixed | 267s |
| 6 | ✅ PASS | — | 266s |
| 7 | ✅ PASS | — | 299s |
| 8 | ❌ FAIL | pipeline-order-fixed | 172s |
| 9 | ✅ PASS | — | 298s |
| 10 | — | (not run — counted trial 4 --keep) | — |

**Pass rate: 4/10 (40%)** — 95% CI: 12.2–73.8% (Wilson)

## Analysis

### Effect size: Direct hint vs Baseline

| Metric | Baseline | Direct Hint | Difference |
|--------|----------|-------------|------------|
| Pass rate | 10% (1/10) | 40% (4/10) | **+30pp** |
| 95% CI | 0.3–44.5% | 12.2–73.8% | — |

Fisher's exact test (one-tailed): p = 0.152. Not statistically significant at α=0.05 with N=10 per arm, but the effect direction is consistent and the magnitude (30pp) is practically meaningful.

### Why weaker interventions failed

The file-based skill (Arm B) and inline skill (Arm C) both showed 0/3 — identical to the historical baseline. This is consistent with EXP-177's finding that general hints and checklists don't help. The agent needs:
- **Specificity**: Not "check ordering" but "check if applyPenalties and normalize are in the right order"
- **Concreteness**: Not "trace data flow" but "penalties should be applied to RAW scores before normalization"

General relational-reasoning skills are too abstract. The agent already "knows" how to reason about ordering — the problem is it doesn't apply that reasoning to the specific pipeline steps unless explicitly directed.

### Baseline shift from historical 0%

EXP-177 found 0/40 (0%) on cascading-fix-trap-v2. We observed 1/10 (10%). Possible explanations:
1. Model updates since April 19 (most likely — 3 days of potential model changes)
2. Different agent configuration (amy vs whatever EXP-177 used)
3. Random variation (1/10 is consistent with a ~5% true rate given small N)

### H-195 adjudication

**H-195 (skill raises pass rate from 0% to ≥33%)**: **PARTIALLY CONFIRMED**
- The *generic* relational-bug skill (Arms B, C) does NOT work: 0/6 combined
- The *direct* hint (Arm D) works: 40% pass rate, exceeding the 33% threshold
- However, the "skill" that works is really a near-explicit bug description, not a transferable reasoning strategy

### Implications for prove-the-loop

The result is **encouraging but not yet proof of the loop**:
1. ✅ We CAN move the needle on a 0% scenario with a targeted intervention
2. ❌ The intervention that works is scenario-specific (tells the agent exactly what to look for), not a generalizable skill
3. 🔄 Next step: design a skill that teaches the agent to DISCOVER ordering bugs on its own (not just follow explicit directions)

The gap between "general checklist" (0%) and "direct hint" (40%) suggests the bottleneck is **bug discovery**, not **bug fixing**. The agent can fix ordering bugs when told about them — it just can't find them independently.

## Verdict

**H-195**: PARTIALLY CONFIRMED — direct hints work (40% vs 10%), general skills don't (0% vs 10%)

**prove-the-loop M1 (identify skill gap)**: ✅ CONFIRMED — relational bug blindness is real and measurable
**prove-the-loop M2 (validate gap is real)**: ✅ CONFIRMED — persists across EXP-177 (N=40) and EXP-195 baseline (N=10)
**prove-the-loop M3 (design intervention)**: ⚠️ PARTIAL — direct hint works but isn't a transferable skill yet

## Follow-ups

- **EXP-196**: Test whether a "discovery-focused" skill works — instead of telling the agent WHAT the bug is, teach it HOW to systematically discover ordering bugs (e.g., "after fixing value bugs, swap every adjacent pair of pipeline steps and check if tests improve")
- **Expand Arm D to N=20** for statistical significance
- **Test on other relational scenarios**: ghost-dependency-debug, multi-bug-pivot to check skill transfer
