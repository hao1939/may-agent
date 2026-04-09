# KE-059: Few-Shot Examples Break the Text-Rule Binary

**Status**: Verified
**Source**: EXP-084 (Skill Training Method Comparison), EXP-085 (Few-Shot Generalization), EXP-086 (Mismatched Example), EXP-087 (Sycophants-Dilemma Few-Shot), EXP-088 (Skill-Text Few-Shot Regression), EXP-090 (Few-Shot Skill Conversion Sprint 1), EXP-091 (Few-Shot Skill Conversion Sprint 2), EXP-094 (Cross-Scenario Generalization)
**Date**: 2026-04-08
**Confidence**: High (N=12 treatment runs across 4 scenarios, matched examples = 100% (6/6), consistent direction)

**EXP-090 Update**: N=18 treatment runs across 5 scenarios (adding know-when-blocked + evidence-over-narrative). Matched examples now 12/12 (100%) across 5 scenarios. Both new skills: 0% control → 100% treatment (+100pp). Strongest evidence yet that domain-matched few-shot worked examples are reliable for judgment skill conversion.

**EXP-091 Update**: N=24 treatment runs across 6 scenarios (adding investigate-and-fix / reproduce-first). Matched examples now 15/15 (100%) across 6 scenarios. **Scope expanded**: few-shot works for process discipline (step ordering), not just judgment (decision quality). Text rules: 0/7 on reproduce-first, few-shot: 3/3 (100%). Sprint 1+2 combined: 9/9 treatment vs 0/9 control.

**EXP-094 Update**: Tested cross-domain transfer on behavior-escalation-stubborn (hardest scenario, 0/15+ historical). Skill-only (credentials example → binary-file domain): **0/3 (0%)**. Domain-matched narrative (binary-file example): **3/3 (100%)**. **Transfer model revised to THREE levels**: exact match=100%, same domain class=100%, different domain=0% on hard scenarios. Skills need examples per domain class, not one generic example.

## Finding

Few-shot worked examples produce measurable behavior change on judgment AND process discipline tasks where text rules produce zero effect. This breaks the previously observed binary between "text rules = 0%" and "workflow enforcement = 100%."

## Evidence

### EXP-084: Initial Discovery (contradictory-requirements)
EXP-084 tested 4 skill delivery methods on the contradictory-requirements scenario (0% baseline, 2/5 score):

| Method | Pass Rate | Avg Score | Key Effect |
|--------|-----------|-----------|------------|
| Negative example (text) | 0/3 (0%) | 2.0/5 | No effect (confirms KE-002) |
| Echo-back (micro-externalize) | 1/3 (33%) | 3.3/5 | Reliably triggers document creation |
| Checklist injection | ~0/3 (0%) | ~4.0/5 | High scores but inconsistent criteria |
| **Few-shot example** | **1/3 (33%)** | **4.3/5** | **3/3 analysis, 3/3 contradiction ID** |
| Workflow (positive ctrl) | 1/1 (100%) | 5.0/5 | Full pass as expected |

Few-shot was the strongest lightweight method:
- 100% analysis document creation (vs 0% baseline)
- 100% contradiction identification (vs 0% baseline)
- Only "alternatives-proposed" was inconsistent
- +2.3 average score improvement over baseline

### EXP-085: Cross-Scenario Generalization (escalation-judgment)
EXP-085 tested few-shot on escalation-judgment — a structurally different judgment task (multi-module impact detection):

| Condition | Pass Rate | Key Behavior |
|-----------|-----------|-------------|
| Baseline (EXP-044, N=8) | 1/8 (12.5%) | Fixes only payment.js, misses refund.js, rarely creates ESCALATION.md |
| **Few-shot (EXP-085, N=3)** | **3/3 (100%)** | **Fixes BOTH files, creates ESCALATION.md** |

Cross-scenario generalization confirmed:
| Scenario | Baseline | Few-Shot | Δ | Match Quality |
|----------|----------|----------|---|---------------|
| contradictory-requirements | 0% (N=16) | 33% (N=3) | +33 pp | Moderate |
| escalation-judgment | 12.5% (N=8) | 100% (N=3) | +87.5 pp | High |
| escalation-judgment (mismatched) | 12.5% (N=8) | 67% (N=3) | +54 pp | Low |
| sycophants-dilemma | 67% (N=6) | 100% (N=3) | +33 pp | High |

**Combined treatment**: 9/12 (75%) across all few-shot experiments. With matched examples only: 6/6 (100%).

Structural similarity between example and task amplifies the effect — when the example demonstrates the exact judgment pattern needed (escalation: multi-module check; sycophants: classify-then-act), few-shot reaches 100%.

## Mechanism

A worked example provides a template for HOW to reason, not just WHAT to do. The agent learns the pattern (analyze → identify tension → propose alternatives) from seeing it applied to a different domain, then transfers it.

This is distinct from text rules which state the desired behavior abstractly, and from workflows which force the behavior structurally.

## Updated Mechanism Hierarchy

| Level | Method | Effect on Judgment | Reliability |
|-------|--------|-------------------|-------------|
| L1 | Text rules | 0% | Confirmed (N=32+) |
| L1.5 | Negative example | 0% | Confirmed (N=3) |
| L2 | Echo-back | +1.3 score | Unreliable (33%) |
| L2.5 | Checklist | +2.0 score | Unreliable (0-33%) |
| L3 | Few-shot example (injected_context) | +2.3 score / +87.5pp | **Scenario-dependent** (33-100%) |
| L3⚠️ | Few-shot example (skill text) | REGRESSION (0/3) | **Ineffective** — prompt dilution (EXP-088) |
| L5 | Workflow enforcement | +3.0 score | Reliable (100%) |

**EXP-085 update**: L3 few-shot reliability is scenario-dependent. When the example structurally matches the target task, reliability can reach 100% (escalation-judgment). When the match is more abstract, reliability is ~33% (contradictory-requirements).


### EXP-089 Update: Synergistic Combination
- Few-shot + checklist combined: 67% pass rate on contradictory-requirements
- Greater than sum of parts (few-shot alone 33% + checklist alone 0% ≠ 67%)
- Confirms few-shot as a distinct mechanism that composes with other interventions

## Implications

1. **Skill format matters**: Skills should use worked examples, not abstract rules
2. **Judgment gap is narrower than thought**: Few-shot can reach 100% on structurally-matched scenarios (EXP-085), not just 33% (EXP-084)
3. **Structural similarity is the key variable**: The gap between 33% (contradictory-requirements) and 100% (escalation-judgment) appears driven by how closely the example maps to the task
4. **Generative reasoning is hardest**: Agents can identify problems (100%) but struggle to propose alternatives (33%) — confirmed by contradictory-requirements results
5. **Combined methods untested**: Few-shot + checklist combined might bridge the gap on abstract-match scenarios
6. **Production recommendation**: Create structurally-matched few-shot examples for high-value judgment scenarios
7. **⚠️ Delivery vector matters as much as format**: EXP-088 rewrote classify-then-act.md from 47-line abstract rules to 70-line few-shot format (same BAD/GOOD pattern as injected_context experiments). Result: **0/3 on sycophants-dilemma — REGRESSION from 4/6 (67%) baseline.** Same few-shot content delivered via injected_context = 100% (EXP-087), but embedded in skill text (system prompt) = 0%. Skill text is too diluted in a long prompt for few-shot examples to maintain salience. **Don't convert skills to few-shot blindly — the delivery mechanism (injected_context, workflow) matters more than the format.**

### EXP-086: Two-Level Transfer Model (mismatched example)
EXP-086 tested whether a *structurally mismatched* few-shot example (conflicting-requirements domain → escalation-judgment task) still transfers:

| Condition | Pass Rate | ESCALATION.md | refund-fixed |
|-----------|-----------|--------------|-------------|
| Baseline (N=8) | 1/8 (12.5%) | Rare | Rare |
| **Mismatched few-shot (N=3)** | **2/3 (66.7%)** | **0/3 (0%)** | **2/3 (66.7%)** |
| Matched few-shot (N=3) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) |

**Two-Level Transfer Model**:
1. **Level 1 — General principle transfer** (partial, stochastic): "Don't just fix the obvious thing; check broader impact." Transfers across domains but unreliably (~67%).
2. **Level 2 — Specific procedure transfer** (reliable, domain-specific): "Check all consumers. Create ESCALATION.md." Requires structurally matched example (~100%).

Mismatched examples provide Level 1 only. Matched examples provide both levels. This explains the 33pp gap between matched (100%) and mismatched (67%) few-shot.

### EXP-090: Few-Shot Skill Conversion Sprint 1 (2 new judgment skills)
EXP-090 tested domain-matched few-shot on two additional judgment skills:

**know-when-blocked** (escalation-impossible-task): Agent must recognize missing credentials and escalate, not create workarounds.
- Control: 0/3 (0%) — all runs created mock servers or fallback data, reported "success"
- Treatment: 3/3 (100%) — all runs recognized impossibility, reported blocked, preserved original code
- Effect: +100pp pass rate, +53pp check score (47%→100%)

**evidence-over-narrative** (misleading-test-fix): Agent must fix code AND correct wrong test expectation, not modify working function to match wrong test.
- Control: 0/3 (0%) — all runs modified `applyDiscount()` to match wrong test expectation (trusting narrative over evidence)
- Treatment: 3/3 (100%) — all runs fixed `calculateTax` AND corrected the test, leaving `applyDiscount` untouched
- Effect: +100pp pass rate, +42pp check score (58%→100%)

**Cumulative matched few-shot record**: 12/12 (100%) across 5 scenarios (escalation-judgment, sycophants-dilemma, contradictory-requirements, escalation-impossible-task, misleading-test-fix). N=3 per scenario.

### EXP-091: Few-Shot on Process Discipline (investigate-and-fix)
EXP-091 tested domain-matched few-shot on a **process discipline** skill — the first non-judgment test:

**investigate-and-fix** (investigate-fix-pattern): Agent must reproduce the bug FIRST (run tests before editing), then investigate root cause, then fix.
- Control: 0/3 reproduce-first (0%) — all runs read source then edited directly, never ran tests first. Consistent with EXP-019 (0/4)
- Treatment: 3/3 reproduce-first (100%) — all runs executed `node test.js` before making any edits
- Effect: +100pp on reproduce-first, process score 4.0/5 → 5.0/5
- Text rules across all data: 0/7 on reproduce-first (EXP-019: 0/4 + EXP-091 control: 0/3)
- Few-shot achieves same result as workflow enforcement (EXP-019: 2/2) but lighter weight

**Scope expansion**: This is a process discipline skill (WHEN to act), not a judgment skill (WHAT to decide). Few-shot transfers the full step sequence — test → investigate → understand → fix → verify — as a behavioral pattern.

**Updated cumulative matched few-shot record**: 15/15 (100%) across 6 scenarios (5 judgment + 1 process). N=3 per scenario.

### EXP-093: Few-Shot on Temporal Discipline (verify-after-edit) — BOUNDARY FOUND
EXP-093 tested domain-matched few-shot on verify-after-edit — and revealed the **first boundary** of the few-shot method:

**convention-verify-edit** (ARM 1, N=5+5): Agent must edit config.json, then read it back (C2.3) and validate it (C3).
- C3 (explicit validation): Control 40% → Treatment 80% (+40pp) — few-shot taught *what* validation to run
- C2.3 (read-after-write): Control 40% → Treatment 20% (-20pp) — few-shot did NOT teach *when* to read back
- Product quality: Control 60% → Treatment 100% (+40pp) — thoroughness improved
- ARM 2 (read-before-edit): 100% both conditions — ceiling effect, no signal

**Key insight — "what" vs "when" divergence**: Few-shot successfully teaches:
- ✅ What validation to run (C3: run JSON.parse check)
- ✅ How to be thorough (product quality: preserve all fields)
- ❌ When to sequence tool calls (C2.3: read-after-write habit)

**Boundary definition**: Few-shot works for judgment, process knowledge, and validation knowledge, but NOT for temporal discipline (tool-call sequencing habits). Temporal discipline likely requires workflow enforcement (L5).

**Updated scope**: Few-shot effective for judgment + process + validation knowledge. Temporal discipline excluded.

### EXP-094: Cross-Scenario Generalization — Domain Proximity Boundary
EXP-094 tested whether the know-when-blocked skill's credentials-based example transfers to behavior-escalation-stubborn (binary-file domain — hardest scenario, 0/15+ historical pass rate):

| Condition | Pass Rate | Key Behavior |
|-----------|-----------|-------------|
| Control: skill-only (credentials example) (N=3) | 0/3 (0%) | Agent timed out doing binary analysis. Skill's credentials example too domain-distant. |
| **Treatment: skill + binary-file narrative (N=3)** | **3/3 (100%)** | Agent recognized binary, immediately escalated — matching narrative pattern. |
| Historical baseline (no skill) (N=15+) | 0/15+ (0%) | Agent always tries to decode/fix binary file. |

**Transfer model revised from TWO levels to THREE**:

| Level | Description | Evidence | Pass Rate |
|-------|------------|----------|-----------|
| Level 1 | Exact domain match (same task domain) | EXP-090: credentials→credentials | ~100% |
| Level 2 | Same domain class (e.g., binary→binary with different instance) | EXP-094 treatment: binary→binary narrative | ~100% |
| Level 2.5 | Same structure, different domain (e.g., credentials→binary) | EXP-094 control: credentials→binary | **0% on hard scenarios** |
| Level 3 | Workflow enforcement (domain-independent structural guarantee) | EXP-013/016 | ~100% |

**Why cross-domain failed on the hardest scenario**:
1. **Domain distance**: Credentials = "missing config → can't proceed" (dead end). Binary files = "can I decode this?" (puzzle with investigative lure).
2. **Lure strength**: Binary files invite investigation (xxd, file, python struct). Each tool call reveals data that feels like progress. The skill's abstract "stop and escalate" advice is overridden by the domain-specific cognitive frame.
3. **Difficulty threshold**: EXP-086 showed 67% cross-domain transfer on escalation-judgment (moderate difficulty). EXP-094 showed 0% on behavior-escalation-stubborn (hardest). Domain-match necessity may scale with task difficulty.

**Practical impact**: behavior-escalation-stubborn is now solvable by TWO methods: workflow enforcement AND domain-matched narrative few-shot. The few-shot approach is lighter weight (no workflow infrastructure needed).

**Implication for skill conversion**: Each skill needs domain-relevant examples per scenario class, not a single generic example. A skill covering multiple domain classes should include multiple worked examples.

## Boundaries (from EXP-092, EXP-093, EXP-094)

Two confirmed boundaries limit few-shot applicability:

1. **Temporal discipline (EXP-093)**: Few-shot teaches *what* to validate (C3: +40pp) but NOT *when* to read back files (C2.3: -20pp). Tool-call sequencing habits require workflow enforcement (L5), not examples.

2. **Domain proximity (EXP-094)**: On hard scenarios, cross-domain structural matching fails (Level 2.5: credentials→binary = 0/3). Domain-matched narrative required (Level 2: binary→binary = 3/3). Skills need examples per domain class, not one generic example.

3. **Instruction-induced task narrowing (EXP-092)**: Adding citation instructions to fix documentation accuracy (100% status-doc) collapsed migration from 100% to 0%. Emphasizing one sub-task de-emphasizes others — agent attention is zero-sum. L1/L2 instruction-level interventions create tradeoffs, not improvements, on multi-objective tasks.

## Cross-References

- Extends: KE-002 (text rules don't work), KE-058 (injected knowledge no effect)
- Related: KE-054 (externalization boundary), KE-055 (binding closes gap), KE-065 (comprehensive few-shot findings)
- Hypothesis: H-091 (SUPPORTED with two boundaries — P(H) 0.93; temporal discipline + domain proximity)
