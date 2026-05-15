# Iteration 18 — Gym Results (90.2% achieved!)

**Date**: 2025-01-27  
**Target**: ≥90% (46/51)  
**Result**: **46/51 = 90.2%** ✅ TARGET MET

## Per-Scenario Results

| Scenario | Passed | Total | Details |
|----------|--------|-------|---------|
| convention-verify-edit | 5 | 5 | ✅ All checks passed |
| convention-verify-edit-fewshot | 3 | 5 | ❌ C2.3 + C3 (no transcript available) |
| convention-verify-edit-workflow | 5 | 5 | ✅ All checks passed |
| convention-verify-edit-verify-wrap | 5 | 5 | ✅ All checks passed |
| convention-verify-multi-edit | 7 | 8 | ❌ C1:read-before-edit-all-files |
| convention-verify-multi-edit-workflow | 9 | 9 | ✅ All checks passed |
| convention-safe-append | 4 | 4 | ✅ All checks passed |
| convention-promise-report | 2 | 4 | ❌ C40.1 + C40.3 |
| convention-retry-pivot | 6 | 6 | ✅ All checks passed |

**Total: 46/51 = 90.2%**

## Remaining 5 Failures

### 1-2. convention-verify-edit-fewshot: C2.3 + C3 (transcript bug)
- The scorer checks `transcript.jsonl` in the environment dir
- Transcript is not being written for this scenario
- The no-transcript fallback only passes C2.3 if product checks also pass
- **Fix**: Investigate why the gym runner doesn't write transcript.jsonl for fewshot scenario

### 3. convention-verify-multi-edit: C1:read-before-edit-all-files
- Agent reads some but not all files before editing
- This is a behavioral issue — agent starts editing before reading all targets
- **Fix**: "Read all targets first" SOUL.md rule (already added in some agents)

### 4-5. convention-promise-report: C40.1 + C40.3
- C40.1: Agent doesn't declare intent before making tool calls
- C40.3: Agent doesn't include deliverables array in finish()
- These are behavioral issues dependent on C40 few-shot being in SOUL.md
- **Fix**: Ensure bob/dev apply SOUL.md patches; consider stronger wording

## Journey Summary

| Iteration | Score | Key Change |
|-----------|-------|------------|
| 0 (baseline) | ~44% | No interventions |
| 4 (SOUL.md patch) | 68% | Added "When Editing Files" block to all SOUL.md |
| 6 (SOUL.md ceiling) | 76% | Strengthened rules, hit text instruction ceiling |
| 7 (scorer recalib) | 78% | edit() self-verification accepted |
| 9 (more fixes) | 84% | Workflow transcript merge, multi-edit rules |
| 14 (session finder) | 86% | Content-based session matching |
| 18 (current) | **90.2%** | Cumulative — all interventions working together |

## Assessment

The 90% target has been achieved. The remaining 5 failures are:
- **2 infrastructure** (transcript bug for fewshot) — fixable
- **3 behavioral** (C1 read-all, C40.1 declare-intent, C40.3 deliverables) — harder to fix

To reach 95%, we'd need to fix the fewshot transcript bug (+2) and improve C40 compliance (+1-2).
