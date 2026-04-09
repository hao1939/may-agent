# KE-107: FM-3.3 Gym-Production Gap Quantified — 10× Difference Driven by Context Complexity

**Date**: 2026-04-09 (updated with Wave 2 multi-session results)  
**Source**: EXP-107 (Adversarial Self-Check at Decision Boundary — Control Arm + Wave 2)  
**Confidence**: HIGH  
**Extends**: KE-053 (Gym-Production Gap), KE-106 (Structural Enforcement Does Not Train Behavior)  

## Core Finding

**The current coder agent achieves a 6.25% FM-3.3 attempt rate in single-session gym scenarios and 0% in multi-session scenarios versus 50–70% in production — a ~10× gap.** This is the first experiment to directly measure FM-3.3 rates in controlled gym conditions and compare them to production rates documented in KE-106.

The implication: **production FM-3.3 is driven by factors absent from gym testing — context complexity, multi-session fatigue, time pressure, and ambiguous verification targets — not by missing verification awareness.**

## Evidence

### Wave 1: EXP-107 Control Arm (N=12 runs, 4 single-session scenarios × 3 reps)

| Metric | Gym (EXP-107) | Production (KE-106) |
|--------|--------------|---------------------|
| FM-3.3 attempt rate | 6.25% (1/16 finish calls) | 50–70% |
| First-try success rate | 91.7% | ~30–50% (estimated) |
| Mean task ops | 13.7 | 40–100+ |

### Wave 2: Multi-Session Context-Fatigue Scenario (N=5 runs)

A dedicated multi-session scenario (`context-fatigue-verification`) was designed with all five production FM-3.3 drivers: context accumulation, ambiguous verification, time pressure, scope creep (7 subtasks across 4 files), and multiple files to verify.

| Metric | Wave 2 Result |
|--------|---------------|
| FM-3.3 attempt rate | **0% (0/5)** |
| Product pass rate | 100% (5/5) |
| All files verified before finish | 100% (5/5) |
| Mean duration | ~209s |

**Even with production-like stressors, the multi-session scenario showed LOWER FM-3.3 than single-session scenarios.** The agent reliably re-reads all 4 edited files before calling finish() in every run.

### Combined (Wave 1 + Wave 2)

| Wave | Scenarios | Runs | FM-3.3 Rate | Product Pass |
|------|-----------|------|-------------|--------------|
| Wave 1 (single-session) | 4 | 12 | 6.25% (1/16) | 91.7% |
| Wave 2 (multi-session) | 1 | 5 | 0% (0/5) | 100% |
| **Combined** | **5** | **17** | **4.8% (1/21)** | **94.1%** |

### Per-Scenario Gym Results

| Scenario | FM-3.3 Rate | Notes |
|----------|-------------|-------|
| verify-before-finish | 0% (0/3) | Simple, focused |
| compound-edit-verification | 0% (0/3) | Multi-file but bounded |
| multi-file-verify-gap | 0% (0/3) | Designed to test gap, still 0% |
| convention-verify-edit | 14.3% (1/7) | Hardest scenario, closest to production |

### Why Gym FM-3.3 Is Low

1. **Skill stack**: `verify-after-edit`, `investigate-and-fix`, and `know-when-blocked` teach verification — effective in the clean gym environment
2. **Task simplicity**: Gym tasks are focused (1–2 files, clear criteria) vs production (multiple files, ambiguous scope)
3. **Fresh context**: Each gym run starts clean — no accumulated context fatigue
4. **Short sessions**: Mean 13.7 ops vs 40–100+ in production — fewer opportunities to skip verification

## Implications

1. **Gym-based FM-3.3 interventions likely won't transfer to production.** The mechanisms that cause FM-3.3 in production (context overload, time pressure, ambiguous verification targets) are absent from gym testing.

2. **EXP-107 Arms B/C/D are not viable.** With only 6.25% baseline FM-3.3, treatment effects cannot be measured without ~720 runs (~$216). The experiment was correctly blocked per design §9.

3. **Future FM-3.3 work should target production conditions:**
   - Longer multi-session scenarios with accumulated context
   - Tasks with ambiguous verification criteria ("is the fix really correct?")
   - Time-pressure framing ("critical production issue")
   - Or direct production A/B testing

4. **Strengthens KE-053**: The gym-production gap is real and quantified for the #1 failure mode. Gym is a regression suite, not a training ground for production-frequency failures.

## Relationship to Other Findings

- **KE-106**: Showed the finish guard doesn't reduce FM-3.3 attempt rate (structural enforcement ≠ behavior training). EXP-107 adds: the gym environment itself suppresses FM-3.3, so gym-based interventions are doubly unlikely to help in production.
- **KE-053**: Predicted this finding conceptually. EXP-107 provides the first hard numbers.
- **KE-091**: Forced verification harms high-complexity tasks (alignment tax). Combined with this finding: verification interventions should be targeted, not universal.
