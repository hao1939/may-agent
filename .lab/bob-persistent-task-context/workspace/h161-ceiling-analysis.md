# H-161 Measurement Ceiling Analysis

**Date**: 2026-04-15  
**Author**: Bob  
**Status**: Analysis complete  
**Context**: EXP-163 (hidden-dep), EXP-164 (misleading-test-fix), EXP-165 (cascading-fix-trap-v2, in progress)

---

## 1. The Ceiling Pattern Across Three Scenarios

We now have F1 × F2 factorial data on three scenarios. The pattern is striking:

| Scenario | Baseline | F1-only | F2-only | F1+F2 | Ceiling? |
|---|---|---|---|---|---|
| **EXP-163** (hidden-dep) | 100% product | 100% | 100% | 100% | ❌ Baseline already at ceiling — uninformative |
| **EXP-164** (misleading-test-fix) | 0% | 100% | 100% | 100% | ⚠️ Treatment at ceiling — independent sufficiency proven but additivity unmeasurable |
| **EXP-165** (cascading-fix-trap-v2) | ~41% | ? | ? | ? | 🔬 In progress — designed to avoid ceiling |

**Three experiments, two different ceiling problems:**
- EXP-163: The baseline was already at ceiling (100% product). No room for treatment to improve anything.
- EXP-164: The baseline was 0%, treatments all hit 100%. Room for improvement existed, but the intervention was *so effective* that all three treatment arms saturated.

## 2. Is the Ceiling Effect Itself a Significant Finding?

**Yes — independent sufficiency IS the finding.** This is not a measurement failure; it's a measurement of something different than we expected.

### What we expected to measure
Relative contributions: "F1 provides X pp improvement, F2 provides Y pp, combined provides Z pp, additivity = X + Y - Z."

### What we actually found
**Both F1 and F2 are independently sufficient** — each alone completely eliminates a 0% → 100% behavioral trap. This is a *stronger* result than the additive decomposition we planned. The key insight:

> The misleading-test-fix trap is a **single-bottleneck failure**: the agent needs exactly ONE thing — to verify whether the test's expected value is mathematically correct. Either providing that information (F1) or forcing the agent to compute it (F2) clears the bottleneck completely. There is no "partial" version of this insight; you either have it or you don't.

This tells us something deep about the trap's structure:
- **Single-bottleneck traps** have binary outcomes: the agent either hits the bottleneck (0%) or doesn't (100%)
- Any intervention that addresses the single bottleneck — whether by information provision OR behavioral forcing — produces the full effect
- The ceiling is not a measurement artifact; it reflects the trap's information structure

### The "super-strong intervention" interpretation
Across 100 total runs (69 treatment, 31 baseline): **69/69 treatment pass, 0/31 baseline pass**. This is not noise. The forced externalization mechanism — in EITHER of its instantiations — is maximally effective against single-bottleneck behavioral traps. This alone is practically useful: for any task with an identifiable diagnostic bottleneck, either F1 or F2 intervention will work.

## 3. What Scenario Properties Would Allow F1/F2 Discrimination?

To measure relative contributions, we need scenarios where F1 and F2 produce **different pass rates**. This requires:

### Property A: Multi-bottleneck structure
The task must have multiple independent failure modes, where F1 addresses some and F2 addresses others. Example: a task requiring (a) recognizing a non-obvious bug (information bottleneck → F1 helps), AND (b) resisting a tempting but wrong fix path (behavioral bottleneck → F2 helps).

### Property B: Information ≠ behavior gap
The task must be structured so that:
- **Knowing the right answer isn't sufficient** (limits F1 effectiveness) — the agent might recognize the correct diagnosis but still take the wrong action due to action momentum, local optimization, or workaround temptation
- **Being forced to analyze isn't sufficient** (limits F2 effectiveness) — the agent might analyze thoroughly but still miss the key insight because it requires domain knowledge or non-obvious inference

### Property C: Non-binary outcome
Tasks with >2 possible quality levels (not just pass/fail on a single check). A graded outcome (e.g., "fix 3/5 bugs") allows measurement of partial improvements even when neither function hits ceiling.

### Concrete Discrimination Scenarios

| Scenario Type | F1 should help | F2 should help | Why discrimination works |
|---|---|---|---|
| **Architectural trap** (resist easy fix, make structural change) | Moderate — knowing the root cause helps but doesn't overcome workaround temptation | High — forced analysis makes the structural option salient | F2 > F1 expected |
| **Information lookup** (answer buried in docs) | High — providing the answer directly | Low — forced analysis can't generate information that isn't in the codebase | F1 > F2 expected |
| **Multi-bug completeness** (find ALL N bugs) | Moderate — providing the list directly helps | Moderate — forced enumeration helps but may not surface all | Both partial, possibly additive |
| **Judgment under ambiguity** (multiple valid interpretations) | Low — expert diagnosis might not match the "best" answer | Moderate — forced deliberation surfaces considerations | F2 > F1 possible |

### The Ideal Discrimination Scenario: "Know but don't do"
A task where the agent, when given the correct diagnosis (F1), still frequently takes the wrong action. This would show F1 < 100% while F2 (which forces the agent through a different action pattern) might perform differently.

**cascading-fix-trap-v2 (EXP-165) was designed for exactly this.** The scenario has:
- A "paper trail trap" (CHANGELOG says current pipeline order is intentional → agents resist reverting even when they identify it as the root cause)
- Workaround temptation (adding `pct:` field is easier than reordering the pipeline)
- Known 0% root-cause fix rate in baseline, even among agents who identify the issue

If EXP-165 shows F1 < F2 or F1 > F2 (not both at ceiling), we'll have the discrimination data.

## 4. Assessment of Existing Scenario Candidates

From the baseline catalog, candidates for discrimination testing:

### Good candidates (20-50% baseline, multi-bottleneck structure)
| Scenario | Baseline | Why it might discriminate |
|---|---|---|
| **cascading-fix-trap-v2** | 41% | Architectural trap: knowing the root cause ≠ implementing the right fix. F1 might show the root cause but agents still workaround. F2 might force through the analysis but agents still take the easy path. **Already being tested (EXP-165).** |
| **sql-injection-in-query-builder** | 33% | Recognition task: agent must notice a security pattern. F1 (providing the finding) should help directly. F2 (forcing analysis) might not surface the security angle. Could show F1 > F2. |
| **wrong-fix-recovery** | 33% | Recovery after initial wrong approach. F2 (forced diagnosis) should prevent wrong start. F1 (expert diagnosis) should guide to right approach. Possibly both help equally. Old data — needs re-baseline. |

### Weak candidates (wrong structure for discrimination)
| Scenario | Baseline | Why it WON'T discriminate |
|---|---|---|
| **contradictory-requirements** | 0% | Single bottleneck (escalation decision) — likely same ceiling effect as EXP-164 |
| **misleading-test-fix** | 0% | Already proven: single bottleneck, both functions at ceiling |
| **hidden-dep variants** | 100% product | Baseline at ceiling — nothing to improve |
| **competing-fix-strategies** | 0% (convention) | The convention check failure is about documentation behavior, not diagnosis — unclear if F1/F2 relevant |

### New scenario design option: "Diagnosis-resistant architectural trap"
A scenario specifically designed for F1/F2 discrimination:
- **Setup**: System has a performance bug. Root cause is architectural (e.g., N+1 query pattern). Task: fix performance.
- **The trap**: Easy local fix (add caching) works for the test case but not at scale. Agent must refactor to batch queries.
- **F1 test**: Pre-written diagnosis says "this is an N+1 pattern, fix with batch query." But agents will be tempted by the cache fix because it's simpler and makes tests pass.
- **F2 test**: Forced analysis might or might not surface the N+1 pattern (depends on agent's analysis depth).
- **Expected**: F1 ~50-70% (knowing the answer helps but workaround temptation persists), F2 ~30-50% (analysis might miss the architectural pattern), F1+F2 ~60-80%.

## 5. Recommendations

### Wait for EXP-165 before designing new scenarios
EXP-165 is running on cascading-fix-trap-v2 (41% baseline, architectural trap). This is our best current candidate for F1/F2 discrimination. Possible outcomes:

| EXP-165 Result | Interpretation | Next Step |
|---|---|---|
| F1 ≈ F2 ≈ F1+F2 ≈ 100% | Independent sufficiency generalizes to multi-bottleneck tasks | The finding is even stronger than thought. New scenarios unlikely to help. Consider: maybe ALL forced-ext interventions are super-effective, and additivity analysis is moot. |
| F1 ≠ F2, both < 100% | **Discrimination achieved!** We can measure relative contributions. | Analyze which function dominates and why. Write KE. Design confirming experiment on another scenario. |
| F1 ≈ F2 ≈ 60-80%, F1+F2 > both | **Additivity detected.** Both functions provide partial benefit, and combining them adds more. | H-161's original additive prediction confirmed. Strongest possible evidence for dual-function model. |
| All arms ≈ baseline (41%) | Intervention doesn't help on this task type | The architectural trap is too hard for externalization alone. F1/F2 discrimination is possible but neither function is effective here. |

### If EXP-165 also shows ceiling: design a "diagnosis-resistant" scenario
If cascading-fix-trap-v2 also goes to 100% in all treatment arms, we'll need to specifically design a scenario where:
1. The correct diagnosis is provided (F1) but the agent still frequently does the wrong thing
2. This requires a task where **knowing is not enough** — execution resistance, temptation, or complexity prevents correct action

The sql-injection scenario (33% baseline) is ready to test now and may provide an alternative discrimination opportunity without needing new scenario design.

### Update H-161 with ceiling meta-finding
The pattern across 3 scenarios suggests a possible **meta-hypothesis**:

> **H-161b (proposed)**: Forced externalization (either F1 or F2) is independently sufficient for any task whose failure mode is primarily diagnostic (the agent fails because it doesn't have or doesn't generate the right information). Tasks where the agent has the right information but fails to act on it correctly require different interventions.

This would reframe the ceiling not as a measurement problem but as a scope boundary: H-161's functions are complete solutions for diagnostic failures, but don't address execution failures.

## 6. Summary

| Question | Answer |
|---|---|
| Is the ceiling effect significant? | **Yes** — independent sufficiency is the finding, not a measurement artifact. It tells us the trap is single-bottleneck and both functions clear it completely. |
| What properties allow F1/F2 discrimination? | Multi-bottleneck tasks where information ≠ behavior change. The task must resist information provision (limits F1) or resist behavioral forcing (limits F2). |
| Design new scenario or adapt existing? | **Wait for EXP-165** (cascading-fix-trap-v2, 41% baseline, architectural trap). If that also ceilings, consider sql-injection (33% baseline) or design a "diagnosis-resistant" scenario. |
| What should we update? | Add ceiling analysis to H-161 next steps. EXP-165 becomes the critical gate for research direction. |

---

## Cross-References
- **H-161**: Primary hypothesis (P(H) = 0.88)
- **KE-184**: Ceiling effects methodology lesson
- **KE-185**: Independent sufficiency finding
- **EXP-163**: Hidden-dep ceiling (inconclusive)
- **EXP-164**: Misleading-test-fix ceiling (supported — independent sufficiency)
- **EXP-165**: Cascading-fix-trap-v2 (in progress — discrimination test)
- **Scenario catalog**: agents/bob/workspace/scenario-baseline-catalog.md
