# Gym-as-Fast-Feedback: Design for Optimizer

**Date:** 2026-04-16 | **Author:** Optimizer | **Status:** Draft

---

## 1. How Gym Gives Signal on Optimizer Metrics

| Metric | Gym approach |
|--------|-------------|
| **tool-adoption** | Can't measure directly in gym (adoption = production agents using tools). But gym CAN validate the tools themselves work — run workflow scenarios to confirm workflows produce correct outputs. If a workflow fails in gym, agents won't adopt it. |
| **analysis-accuracy** | Create scenarios where the agent must analyze a codebase problem and produce a correct finding. Score = did the analysis identify the real root cause? Scenarios like `misleading-stacktrace`, `conflicting-evidence`, `cascading-error` already test this. Run optimizer through them. |
| **quality-preserved** | Run a battery of existing scenarios before/after optimizer changes. If pass rate drops, optimizer broke something. This is a regression gate, not a direct measurement. |

**Key insight:** Gym is best for analysis-accuracy (direct signal) and quality-preserved (regression gate). Tool-adoption requires production data — gym can only validate tools work, not that agents use them.

## 2. Relevant Gym Scenarios for Tool & Workflow Builder

**Directly relevant (workflow scenarios):**
- `*-workflow` scenarios (20+ exist) — test whether workflows structure work correctly
- `investigate-fix-pattern-workflow` — core optimizer pattern
- `cascading-error-workflow` — multi-step diagnosis
- `efficient-file-reading-workflow` — tool usage efficiency
- `materialized-intermediate-findings-workflow` — analysis quality

**Indirectly relevant (analysis/judgment):**
- `misleading-stacktrace`, `misleading-test-fix` — root cause accuracy
- `conflicting-evidence` — handling ambiguity
- `approach-validation-trap` — avoiding premature conclusions
- `assertion-without-evidence` — evidence quality

**Gap:** No scenarios specifically test "did the agent use the available workflow/tool?" — this would directly measure adoption in a controlled setting.

## 3. How Gym Results Feed Into Metrics

```
gym run (10 trials, ~20 min)
    ↓
pass/fail per scenario
    ↓
Map to metric:
  - analysis scenarios pass rate → optimizer.analysis-accuracy proxy
  - workflow scenarios pass rate → tool quality signal
  - full battery delta → optimizer.quality-preserved regression check
```

**Concrete integration:**
- After building/changing a workflow: run relevant workflow scenarios, require ≥ prior pass rate
- Weekly: run optimizer through 10-15 analysis scenarios, record pass rate as analysis-accuracy gym proxy
- Before deploying harness changes: run full battery sample (30 scenarios), compare to baseline

## 4. The 295 Scenarios at 36% Pass Rate Problem

36% pass rate means most scenarios are either too hard or poorly calibrated. Recommendations:

1. **Triage into tiers** — Tag scenarios as `tier:core` (must pass), `tier:stretch` (aspirational), `tier:broken` (needs scenario fix). Focus on core tier pass rate.
2. **Distinguish scenario bugs from agent bugs** — Some failures are bad scenarios, not bad agents. Run top agents through failing scenarios; if ALL fail, the scenario likely needs fixing.
3. **Target 70% on core tier** — A healthy core tier at 70%+ gives meaningful signal. The stretch tier drives improvement without demoralizing.
4. **Don't chase 100%** — Some scenarios test edge cases that aren't worth optimizing for. Goodhart's Law applies here too.
5. **Prune duplicates** — 325 scenarios likely has redundancy (e.g., `ambiguous-context-drift` has 8+ variants). Consolidate to ~150 high-discrimination scenarios.

## 5. Fast Feedback Loop for Optimizer

```
Optimizer builds/changes something (workflow, tool, harness rule)
    ↓ immediate (5 min)
Run 3-5 targeted gym scenarios that exercise the change
    ↓ pass? 
Deploy to production
    ↓ 24h
Check production metrics (did agents actually use it? did quality hold?)
    ↓ 48-72h  
Evaluate with real session data (analysis-accuracy, tool-adoption trends)
```

**What makes this fast vs current approach:**
- **Current:** Build → deploy → wait 2-3 days → check if it worked → iterate
- **With gym:** Build → gym validates in 20 min → deploy with confidence → production confirms

**Specific gym rituals for optimizer:**
1. **Pre-deploy check:** Before any harness/workflow change, run 5 workflow scenarios. Takes ~10 min.
2. **Weekly analysis battery:** Run 15 analysis scenarios, track trend. Catches drift.
3. **New tool validation:** When building a new workflow, create a matching gym scenario FIRST (test-driven), then build the workflow to pass it.

---

*Total: gym gives fast validation (minutes), production gives real adoption signal (days). Use both.*
