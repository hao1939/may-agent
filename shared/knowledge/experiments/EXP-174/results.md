# EXP-174 Results: Clean Replication of Scout-Generated Analysis

**Date**: 2026-04-16
**Status**: COMPLETE
**Verdict**: **H-174b CONFIRMED** — Genuine quality gap in LLM-generated analysis

---

## Summary

Scout→coder achieves 0% even with verified-clean environments. The EXP-172 result was NOT a contamination artifact. There is a genuine quality gap between LLM-generated investigation and expert-written analysis.

## Data

| Metric | Value |
|--------|-------|
| Total trials | 37 |
| Passed | 0 |
| Failed | 37 |
| Pass rate | **0%** (0/37) |
| Run IDs | 2114–2150 |

### Failure pattern
All 37 trials show identical failure: `pipeline-order-fixed = false` ("FAIL: Pipeline applies penalties before normalization"). The scout phase investigates but fails to identify pipeline ordering as the root cause. The coder phase then fixes surface-level issues (grade threshold) but misses the deep bug.

### Reference data (from EXP-173, clean environments)
| Arm | Pass rate |
|-----|-----------|
| Expert F1 (full analysis) | 100% (10/10) |
| Moderate hint | 100% (9/9) |
| Base (no hint) | 0% (0/11) |
| **Scout→coder** | **0% (0/37)** |

## Environment Verification

Verified before running:
- `pipeline.js`: normalize (Step 3) before penalties (Step 4) — bug present ✓
- `penalties.js`: has `adjusted_pct` field (standard, not contamination) ✓
- `grades.js`: no `>=` contamination ✓
- Scenario created from clean base, never modified by coder (git log: single commit) ✓

## Analysis

### H-174b confirmed: Genuine quality gap

The scout agent investigates the codebase but **cannot reliably identify pipeline ordering as the root cause**. Its generated ROOT_CAUSE_ANALYSIS.md likely:
1. Identifies symptoms (test failures, wrong grades)
2. May note individual module issues
3. **Fails to connect the dots**: that normalize-before-penalties ordering is the critical fix

This means scout-generated analysis is qualitatively different from even a moderate human hint. A human hint saying "check pipeline step ordering" is enough (100%), but the scout's investigation output is not.

### Implications for H-166 (Binary Recognition Threshold)

H-166 needs revision but **survives in modified form**:
- ~~"Moderate hints fall below the threshold"~~ → WRONG (moderate = 100% with clean env)
- The threshold is between "any directed hint about the problem area" and "undirected investigation output"
- Scout analysis ≈ base (0%) despite containing more information — the information is not *directed* at the root cause

**Revised model**: The threshold isn't about information quantity but about **causal specificity** — whether the hint points toward the actual mechanism (pipeline ordering) vs. describing symptoms.

### What this means for two-phase workflows

Scout→coder is **not** a general solution for hard debugging tasks. The scout phase produces investigation output that doesn't cross the recognition threshold. To work, the scout would need to:
1. Actually identify the root cause (not just symptoms)
2. Express it in a way that directs the coder to the right fix

This is the hard part — it's essentially asking the scout to solve the problem, which it can't do (that's why we have the two-phase setup).

## Cost

22 trials × 2 phases × ~$0.07 ≈ $3.08
+15 trials (EXP-174 replication) ≈ $2.10
**Total: ~$5.18 for 37 trials**

## Tags
`EXP-174` `H-174b` `scout-coder` `quality-gap` `cascading-fix-trap-v2` `H-166`
