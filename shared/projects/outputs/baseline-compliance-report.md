# Baseline Compliance Report — Agent Convention Compliance

**Date**: 2026-07-28  
**Iteration**: 1 (first measurement)  
**Source**: Gym scenario runs (18 trials across 9 convention scenarios) + activity log audit

## Executive Summary

**Overall convention compliance: 44%** (15/34 convention checks passed across 9 scenarios × 2 trials)

The agent reliably completes product tasks (~85% product correctness) but systematically skips convention-required verification steps. The most critical gap is **verify-after-edit (C2.3) at 10% compliance** — the agent almost never reads back a file after editing it.

## Per-Convention Baseline

| Convention | Description | Pass Rate | Status |
|-----------|-------------|-----------|--------|
| C2.3 | Verify after edit (read back) | 1/10 (10%) | 🔴 Critical |
| C1 | Read before edit | 1/4 (25%) | 🔴 Critical |
| C40.1 | Promise before action | 0/2 (0%) | 🔴 Critical |
| C3 | Validation attempt | 3/8 (38%) | 🟡 Poor |
| C40.3 | Finish includes deliverables | 1/2 (50%) | 🟡 Poor |
| C2.1 | Plan before acting | 2/2 (100%) | 🟢 Good |
| C30 | Safe append (no overwrite) | 2/2 (100%) | 🟢 Good |
| Retry/Pivot | Pivot on failure, no repeated installs | 2/2 (100%) | 🟢 Good |

## Priority Interventions

Based on this baseline, the highest-ROI interventions are:

### 1. Fix C2.3 (verify-after-edit) — 10% → target 70%
- **Impact**: Most frequently tested convention, fails almost always
- **Root cause**: Agent has no habit of reading back edited files
- **Intervention**: Add to system prompt / conventions file, create fewshot examples

### 2. Fix C1 (read-before-edit) — 25% → target 70%  
- **Impact**: Agent edits files it hasn't read, risking data loss
- **Root cause**: Agent assumes file contents based on task description
- **Intervention**: Same as above — read→edit→verify cycle

### 3. Fix C40.1 (promise-before-action) — 0% → target 50%
- **Impact**: Agent doesn't announce what it will produce before doing it
- **Root cause**: Not in current conventions/prompts

## Data Gaps

1. **Activity logs lack tool-call detail** — cannot audit real production sessions for convention violations. Only gym scenarios provide ground truth.
2. **Limited convention coverage** — only 8 conventions are tested by gym scenarios. C1.7, C12.1, and others need scenarios.
3. **Small sample size** — 2 trials per scenario. Should increase to 5+ for statistical confidence.

## Next Steps

1. **P2 (Intervention)**: Add read→edit→verify cycle to agent conventions/system prompt
2. **Re-measure**: Run same 9 scenarios after intervention to measure improvement
3. **Expand coverage**: Create gym scenarios for untested conventions
4. **Add tool-call logging**: Enable per-call activity logging for production session auditing

## Raw Data References

- Gym results: `workspace/baseline-gym-results.md`
- Session audit: `workspace/session-audit.md`
