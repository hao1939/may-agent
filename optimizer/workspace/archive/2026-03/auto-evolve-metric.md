# Auto-Evolve Metric Specification

**Owner**: Optimizer
**Date**: 2026-03-25
**Status**: ACTIVE — ready to analyze results when they arrive

---

## Primary Metric: Gym Pass Rate

**Definition**: `checks_passed / total_checks` across all smoke-tier scenarios.

This is the single number that determines whether a SOUL.md variation is better than the baseline — analogous to `val_bpb` in autoresearch (lower = better there, higher = better here).

### Current Baseline (binary 37b8fbb, 2026-03-25)

| Metric | Value |
|--------|-------|
| Scenarios passed | 11/13 (85%) |
| Scenarios failed | behavior-escalation-stubborn (0%), conflicting-evidence (0%) |
| Scenarios flaky | optimize-deploy-config (67%) |

### How to Compute

For each gym run, `gym-baseline.sh` outputs per-scenario pass/fail. The metric is:

```
pass_rate = (scenarios where ALL checks pass) / (total scenarios)
```

For finer granularity (when scenario-level is too coarse):

```
check_rate = (individual checks passed) / (total individual checks)
```

**Use scenario-level for the main comparison.** Check-level is supplementary for understanding partial improvements.

---

## Statistical Significance with Small N

With 13 smoke scenarios, we have limited statistical power. Here's the practical guide:

### Scenario-Level Changes

| Delta | Meaning | Confidence |
|-------|---------|------------|
| +0 scenarios | No improvement | — |
| +1 scenario (85% → 92%) | One previously-failing scenario now passes | **Low** — could be stochastic. Needs 3 confirmatory runs. |
| +2 scenarios (85% → 100%) | Two previously-failing scenarios pass | **Medium** — unlikely to be noise. Run 2 confirmatory runs. |
| -1 scenario (85% → 77%) | Regression | **Concerning** — check if a GREEN scenario went RED. |

### Why 1 Scenario Flip Is Unreliable

Gym scenarios are stochastic — the same agent with the same SOUL.md can pass or fail on the same scenario across runs. Evidence:
- `optimize-deploy-config`: 67% pass rate (2/3 runs pass) on baseline
- Most scenarios have only 2-4 runs in baseline data

**Rule of thumb**: A variation must show improvement in **at least 2 out of 3 runs** on a previously-failing scenario to count as a real improvement.

### Recommended Testing Protocol

For each variation:
1. Run `gym-baseline.sh --tier smoke --agent coder` **3 times**
2. Record per-scenario results for each run
3. A scenario "passes" for this variation if it passes in **≥2 of 3 runs**
4. Compare to baseline pass pattern

**Cost**: 3 runs × 13 scenarios × ~$0.10/scenario ≈ $3.90 per variation.
For 5 variations + baseline = 6 × $3.90 = **~$23.40 total**.

If budget is tight, run each variation once, then only re-run variations that show ≥1 scenario improvement.

---

## Secondary Metrics (Track But Don't Optimize Yet)

### 1. Check-Level Pass Rate
```
check_rate = sum(checks_passed per scenario) / sum(total_checks per scenario)
```
More granular — catches partial improvements (e.g., going from 2/4 to 3/4 checks in behavior-escalation-stubborn without fully passing).

### 2. Total Tool Calls (Ops Count)
```
efficiency = total_tool_calls_across_all_scenarios / scenarios_run
```
Lower is better. If a variation achieves the same pass rate with fewer ops, it's more cost-efficient. But don't trade pass rate for efficiency.

### 3. Regression Count
```
regressions = scenarios that PASSED in baseline but FAILED in variation
```
**This is a veto metric.** If a variation causes ANY regression (a GREEN scenario goes RED), it should be rejected unless the improvements clearly outweigh the regression (e.g., +2 scenarios gained, -1 lost).

---

## Analysis Template (for when results arrive)

When results land at `agents/coach/workspace/auto-evolve/results.md`, analyze as follows:

### Step 1: Compute Delta Table

| Variation | Pass Rate | Delta vs Baseline | Regressions | Verdict |
|-----------|-----------|-------------------|-------------|---------|
| baseline | 11/13 | — | — | — |
| v01-escalation-awareness | ?/13 | ? | ? | ? |
| v02-multi-source-reconciliation | ?/13 | ? | ? | ? |
| v03-explicit-json-validation | ?/13 | ? | ? | ? |
| v04-combined-escalation-config | ?/13 | ? | ? | ? |
| v05-act-dont-ask-reframe | ?/13 | ? | ? | ? |

### Step 2: Check for Regressions
For each variation, verify no GREEN scenarios went RED. If yes → **REJECT** (unless net +2 or more).

### Step 3: Identify Best Variation
- Sort by pass rate (descending)
- Break ties by: fewer regressions > fewer total ops > simpler diff
- If multiple variations improve different scenarios, consider combining (that's v04's purpose)

### Step 4: Statistical Confidence
- If best variation is +1 scenario: **re-run 3 times** before declaring winner
- If best variation is +2 scenarios: **re-run 2 times** to confirm
- If no variation improves: log what was tried, suggest different approaches for next cycle

### Step 5: Final Recommendation
Either:
- **ADOPT**: Apply the winning variation to coder's SOUL.md (requires 2/3 confirmatory runs)
- **COMBINE**: Merge best ideas from multiple variations (requires new test cycle)
- **REJECT ALL**: None improved; document hypotheses that were disproven

---

## Experiment-Specific Notes

### Known Failure Targets

The 5 variations target 3 specific failing scenarios:

| Scenario | Checks | Current | Variations Targeting |
|----------|--------|---------|---------------------|
| behavior-escalation-stubborn | 4 | 0% (0/4) | v01, v04, v05 |
| conflicting-evidence | 7 | 0% (0/7) | v02, v04 |
| convention-verify-edit* | 5 | 80% (4/5) | v03, v04 |

*Note: `convention-verify-edit` doesn't appear in the smoke tier listing I see (13 scenarios). The experiment plan mentions it but it may be in a different tier. Verify when results come in.

### What "Success" Looks Like

- **Best case**: v04 (combined) passes all 3 targeted scenarios → 13/13 (100%)
- **Good case**: Any variation fixes 1+ targeted scenario without regressions → 12/13 (92%)
- **Expected case**: Some check-level improvement but not full scenario pass → still 11/13 but with higher check_rate
- **Worst case**: No improvement or regressions → learn what doesn't work, try different approach

---

## How This Connects to Autoresearch

The auto-evolve workflow mirrors Karpathy's autoresearch pattern:
- **Autoresearch**: Generate code variations → evaluate on val_bpb → select best → iterate
- **Auto-evolve**: Generate SOUL.md variations → evaluate on gym pass rate → select best → iterate

Key difference: our eval is cheaper ($0.10/scenario) but noisier (stochastic LLM behavior). Autoresearch can run deterministic evals. We compensate by running multiple times per variation.

The metric (gym pass rate) is intentionally simple — one number, easy to compare. If we later want richer signals, we add secondary metrics (ops count, check-level rate) without changing the primary comparison.
