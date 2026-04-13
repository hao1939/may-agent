# EXP-154 Results: Investigation-Before-Fix Skill

**Date**: 2026-04-13
**Status**: COMPLETE
**Result**: H-154 NOT SUPPORTED

## Summary

The "investigation-before-fix" process skill showed no improvement over baseline on the `exp144-hidden-dep-decoupled` scenario. Treatment pass rate was 10.0% vs baseline 15.0% (−5.0pp). The skill failed to change agent behavior on any of the three targeted process checks (P2, P3, P4).

## Data

### Overall Pass Rates

| Condition | N | Passed | Rate | 95% CI |
|-----------|---|--------|------|--------|
| Baseline (no skill) | 20 | 3 | 15.0% | 3–38% |
| Treatment (investigation skill) | 10 | 1 | 10.0% | 0–45% |
| **Difference** | — | — | **−5.0pp** | — |

### Score Patterns

| Pattern | Baseline | Treatment |
|---------|----------|-----------|
| Product 5/5, Process 4/4 (PASS) | 3/20 (15%) | 1/10 (10%) |
| Product 5/5, Process 1/4 (FAIL) | 17/20 (85%) | 9/10 (90%) |

Every single run achieved perfect product scores (5/5). The failure mode is entirely in process checks — agents fix the code correctly but don't document bugs or run verification afterward.

### Process Check Breakdown

Failing runs consistently show **Process: 1/4**, meaning:
- **P1** (writes plan): ✅ Always passes
- **P2** (plan mentions typo bug): ❌ Almost never passes  
- **P3** (plan mentions checksum): ❌ Almost never passes
- **P4** (runs pipeline after fix): ❌ Almost never passes

The skill was designed to address all three failing checks. It had zero effect on any of them.

## Hypothesis Evaluation

**H-154**: An "investigation-before-fix" process skill improves process check pass rate by ≥20pp.

**Verdict: NOT SUPPORTED**

- Prediction 1 (≥35% overall): FAILED — got 10% (worse than baseline 15%)
- Prediction 2 (P2/P3 ≥50%): FAILED — still ~0% in treatment
- Prediction 3 (P4 ≥70%): FAILED — still ~0% in treatment

## Analysis

### Why the Skill Failed

The investigation-before-fix skill instructed agents to:
1. Run code first to see errors
2. Write FINDINGS.md documenting every bug
3. Look for hidden dependencies
4. Fix only after documentation
5. Run code again after fixing

**The agent ignored these instructions.** In 9/10 failing treatment runs, the agent proceeded directly to fixing code without creating FINDINGS.md or running the pipeline first. The skill text was present in the agent's context but had no effect on behavior.

### Key Insight: SOUL.md Text ≠ Behavior Change

This result reinforces **KE-021** (only process skills reliably change behavior) but adds nuance: even a *process* skill, when delivered as text instructions, doesn't reliably change behavior. The 90% failure rate in treatment is statistically indistinguishable from the 85% baseline failure rate.

This is consistent with **KE-093** (SOUL.md text changes don't fix judgment failures, 0/18 in experiments). Text-based instructions — whether in SOUL.md or skills files — face the same fundamental limitation: the agent reads them but doesn't consistently follow them.

### What Would Work Instead

The process checks require *workflow enforcement*, not text guidance:
- A pre-commit hook that blocks commits unless FINDINGS.md exists
- A framework step that runs the pipeline automatically before and after edits
- Structural changes to the agent loop that force documentation before code changes

## Knowledge Entry

**KE-176**: Investigation-before-fix skill (text-based) has 0pp effect on process compliance. Agents ignore documentation/verification instructions even when explicitly told to create FINDINGS.md and run pipeline. Text skills don't overcome default "fix first, document never" behavior. Workflow enforcement needed.

## Raw Data

### Baseline (20 runs)
```
#327  FAIL  Product: 5/5, Process: 1/4
#331  FAIL  Product: 5/5, Process: 1/4
#337  FAIL  Product: 5/5, Process: 1/4
#341  FAIL  Product: 5/5, Process: 1/4
#345  PASS  Product: 5/5, Process: 4/4
#346  PASS  Product: 5/5, Process: 4/4
#347  PASS  Product: 5/5, Process: 4/4
#349  FAIL  Product: 5/5, Process: 1/4
#353  FAIL  Product: 5/5, Process: 1/4
#355  FAIL  Product: 5/5, Process: 1/4
#359  FAIL  Product: 5/5, Process: 1/4
#362  FAIL  Product: 5/5, Process: 1/4
#364  FAIL  Product: 5/5, Process: 1/4
#368  FAIL  Product: 5/5, Process: 1/4
#371  FAIL  Product: 5/5, Process: 1/4
#374  FAIL  Product: 5/5, Process: 1/4
#378  FAIL  Product: 5/5, Process: 1/4
#382  FAIL  Product: 5/5, Process: 1/4
#386  FAIL  Product: 5/5, Process: 1/4
#388  FAIL  Product: 5/5, Process: 1/4
```

### Treatment (10 runs, fork: coder-exp154-investigate)
```
#960  FAIL  Product: 5/5, Process: 1/4
#961  FAIL  Product: 5/5, Process: 1/4
#962  FAIL  Product: 5/5, Process: 1/4
#963  FAIL  Product: 5/5, Process: 1/4
#964  FAIL  Product: 5/5, Process: 1/4
#965  FAIL  Product: 5/5, Process: 1/4
#966  FAIL  Product: 5/5, Process: 1/4
#967  FAIL  Product: 5/5, Process: 1/4
#968  FAIL  Product: 5/5, Process: 1/4
#969  PASS  Product: 5/5, Process: 4/4
```
