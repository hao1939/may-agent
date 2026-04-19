# EXP-066: Compound Edit Verification — Baseline Results

## Experiment
**Question**: Does the compound-edit-verification scenario (tiered tax refactor with hidden dependency chain) trap current agents?

**Scenario**: `agents/gym/scenarios/compound-edit-verification/`
- 4 source files: pricing.js, invoice.js, discount.js, formatter.js
- Hidden dependency: pricing.js `TAX_RATE` constant consumed by discount.js and formatter.js
- Task: refactor flat 8% rate → tiered rates (5%/8%/10% by amount)
- Trap: naive fix to pricing.js alone leaves stale TAX_RATE in consumers
- 7 success criteria: P1-P6 product + C2.3 behavioral

**Prior validation** (manual):
- Unmodified code: 3/7
- Naive fix (pricing.js only): 4/7
- Correct fix (all files): 7/7

## Baseline Runs

| Run | Agent | Score | P1 | P2 | P3 | P4 | P5 | P6 | C2.3 | Duration | Session |
|-----|-------|-------|----|----|----|----|----|----|----|----------|---------|
| 1   | coder | 7/7 ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 82s | s_1775574175847_0 |
| 2   | coder | 7/7 ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 79s | s_1775574263429_0 |
| 3   | coder | 7/7 ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 83s | s_1775574348569_0 |

## Verdict: CEILING ❌

**3/3 runs pass (100%)** — scenario is ceiling. Current coder agent successfully traces the dependency chain from pricing.js → discount.js + formatter.js and fixes all files in every run.

## Analysis

**Why ceiling**: The dependency chain is discoverable through:
1. The integration tests explicitly test cross-module behavior, giving the agent a clear signal when something is broken
2. `TAX_RATE` is imported/required explicitly — `grep` or reading imports reveals the dependency trivially
3. The task.md hints at "tiered rates" which makes the agent think about all rate-consuming code

**What would make it non-ceiling**:
- Remove or weaken integration tests (so the agent doesn't get failure signals)
- Make the dependency implicit (e.g., shared global state instead of explicit imports)
- Add more files so the signal-to-noise ratio drops
- Use a runtime dependency that doesn't appear in static analysis (e.g., database lookup, config file)

## Implications for Research

This scenario joins the growing list of ceiling scenarios. The pattern: **if tests exist that catch the bug, agents run the tests and fix accordingly**. The compound verification challenge only manifests when:
1. No tests cover the cross-module interaction, OR
2. The dependency is implicit/runtime rather than static/import-based

For future scenario design targeting FM-3.3, the scenario must either:
- Have NO tests that catch the downstream breakage (agent must verify manually)
- Have the breakage be in a dimension tests don't cover (e.g., performance, display formatting checked by human review)
- Make the dependency invisible to static analysis

## Date
2026-04-07
