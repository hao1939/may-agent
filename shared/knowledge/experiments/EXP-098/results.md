# EXP-098: Treatment Testing on L3 Cascading-State Scenario — Results

**Date**: 2026-04-09
**Status**: COMPLETE
**Sprint**: 31

## Summary

| Arm | Scenario | Pass Rate | auth-fixed | Avg Duration |
|-----|----------|-----------|------------|--------------|
| A (Baseline) | ambiguous-context-drift-L3 | **0% (0/3)** | 0/3 | 115.0s |
| B (Externalization) | ambiguous-context-drift-L3-ext | **0% (0/3)** | 0/3 | 190.0s |
| C (Cross-Reference) | ambiguous-context-drift-L3-xref | **100% (3/3)** | 3/3 | 125.4s |

**Key finding**: Cross-reference (grep source code for field references) achieves 100% pass rate on the hardest non-ceiling scenario, up from 0% baseline. Externalization (write ANALYSIS.md first) does NOT improve pass rate despite one run identifying the missing field in the analysis document.

## Detailed Results

### Arm A: Baseline (ambiguous-context-drift-L3)

| Run | Result | Checks Passed | auth-fixed | Duration | Notes |
|-----|--------|--------------|------------|----------|-------|
| 1 | ❌ FAIL | 3/8 | ❌ | 108.5s | Missing: auth-fixed, logging-recovered, api-migrated, storage-migrated, loader-complete |
| 2 | ❌ FAIL | 3/8 | ❌ | 134.6s | Same pattern — only preserved, report, scope pass |
| 3 | ❌ FAIL | 3/8 | ❌ | 101.8s | Same pattern — 100% consistent failure |

**Baseline confirms 0% pass rate** (consistent with EXP-077 L3 finding).

**Note**: Baseline with coder agent is WORSE than EXP-077's bob agent (3/8 vs 7/8). The coder agent fails to complete basic migration work (logging recovery, api/storage migration), not just the auth-fixed check. This may be because coder is a more narrowly-scoped agent than bob.

### Arm B: Externalization (ambiguous-context-drift-L3-ext)

| Run | Result | Checks Passed | auth-fixed | wrote-analysis | Duration | Notes |
|-----|--------|--------------|------------|----------------|----------|-------|
| 1 | ❌ FAIL | 3/9 | ❌ | ❌ | 283.9s | No ANALYSIS.md written. Same core failures as baseline |
| 2 | ❌ FAIL | 4/9 | ❌ | ✅ (with max_age!) | 129.6s | ANALYSIS.md written, identifies max_age gap — but auth.yaml still not fixed |
| 3 | ❌ FAIL | 3/9 | ❌ | ❌ | 156.3s | No ANALYSIS.md written. Same core failures as baseline |

**Externalization: 0% core pass rate, 1/3 analysis compliance.**

**Critical finding from Run 2**: The agent wrote ANALYSIS.md that explicitly identified missing `max_age` — but still didn't fix auth.yaml. This is the "recognition without action" pattern: the externalization intervention successfully surfaced the information gap, but the agent didn't translate that recognition into a repair action. The analysis phase consumed budget that should have gone to actual work.

### Arm C: Cross-Reference (ambiguous-context-drift-L3-xref)

| Run | Result | Checks Passed | auth-fixed | Duration | Notes |
|-----|--------|--------------|------------|----------|-------|
| 1 | ✅ PASS | 8/8 | ✅ | 102.5s | Full pass — all migrations, auth fixed with max_age, loader complete, recovery report |
| 2 | ✅ PASS | 8/8 | ✅ | 129.9s | Full pass — identical perfect result |
| 3 | ✅ PASS | 8/8 | ✅ | 143.8s | Full pass — 100% consistent success |

**Cross-reference: 100% pass rate, 100% auth-fixed rate.**

The cross-reference intervention (grep source code for config field references before repairing) produces the strongest treatment effect observed in any experiment: **0% → 100% improvement** on the hardest non-ceiling scenario.

## Analysis

### Why Cross-Reference Works and Externalization Doesn't

1. **Cross-reference provides a concrete discovery mechanism**: "grep src/ for config field references" leads the agent directly to `auth-middleware.js` which contains `config.session.max_age`. The information is there to be found — the instruction tells the agent HOW to find it.

2. **Externalization is a thinking prompt, not a discovery mechanism**: "Write ANALYSIS.md listing expected vs actual state" asks the agent to reflect on what it already knows. But the agent's knowledge doesn't include `max_age` — it was in the deleted `auth.json`. You can't externalize information you don't have.

3. **The failure in Ext Run 2 is especially revealing**: The agent DID write an analysis that identified max_age was missing (probably from general knowledge about auth configs). But then it didn't fix auth.yaml accordingly. This suggests a "planning-execution gap" — the agent can identify problems in analysis mode but doesn't carry them forward to implementation.

### Mechanism Analysis

The L3 scenario's core challenge is **information loss** — the original auth.json was deleted, so the agent has no reference for what fields should exist. The treatments address this differently:

- **Externalization**: Asks agent to reason about what SHOULD exist → dependent on agent's prior knowledge → fragile
- **Cross-reference**: Points agent to an authoritative source (source code) that DOES contain the answer → reliable

This maps to a general principle: **interventions that provide discovery mechanisms outperform interventions that prompt reflection** when the core problem is missing information.

### Coder vs Bob Agent Performance

The coder agent shows significantly worse baseline performance (3/8 checks) compared to bob (7/8 in EXP-077). The coder agent consistently fails to:
- Recover logging config from scratch
- Migrate api.json and storage.json
- Update the loader for all configs

This suggests the coder agent, while specialized for code tasks, lacks the broader "figure out the system and complete the mission" capability that bob's architect role provides. However, with the xref treatment, coder achieves 8/8 — **the cross-reference intervention compensates for the agent's narrower capability**.

## Hypothesis Results

- **H1 (Externalization ≥33%)**: ❌ REJECTED — 0% pass rate, no improvement
- **H2 (Cross-reference ≥67%)**: ✅ CONFIRMED — 100% pass rate, exceeds hypothesis
- **H3 (Cross-reference > Externalization)**: ✅ CONFIRMED — 100% vs 0%

## Implications

### For Gym Graduation
Cross-reference is the first mechanism to achieve 100% on L3, our hardest production-complexity scenario. This validates that **structural interventions can bridge the gym-production gap** — but only when they provide concrete discovery mechanisms, not just thinking prompts.

### For Skill Design
The cross-reference pattern ("before repairing, grep source code for all references to the thing you're repairing") should be formalized as a skill. It's the most effective behavioral intervention tested to date.

### For Agent Training
Externalization alone is insufficient for information-loss scenarios. Skills that include externalization should ALSO include a concrete verification/discovery step — otherwise the agent may identify the problem but not act on it.

### Knowledge Entry
- **KE candidate**: "Cross-reference source code before repairing corrupted config/state: 0% → 100% improvement on information-loss scenarios (EXP-098)"
- **Update KE-053**: Cross-reference is the first mechanism that actually closes the gym-production gap for cascading-state scenarios
