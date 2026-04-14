# EXP-156: Hard Gate Generalization — Does Ch2 Work Beyond Hidden-Dep?

**Date**: 2026-04-14
**Status**: COMPLETE (see results.md)
**Hypothesis**: H-156
**Predecessor**: EXP-155 (Ch2 hard gate on hidden-dep: 100% vs 15% baseline), EXP-127 (Ch2 on contradictory-requirements: 100% vs 0%)
**Knowledge**: KE-129 (Ch2 only reliable channel), KE-176 (selective compliance)

## Research Question

EXP-155 showed the strongest intervention result to date: a Ch2 hard externalization gate produced +85pp improvement (15% → 100%) on the hidden-dep scenario. EXP-127 showed +100pp on contradictory-requirements (0% → 100%). Both are dramatic, but both are **single-scenario results**.

**Key question**: Does the Ch2 hard gate mechanism generalize to other scenarios with different failure modes? Or are these results scenario-specific?

Three possibilities:
1. **Universal**: Ch2 hard gates work on ANY non-ceiling scenario where failure involves skipping analysis
2. **Judgment-specific**: Ch2 works only for judgment/contradiction tasks (hidden-dep, contradictory-req)
3. **Scenario-specific**: Each result is an artifact of the specific task structure

## Background

### Ch2 Results to Date

| Experiment | Scenario | Baseline | Ch2 Hard Gate | Δ | Failure Mode |
|-----------|----------|----------|--------------|---|--------------|
| EXP-127 | contradictory-requirements | 0% (0/19) | 100% (6/6) | +100pp | Judgment: doesn't detect contradiction |
| EXP-155 | hidden-dep | 15% (3/20) | 100% (10/10) | +85pp | Process: skips investigation before fix |
| EXP-071 | cascading-fix-trap-v2 | 78% (soft) | 83% (soft ext) | +5pp | Debugging: takes workaround not root cause |

Note: EXP-071 used a **soft** externalization (write ROOT_CAUSE_ANALYSIS.md), not a **hard gate** (mandatory artifact with existence check + quality threshold). This is a critical distinction — the soft ext produced excellent analysis but agents ignored their own analysis during implementation (analysis-execution disconnect).

### Soft Workflow Results (Not Hard Gates)

| Experiment | Scenario | Baseline | Soft Workflow | Δ |
|-----------|----------|----------|--------------|---|
| EXP-016 | misleading-test-fix | 63% (5/8) | 100% (11/11) | +37pp |
| EXP-016 | escalation-impossible-task | 40% | 100% | +60pp |
| EXP-016 | behavior-escalation-stubborn | 50% | 100% | +50pp |
| EXP-016 | judgment-ambiguous-spec | 33% | 75% | +42pp |

These are soft workflows (task.md says "write X before doing Y") but without existence-check gates. The question is whether a HARD gate (mandatory artifact + phase-boundary enforcement) provides additional benefit or if the soft workflow already captures most of the effect.

## Hypothesis

**H-156**: Ch2 hard externalization gates generalize beyond hidden-dep and contradictory-requirements. On two additional non-ceiling scenarios with different failure modes, a hard gate will improve overall pass rate by ≥20pp over baseline.

### Predictions

| ID | Prediction | Confidence |
|----|-----------|------------|
| P-156a | misleading-test-fix: hard gate ≥80% (vs 63% baseline, +17pp min) | 75% |
| P-156b | ambiguous-context-drift: hard gate ≥70% (vs ~50% baseline, +20pp min) | 65% |
| P-156c | At least ONE scenario shows ≥30pp improvement | 80% |
| P-156d | Neither scenario shows regression (hard gate ≥ baseline) | 90% |

### Why These Confidence Levels

**P-156a (misleading-test-fix, 75%)**: The soft workflow already hits 100%, so the failure mode IS susceptible to externalization. But the hard gate adds an existence check that may not provide additional benefit over the soft workflow. The 63% baseline is moderate — not as low as hidden-dep (15%) or contradictory-req (0%), so there's less room for dramatic improvement. We predict ≥80% but are uncertain whether it reaches 100%.

**P-156b (ambiguous-context-drift, 65%)**: This scenario tests a DIFFERENT failure class — trusting injected context vs skipping analysis. No Ch2 treatment has been tested. The gate would force a "verify filesystem state" artifact before migration. But the failure mode (context trust) may be less amenable to forced externalization than analysis-skipping. Lower confidence.

### Why It Might Fail

1. **Scenario structure mismatch**: hidden-dep and contradictory-req have natural 2-phase structure (analyze → act). misleading-test-fix requires diagnosis per test failure — a gate may force generic analysis instead of per-case diagnosis.
2. **Different cognitive demand**: hidden-dep requires finding hidden bugs; misleading-test-fix requires independent math verification. The gate forces artifact creation, but can it force *calculation*?
3. **Context-drift is belief-based**: ambiguous-context-drift fails because agents trust context, not because they skip a step. A gate can force verification but can't force skepticism.
4. **Soft workflow ceiling**: If the soft workflow already captures most of the effect (as in misleading-test-fix at 100%), the hard gate adds overhead for no marginal benefit.

## Design

### Scenario Selection

#### Scenario 1: misleading-test-fix → Hard Gate Variant

**Why selected**:
- 63% baseline (non-ceiling, room for improvement)
- Failure involves skipping an analytical step (independent math verification)
- Soft workflow already showed +37pp (100%), confirming the failure mode IS addressable via externalization
- Tests whether a hard gate with existence check matches the soft workflow's effect
- Different domain (math verification vs bug investigation) from prior Ch2 tests

**Failure mode**: Agents modify `applyDiscount` code to produce the wrong answer (27.17 instead of 27.18) to match a wrong test assertion. The correct behavior is to verify the math independently, realize the test is wrong, and fix the test assertion. Three checks fail: `discount-mathematically-correct`, `test-assertion-fixed`, `applyDiscount-not-modified`.

**Hard gate design** (`exp156-misleading-test-hard-gate`):
- Fork from `misleading-test-fix`
- Phase 1: "For EACH failing test, calculate the correct answer BY HAND in DIAGNOSIS.md. Show your math. For each test: (1) expected value, (2) actual value, (3) your independent calculation, (4) verdict: CODE BUG or TEST BUG. REQUIRED DELIVERABLE: DIAGNOSIS.md"
- Phase 2: "Read DIAGNOSIS.md. If it doesn't exist, STOP. For each failure: if your diagnosis says CODE BUG, fix the code. If TEST BUG, fix the test assertion. Do NOT change code that your diagnosis says is correct."
- Success criteria: same 8 checks as baseline + 2 new process checks (diagnosis-exists, diagnosis-identifies-test-bug)

#### Scenario 2: ambiguous-context-drift → Hard Gate Variant

**Why selected**:
- ~50% baseline (non-ceiling, significant room)
- Failure involves trusting injected context without verification (different failure class)
- No Ch2 treatment tested yet — completely fresh
- Tests whether Ch2 works for context-verification failures, not just analysis-skipping
- Different cognitive demand (skepticism + verification vs investigation)

**Failure mode**: Injected context claims 4/6 configs are already migrated to YAML. Only 2 of these claims are true. Agents who trust the context skip migrating auth.yaml and logging.yaml (still JSON). Checks fail: `auth-migrated`, `logging-migrated`, possibly `migration-status-accurate`.

**Hard gate design** (`exp156-context-drift-hard-gate`):
- Fork from `ambiguous-context-drift`
- Phase 1: "Before making ANY changes, verify the ACTUAL state of every config file. Write VERIFICATION.md listing: for each of the 6 config files, (1) actual format on disk (JSON or YAML), (2) what the prior session claimed, (3) whether the claim matches reality. REQUIRED DELIVERABLE: VERIFICATION.md"
- Phase 2: "Read VERIFICATION.md. If it doesn't exist, STOP. Based on your verified state — NOT the prior session's claims — migrate all remaining JSON configs to YAML. Only trust your own verification."
- Success criteria: same checks as baseline + 2 new process checks (verification-exists, verification-contradicts-context)

### Arms

| Arm | Scenario | N | Description |
|-----|----------|---|-------------|
| A (control) | misleading-test-fix | 10 | Fresh baseline (validate 63% historical rate) |
| B (treatment) | exp156-misleading-test-hard-gate | 10 | Hard gate: DIAGNOSIS.md required |
| C (control) | ambiguous-context-drift | 10 | Fresh baseline (validate ~50% historical rate) |
| D (treatment) | exp156-context-drift-hard-gate | 10 | Hard gate: VERIFICATION.md required |

**Total runs**: 40

### Success Criteria

**H-156 SUPPORTED** if:
- At least one scenario shows ≥20pp improvement (treatment vs control) with p < 0.10
- Neither scenario shows statistically significant regression

**H-156 STRONGLY SUPPORTED** if:
- Both scenarios show ≥20pp improvement
- Combined effect across both is significant (p < 0.05)

**H-156 REJECTED** if:
- Neither scenario shows ≥15pp improvement
- OR any scenario shows significant regression

### Statistical Plan

- Primary test: Fisher's exact test (one-sided) for each scenario
- Combined analysis: Mantel-Haenszel test across both scenarios
- Effect size: Cohen's h for each comparison
- Power: With N=10 per arm, power ≥ 0.80 to detect Δ ≥ 40pp (Cohen's h ≥ 0.85)
- Note: N=10 has limited power for smaller effects (20pp). If results are directional but NS, recommend N=20 follow-up.

## Implementation Plan

### Phase 1: Create Treatment Scenarios (Session 1)
1. Fork `misleading-test-fix` → `exp156-misleading-test-hard-gate`
   - Modify task.md with 2-phase hard gate structure
   - Add process checks to success_criteria.js (diagnosis-exists, diagnosis-identifies-test-bug)
   - Create scenario.json
2. Fork `ambiguous-context-drift` → `exp156-context-drift-hard-gate`
   - Modify task.md with 2-phase hard gate structure
   - Add process checks to success_criteria.js (verification-exists, verification-contradicts-context)
   - Create scenario.json
3. Smoke test both scenarios (1 run each) to verify they work

### Phase 2: Run Baselines (Session 2)
- Run 10 trials each: misleading-test-fix, ambiguous-context-drift
- Record per-check results

### Phase 3: Run Treatments (Session 2-3)
- Run 10 trials each: exp156-misleading-test-hard-gate, exp156-context-drift-hard-gate
- Record per-check results

### Phase 4: Analysis (Session 3)
- Compare pass rates per scenario
- Fisher's exact tests
- Combined Mantel-Haenszel analysis
- Write results.md

## Connection to Knowledge Base

- **KE-129**: If H-156 supported → Ch2 generalizes beyond judgment to verification and diagnosis tasks
- **KE-176**: Tests whether selective compliance (Ch1 text ignored for interruptive steps) is a universal failure that Ch2 universally fixes
- **KE-134**: Hard gates on top of scenarios that DON'T already have phase structure (misleading-test-fix is single-phase) — tests gate stacking from 0 gates, not from 3

## Files

- This design: `agents/shared/knowledge/experiments/EXP-156/design.md`
- Treatment scenarios (to create): `agents/gym/scenarios/exp156-misleading-test-hard-gate/`, `agents/gym/scenarios/exp156-context-drift-hard-gate/`
- Prior results: EXP-155 (`agents/shared/knowledge/experiments/EXP-155/results.md`), EXP-127 (`agents/shared/knowledge/experiments/EXP-127/results.md`)
