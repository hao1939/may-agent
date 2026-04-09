# DD#689: Sherlock — Selective Verification for Agentic Workflows via Counterfactual Analysis

**Paper:** arXiv:2511.00330 — "Sherlock: Reliable and Efficient Agentic Workflow Execution" (Ro et al., UT Austin/Microsoft, 2025)
**Venue:** cs.MA / cs.SE
**Date:** November 2025
**Focus:** Workflow verification, error propagation, speculative execution, cost-optimal verification

## Core Problem

Verifying every step of an agentic workflow (self-reflection, debate, LLM-as-judge) introduces significant latency and cost. But NOT verifying leads to cascading errors — incorrect output at one step propagates and amplifies through subsequent stages.

## Key Innovation: Selective, Speculative Verification

Sherlock answers three questions:
1. **Which nodes are error-prone?** → Counterfactual analysis identifies which workflow steps most impact final output quality
2. **Which verifier for each node?** → Cost-optimal verifier selection (not one-size-fits-all)
3. **How to verify without blocking?** → Speculative execution of downstream tasks while verification runs in background; rollback on failure

### Architecture
```
Workflow Graph → Counterfactual Analysis → Error-Prone Node Identification
                                         → Cost-Optimal Verifier Assignment
                                         → Speculative Execution Engine
                                              ↓
                                         Background Verification
                                              ↓
                                    Pass: Continue / Fail: Rollback
```

## Key Results
- **+18.3% accuracy** over non-verifying baseline (averaged across benchmarks)
- **48.7% latency reduction** vs non-speculative (verify-then-proceed) execution
- **26.0% cost reduction** vs Monte Carlo search-based verification

## Connections to Our Work

1. **Verification Gravity Wells (EXP-099 / CIVC)**: Sherlock's counterfactual analysis provides an operational implementation of identifying where verification matters most — directly applicable to finding CIVC onset points.

2. **DynaTrust (DD#424)**: Sherlock operates at the workflow level while DynaTrust operates at the agent trust level. Combined: trust-weighted agent selection (DynaTrust) + selective step verification (Sherlock) = two-layer defense.

3. **Helium (DD#423)**: Both exploit workflow-level visibility for efficiency. Helium optimizes compute/KV-cache; Sherlock optimizes verification budget. Could share workflow graph representation.

4. **Cost of Verification**: The 26% cost reduction over Monte Carlo methods validates our thesis that verification must be budgeted, not applied uniformly. This connects to the Budget-Aware Verification Tree (DD#274/BAVT) principle.

5. **Speculative Execution Pattern**: This is a powerful architectural primitive. Execute optimistically, verify in background, rollback on failure. Applicable beyond LLM workflows — could apply to multi-agent task delegation.

## Critical Design Pattern: Speculative-Verify-Rollback

```
1. Dispatch task to downstream agent(s) immediately
2. In parallel: verify current step's output 
3. If verification passes: downstream work continues (saved latency)
4. If verification fails: rollback to last verified state, re-execute from corrected output
```

This turns verification from a blocking gate into a background safety net. The key insight is that MOST steps pass verification, so speculative execution wins on average.

## Limitations
- Requires workflow DAG structure (not suitable for free-form agent interaction)
- Counterfactual analysis requires training data / historical execution traces
- Rollback mechanism assumes downstream work can be discarded and re-executed

## Prediction
Speculative verification will become the default execution model for structured agentic workflows within 12 months. The "verify-then-proceed" synchronous model will be recognized as unnecessarily slow.

## Tags
`verification` `workflow-reliability` `speculative-execution` `error-propagation` `counterfactual-analysis` `cost-optimal` `rollback`
