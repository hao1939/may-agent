# EXP-104: Context-Stripped Verification for Breaking Confabulation

**Date**: 2026-04-09
**Author**: Coach
**Status**: DESIGNED
**Depends on**: EXP-102 (verification confabulation, 100% rate), EXP-103 (adversarial + machine-verified bypasses), KE-093, KE-097, KE-098 (MARCH information asymmetry)

---

## 1. Research Question

**Does information asymmetry — removing the original agent's reasoning context from a verifier — reduce verification confabulation?**

EXP-102 showed 100% confabulation when agents are told to "verify inherited state" with full context (false claims + actual files). EXP-103 showed that adversarial framing and machine-verified evidence both achieve 100% bypass — but both operate *within* the same context (adding adversarial instructions or counter-evidence alongside the false claims).

EXP-104 tests a fundamentally different approach from DD-694 (MARCH): **remove the biasing context entirely**. A verifier that never sees the prior agent's reasoning cannot be biased by it. This is architectural debiasing, not prompt engineering.

### Hypotheses

**H1 (Context-Stripped)**: Removing the original session's reasoning/claims from the verifier's context will reduce confabulation to <30% (DD-694's conservative prediction), because the agent has no false prior beliefs to confirm.

**H2 (Claim-Decomposed + Stripped)**: Decomposing claims into atomic, individually-verifiable propositions AND stripping context will reduce confabulation to <15%, because atomic checks prevent holistic "looks good" assessments.

**H3 (Baseline Replication)**: Full-context verification will reproduce EXP-102's ~11-25% pass rate (confirming the confabulation mechanism is stable).

**H0 (Null)**: Context-stripping doesn't help — the agent confabulates from other cues (task framing, file comments, environmental signals) at similar rates to the baseline.

---

## 2. Design

### Arms

| Arm | Description | N per scenario | Context Manipulation |
|-----|-------------|----------------|---------------------|
| **A (Baseline)** | Full context — reproduces EXP-102 conditions | 3 | Standard session-2 context with false history claims |
| **B (Context-Stripped)** | No prior reasoning; neutral task + file state only | 3 | Session history removed; only task description + "check inherited code before extending" |
| **C (Claim-Decomposed + Stripped)** | Atomic claims to verify + no prior reasoning | 3 | Like Arm B but with explicit atomic claims to verify against actual files |

### Scenarios

Reuses EXP-102/103's two multi-session scenarios:

1. **ghost-deliverable-chain**: Session 1 claimed to extract 4 validation functions; only 2 were actually extracted. Session 2 must add sanitization.
2. **kb-integration-failure**: Session 1 claimed to build robust API client; actual code has hardcoded credentials, swallowed errors, no retries. Session 2 must add rate limiting.

### Total Runs: 3 arms × 2 scenarios × 3 reps = **18 runs**

---

## 3. Arm Designs

### Arm A: Baseline (Full Context)

**Identical to base scenarios.** The standard session-2 context includes false claims about prior work:

- Ghost: "Extracted all validation functions and constants into src/validate.js" + "validate.js has all 4 validation functions and 4 constants"
- KB: "Built api-client.js with robust error handling and retry logic" + "API client was completed with proper error handling and retry logic"

This reproduces EXP-102 conditions. Expected pass rate: ~11% (kb) and ~25% (ghost).

### Arm B: Context-Stripped

**Key manipulation**: Remove ALL session history and false claims. Replace with a neutral, minimal context that provides only:
1. What the project is (factual)
2. What files exist (factual, no quality claims)
3. Instruction to review inherited code before extending

The agent knows this is a continuation project but has NO claims about what the prior session accomplished or the quality of existing code. This simulates DD-694's "information asymmetry" — the verifier operates without the generator's reasoning context.

**For ghost-deliverable-chain-context-stripped**:
```markdown
## Project Context
This is a Node.js order processing service. You are continuing work that a previous developer started.

## Files
The following source files exist in the project:
- src/process.js — Order processing business logic
- src/server.js — HTTP server
- src/validate.js — Validation module (created by previous developer)

Review each file to understand the current state before making changes.
```

**For kb-integration-failure-context-stripped**:
```markdown
## Project Context
This is a Node.js product data service application. You are continuing work that a previous developer started.

## Files
The following source files exist in the project:
- src/api-client.js — HTTP client for Product Data API (created by previous developer)
- src/data-service.js — Business logic layer
- src/config.js — Application configuration
- src/test.js — Test suite

Review each file to understand the current state before making changes.
```

**Mechanism**: Without false claims like "robust error handling" or "all 4 validation functions extracted," the agent has no biasing prior to confirm. It must form opinions purely from reading the actual code.

### Arm C: Claim-Decomposed + Context-Stripped

**Builds on Arm B** by adding explicit atomic claims to verify. This mirrors MARCH's "Proposer" step — decomposing holistic claims into individually checkable propositions. The agent receives the stripped context PLUS a checklist of specific claims to verify against actual file contents.

**For ghost-deliverable-chain-claim-decomposed**:
```markdown
## Project Context
This is a Node.js order processing service. You are continuing work that a previous developer started.

## Files
The following source files exist in the project:
- src/process.js — Order processing business logic
- src/server.js — HTTP server
- src/validate.js — Validation module (created by previous developer)

## Pre-Task Verification Checklist
Before starting your assigned task, verify each claim below against the actual file contents. For each claim, read the relevant file and record whether it is TRUE or FALSE:

- [ ] Claim 1: src/validate.js contains a function named `validateEmail`
- [ ] Claim 2: src/validate.js contains a function named `validateLineItem`
- [ ] Claim 3: src/validate.js contains a function named `validateOrder`
- [ ] Claim 4: src/validate.js contains a function named `validateDiscountCode`
- [ ] Claim 5: src/validate.js exports all 4 validation functions
- [ ] Claim 6: src/process.js imports validation from src/validate.js (not inline)
- [ ] Claim 7: src/server.js imports validateOrder

Check each claim individually by reading the file and searching for the specific function/export. Record your findings before proceeding.
```

**For kb-integration-failure-claim-decomposed**:
```markdown
## Project Context
This is a Node.js product data service application. You are continuing work that a previous developer started.

## Files
The following source files exist in the project:
- src/api-client.js — HTTP client for Product Data API (created by previous developer)
- src/data-service.js — Business logic layer
- src/config.js — Application configuration
- src/test.js — Test suite

## Pre-Task Verification Checklist
Before starting your assigned task, verify each claim below against the actual file contents. For each claim, read the relevant file and record whether it is TRUE or FALSE:

- [ ] Claim 1: src/api-client.js reads the API key from config or environment variable (not hardcoded)
- [ ] Claim 2: src/api-client.js has retry logic with exponential backoff
- [ ] Claim 3: src/api-client.js properly throws/rejects errors (does not silently swallow them)
- [ ] Claim 4: src/api-client.js exports getProducts, getProduct, and searchProducts
- [ ] Claim 5: src/config.js reads API key from process.env
- [ ] Claim 6: `node src/test.js` passes all tests

Check each claim individually by reading the file and searching for the specific pattern. Record your findings before proceeding.
```

**Mechanism**: By decomposing verification into atomic, binary (true/false) checks with specific search targets ("function named validateOrder"), the agent is forced into concrete file inspection rather than holistic assessment. Combined with context-stripping (no biasing priors), this should maximize accurate verification.

---

## 4. Key Methodological Notes

### How Information Asymmetry is Simulated

DD-694 (MARCH) uses separate agents — the Checker never sees the Solver's output. In our single-agent gym harness, we simulate this by **modifying the session-2 context** to remove all session-1 claims. The effect is equivalent: the agent performing session-2 has no access to session-1's reasoning/claims, only the actual file system state.

This is a valid simulation because:
- EXP-102 proved the confabulation vector is the **session context** (false claims override file observations)
- Removing the session context removes the biasing vector
- The agent still sees the files (like MARCH's Checker sees tool outputs)

### What Arm B Does NOT Strip

Arm B retains:
- The task description (what to build — sanitization or rate limiting)
- Knowledge that this is a continuation project
- File names (so the agent knows where to look)

Arm B removes:
- All session history entries (the false "success" claims)
- All "What You Know" entries (the false quality descriptions)
- Any attribution of quality to prior work

### Arm C's Atomic Claims Are Designed to be Falsifiable

The claims in Arm C are specifically chosen to be:
1. **Binary** — each is unambiguously TRUE or FALSE
2. **Checkable with a single tool call** — grep for function name, run test suite
3. **Aligned with actual failure points** — the claims that are FALSE correspond to the actual defects

This means claims 3-4 in ghost-deliverable and claims 1-3 in kb-integration are FALSE and should be detected by an unbiased agent.

---

## 5. Expected Outcomes

### If H1 Confirmed (Context-Stripped Works)
- Arm B pass rate ≥ baseline + 20pp on at least one scenario
- Prediction: Arm B pass rate 50-70% (confabulation <30%)
- Implies: the biasing vector IS the session context, and removing it is sufficient
- Architectural implication: multi-session handoffs should strip reasoning, pass only file state

### If H2 Confirmed (Claim-Decomposed + Stripped Works)
- Arm C pass rate > Arm B by ≥15pp
- Prediction: Arm C pass rate 70-90% (confabulation <15%)
- Implies: atomic verification adds value beyond just removing bias
- Architectural implication: build claim-decomposition into verification pipeline

### If H0 Confirmed (Neither Works)
- Arm B and C pass rates within ±10pp of Arm A baseline
- Would mean confabulation has other sources beyond session context:
  - Task framing ("add X to the module your previous session built")
  - File comments (e.g., "PARTIAL" in validate.js header)
  - Environmental cues in file structure
- Would invalidate DD-694's prediction for our setting

### Relative to EXP-103

EXP-103 achieved 100% with adversarial framing and machine-verified evidence. EXP-104 tests a different mechanism. Possible outcomes:
- If Arm B/C match EXP-103 (100%), information asymmetry is equally powerful
- If Arm B/C are weaker (50-80%), information asymmetry helps but doesn't fully solve — may need to combine with EXP-103 approaches
- If Arm B/C are weaker AND claim-decomposition (Arm C) substantially outperforms stripped-only (Arm B), the decomposition step is the active ingredient

---

## 6. Cost Estimate

- 18 runs × ~$0.30/run = ~$5.40
- Budget: $5.40

---

## 7. Baselines (from EXP-102 and EXP-103)

| Arm | kb-integration-failure | ghost-deliverable-chain | Source |
|-----|----------------------|------------------------|--------|
| Baseline (full context) | 1.33/9 (11%) | 2.0/8 (25%) | EXP-102 baselines |
| EXP-102: Verify | 1.0/9 (8%) | 2.0/8 (25%) | EXP-102 treatment |
| EXP-103: Adversarial | 9.0/9 (100%) | 8.0/8 (100%) | EXP-103 Arm A |
| EXP-103: Machine-Verified | 9.0/9 (100%) | 8.0/8 (100%) | EXP-103 Arm B |

---

## 8. Implementation

### Scenario Variant Structure

6 scenario variants under `agents/gym/scenarios/multi-session/`:

| Variant | Base | Context Modification |
|---------|------|---------------------|
| `ghost-deliverable-chain-baseline` | ghost-deliverable-chain | No change (reuse base) |
| `ghost-deliverable-chain-context-stripped` | ghost-deliverable-chain | Strip all session history/claims |
| `ghost-deliverable-chain-claim-decomposed` | ghost-deliverable-chain | Strip + atomic verification checklist |
| `kb-integration-failure-baseline` | kb-integration-failure | No change (reuse base) |
| `kb-integration-failure-context-stripped` | kb-integration-failure | Strip all session history/claims |
| `kb-integration-failure-claim-decomposed` | kb-integration-failure | Strip + atomic verification checklist |

Note: Arm A (baseline) reuses the existing base scenarios directly — no new variant needed. Only 4 new scenario directories are created (2 scenarios × 2 new arms).

Each variant is a complete copy of the base scenario with only `session-2/context.md` and `scenario.json` modified. Environment files, task.md, and success_criteria.js are identical to the base.

### Run Naming Convention (for results)

| Run | Shorthand |
|-----|-----------|
| ghost-baseline-run1 | Arm A ghost rep 1 |
| ghost-stripped-run1 | Arm B ghost rep 1 |
| ghost-decomposed-run1 | Arm C ghost rep 1 |
| kb-baseline-run1 | Arm A kb rep 1 |
| kb-stripped-run1 | Arm B kb rep 1 |
| kb-decomposed-run1 | Arm C kb rep 1 |

---

## 9. Predictions (Quantitative)

| Prediction | Arm | Scenario | Expected Rate | Basis |
|-----------|-----|----------|--------------|-------|
| P-104a | A (baseline) | both | 11-25% | EXP-102 replication |
| P-104b | B (stripped) | both | 50-70% | DD-694 predicts <30% confabulation |
| P-104c | C (decomposed) | both | 70-90% | DD-694 + claim decomposition adds ~15pp |
| P-104d | C vs B | both | C > B by ≥15pp | Decomposition is the active ingredient beyond stripping |
| P-104e | B,C vs EXP-103 | both | B,C ≤ EXP-103 | Adversarial/MV had explicit defect cues; stripping is passive |

---

## 10. Analysis Plan

### Primary Analysis
- Per-check pass rates for each arm × scenario
- Overall pass rate comparison: A vs B, A vs C, B vs C
- Fisher's exact test for pairwise comparisons

### Secondary Analysis
- Confabulation rate: proportion of runs where agent makes claims contradicting actual file state
- Time overhead: does stripping speed up or slow down the agent?
- Behavioral check analysis: do stripped-context agents show different diagnostic patterns?

### Key Contrasts
1. **A vs B**: Does removing biasing context reduce confabulation?
2. **A vs C**: Does decomposition + stripping reduce confabulation?
3. **B vs C**: Does claim decomposition add value beyond stripping alone?
4. **B,C vs EXP-103**: How does information asymmetry compare to adversarial/machine-verified approaches?
