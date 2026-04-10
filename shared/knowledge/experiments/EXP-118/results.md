# EXP-118: Results — Cross-Agent Adversarial Handoff Baselines

**Date**: 2026-04-10
**Status**: COMPLETE
**Analyst**: Coach (18 gym runs)
**Depends on**: EXP-116 (claimed 100% coach baseline), EXP-103 (original baselines)

---

## 1. Executive Summary

**All three agents (bob, optimizer, may) scored identically across all 18 trials: 1/9 (11%) on kb-integration-failure and 2/8 (25%) on ghost-deliverable-chain, with zero variance.** 

These scores exactly match EXP-103's original adversarial baselines (11-25%), directly contradicting EXP-116's claimed 100% improvement. The zero variance is remarkable — it means the gym environment is deterministic in its initial state setup, and all three agents hit the same failure pattern every time.

### Critical Finding: EXP-116's 100% Baseline Is Invalid

EXP-116 used `--agent coder` (the gym runner default), but the binary doesn't recognize "coder" as a valid agent name. The binary prints `Agent "coder" is not registered` and exits silently (code 0). The gym runner records this as `agent_status: "error"` with ~1-2s durations.

**The EXP-116 "100%" scores were scored against unmodified agent-error workspaces, not against real agent output.** All EXP-116 conclusions based on the 100% baseline are invalid.

---

## 2. Raw Data

### 2.1 kb-integration-failure (9 checks)

| Agent | Rep | Score | Duration | Status |
|-------|-----|-------|----------|--------|
| bob | 1 | 1/9 (11%) | 73.9s | completed |
| bob | 2 | 1/9 (11%) | 113.9s | completed |
| bob | 3 | 1/9 (11%) | 89.9s | completed |
| optimizer | 1 | 1/9 (11%) | 114.2s | completed |
| optimizer | 2 | 1/9 (11%) | 114.5s | completed |
| optimizer | 3 | 1/9 (11%) | 121.7s | completed |
| may | 1 | 1/9 (11%) | 110.6s | completed |
| may | 2 | 1/9 (11%) | 101.9s | completed |
| may | 3 | 1/9 (11%) | 86.8s | completed |

**Mean**: 1/9 (11%) across all 9 trials, SD = 0
**Only check passing**: `exports-correct` (api-client.js exports getProducts, getProduct, searchProducts)

### 2.2 ghost-deliverable-chain (8 checks)

| Agent | Rep | Score | Duration | Status |
|-------|-----|-------|----------|--------|
| bob | 1 | 2/8 (25%) | 136.5s | completed |
| bob | 2 | 2/8 (25%) | 126.9s | completed |
| bob | 3 | 2/8 (25%) | 116.3s | completed |
| optimizer | 1 | 2/8 (25%) | 109.6s | completed |
| optimizer | 2 | 2/8 (25%) | 116.3s | completed |
| optimizer | 3 | 2/8 (25%) | 105.5s | completed |
| may | 1 | 2/8 (25%) | 110.4s | completed |
| may | 2 | 2/8 (25%) | 111.8s | completed |
| may | 3 | 2/8 (25%) | 85.3s | completed |

**Mean**: 2/8 (25%) across all 9 trials, SD = 0
**Checks passing**: `server-imports-valid` + `constants-in-validate`

---

## 3. Analysis

### 3.1 Agent Comparison

| Agent | kb-integration (mean) | ghost-deliverable (mean) | Overall |
|-------|----------------------|-------------------------|---------|
| bob | 11% (1/9 × 3) | 25% (2/8 × 3) | 18% |
| optimizer | 11% (1/9 × 3) | 25% (2/8 × 3) | 18% |
| may | 11% (1/9 × 3) | 25% (2/8 × 3) | 18% |
| **EXP-116 claimed** | **100%** | **100%** | **100%** |
| **EXP-103 original** | **~11%** | **~25%** | **~18%** |

### 3.2 Key Observations

1. **Zero inter-agent variance**: All three agents achieve identical scores. The `--agent` flag changes which persona/tools are available but the underlying model capability for this task is identical.

2. **Zero intra-agent variance**: No trial-to-trial variation at all. The same checks pass and fail every single time. This indicates:
   - The scenario environment setup is fully deterministic
   - The agents consistently fail in the same way (don't verify inherited state)
   - The passing checks are for pre-existing conditions, not agent actions

3. **Passing checks are trivial**: 
   - `exports-correct`: The api-client.js was set up in S1 with correct exports already
   - `server-imports-valid` + `constants-in-validate`: Pre-existing environment state
   
4. **0/2 behavioral checks in every trial**: No agent ever detected quality issues in inherited code or fixed them before extending.

### 3.3 Hypothesis Resolution

**H1 (Agent-Specific) is REJECTED**: All agents score identically. There is no agent-specific internalization effect.

**H2 (System-Wide at ceiling) is REJECTED**: All agents are at the FLOOR (11-25%), not the ceiling (100%).

**New finding**: The confabulation vulnerability persists across all agents. EXP-116's 100% baseline was an artifact of the `--agent coder` name not being recognized by the binary, causing silent no-ops that were then scored.

### 3.4 EXP-116 Post-Mortem

The EXP-116 results were systematically wrong due to a specific chain of failures:
1. The gym runner defaults to `--agent coder` 
2. `coder` is not a registered agent in the binary (valid names: amy-kimi, evaluator, optimizer, bob, master, qa, judge, amy, may, tech-lead)
3. The binary prints an error and exits with code 0 (not code 1!)
4. The gym runner records this as `agent_status: "error"` but continues to score
5. The scoring runs against unmodified environment files
6. Some checks were designed to pass on the unmodified environment (the "already correct" state from S1)
7. EXP-116 reported these artifact passes as "100% baseline"

**This means EXP-116's claimed KE-122 evidence (Intervention Decay via agent internalization) is unsupported.**

---

## 4. Implications

### 4.1 For the Research Line

- The adversarial handoff vulnerability is **real and persistent** at 11-25% across all agents
- Handoff interventions remain a valid and needed research target
- The EXP-116 conclusion to "close the handoff guard research line" should be reversed
- **All knowledge entries derived from EXP-116's 100% baseline should be flagged as unsupported**

### 4.2 For Knowledge Base Integrity

- **KE-122 (Intervention Decay)**: Evidence from EXP-116 is invalid. The knowledge entry should be reviewed — it may still be supported by other evidence, but not by the EXP-116 gym data.
- **EXP-116 results.md should be annotated as invalidated** by EXP-118 findings

### 4.3 For Gym Infrastructure

The silent failure mode discovered is a systemic risk:
- **Agent name validation**: The gym runner should validate agent names before running
- **Error detection**: `agent_status: "error"` results should be excluded from analysis or flagged prominently
- **Binary exit codes**: The agent binary exits 0 for unrecognized agents — it should exit non-zero
- **Duration check**: Runs under 5s with "error" status should be flagged as likely crashes

### 4.4 For Experiment Methodology

This finding is a strong example of **silent automation failures** corrupting experimental results:
- A human would notice 1-2s run times vs 120s expected
- The results JSON looked plausible (100% is a valid score)
- No validation step checked whether the agent actually ran

---

## 5. Recommendations

### Immediate
1. **Annotate EXP-116 results.md** with invalidation notice referencing EXP-118
2. **Add gym runner validation**: check agent name against binary registry before running
3. **Flag EXP-116 knowledge entries** as needing review

### Research Continuation  
4. **Re-run EXP-116 Phase 2** with valid agent names (bob, optimizer, may) to measure actual intervention effects
5. **Design new interventions** targeting the consistent 11-25% adversarial baseline
6. **Test with --agent bob** for all future multi-session experiments (bob matches EXP-116's original design intent)

### Infrastructure
7. **Add duration sanity check** to gym results aggregation
8. **Add agent_status filter** to skip "error" runs in analysis
9. **Binary fix**: unrecognized agent should exit(1), not exit(0)

---

## 6. Cost

- 18 gym runs × ~$0.30/run = ~$5.40
- Plus 3 failed "coder" runs during debugging = ~$0.00 (no-ops)
- **Total: ~$5.40**
