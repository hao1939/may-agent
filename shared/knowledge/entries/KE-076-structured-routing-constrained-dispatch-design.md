# KE-076: Structured Routing — Constrained Dispatch as Two-Stage Decision Architecture

**Status**: Theoretically Grounded (architecture validated on 3B-7B models, no standard benchmark)
**Source**: DD-664 (AgentGate: A Lightweight Structured Routing Engine for Internet of Agents — Cheng et al., USTB/China Telecom/UCAS)
**Confidence**: Medium-High (consistent across model families, validated architecture pattern, but no standard routing benchmark)
**Created**: 2026-04-09

---

## One-Sentence Summary

Agent dispatch should be formulated as a **constrained decision problem** decomposed into two stages — (1) action classification {single-call, multi-plan, direct-response, escalation} and (2) structural grounding of the selected action into executable form — with confidence-based backend selection enabling edge-first deployment with cloud fallback.

---

## The Finding

### Core Principle: Routing ≠ Free-Form Generation

The key insight is that dispatch decisions are **not** text generation problems. They're constrained classification + structured instantiation. Treating them as such enables smaller models (3B-7B) to achieve competitive routing quality.

### Two-Stage Pipeline

**Stage 1: Action Decision**
- Classify incoming query into explicit action space: {single-agent call, multi-agent plan, direct response, safe escalation}
- Critical: non-invocation decisions (direct response, escalation) are **first-class actions**, not failure modes
- Produces action type + rationale + confidence γ_act

**Stage 2: Structural Grounding** (only for executable actions)
- Instantiate the chosen action: target agent, argument schema, multi-step plan
- For single-call: (agent, arguments) with schema-conformant outputs
- For multi-agent: ordered sequence [(agent₁, args₁), ..., (agentₜ, argsₜ)]
- Produces structured output + confidence γ_str

### Confidence-Aware Backend Selection
- Effective confidence: γ_eff = min(γ_act, γ_str)
- High confidence → edge model (local, fast, private)
- Low confidence → cloud fallback (stronger reasoning)
- Key distinction: **backend fallback (inference-level) ≠ safe escalation (task-level)**

### Hard Negative Training
- Include queries that superficially resemble one agent's domain but should be escalated or handled directly
- Improves boundary discrimination — prevents over-routing

---

## Why This Matters

### 1. Direct Validation of Our Dispatch Architecture

Our May dispatcher already implements a form of action-then-grounding: classify intent → route to agent. AgentGate formalizes this as principled architecture:

| AgentGate Concept | Our System Equivalent | Gap |
|---|---|---|
| Action decision (4 types) | May classifies intent | We lack explicit "direct response" and "escalation" as tracked actions |
| Structural grounding | May routes to agent with context | We don't generate structured argument schemas |
| Confidence scoring (γ_eff) | None | **Missing** — all dispatches treated equally |
| Hard negatives | None | **Missing** — no adversarial training for dispatch boundary |
| Multi-agent plan | Implicit (agent-to-agent) | Not first-class; could improve observability |

### 2. Confidence-Based Dispatch Quality Signal

The γ_eff = min(γ_act, γ_str) scoring provides a **dispatch quality signal** that could:
- Flag uncertain dispatches for human review
- Enable Hao to detect when May is guessing
- Track dispatch confidence over time as a system health metric
- Trigger fallback to more capable model when confidence is low

### 3. Connects to Cost Optimization Pipeline

AgentGate's edge-first deployment complements KE-075 (client-side pipeline optimization):
- KE-075: optimize model selection within pipeline steps (cost 13-32× gap)
- KE-076: optimize the routing layer that decides which pipeline to invoke
- Together: route cheaply AND execute cheaply

### 4. Non-Invocation as First-Class Action

Most routing systems (including ours) treat "no agent needed" as an implicit case. Making direct-response and escalation explicit actions:
- Prevents unnecessary agent invocations
- Reduces cost when query can be answered directly
- Enables tracking of escalation rate as system maturity metric

---

## Extends the Knowledge Web

| Existing KE | How KE-076 Extends It |
|---|---|
| KE-075 (Client-Side Pipeline Optimization) | Complementary: KE-075 optimizes within-pipeline model selection, KE-076 optimizes between-pipeline routing |
| KE-050 (Robustness-Architecture Nexus) | Confirms architecture > model: structured routing enables 3B-7B models to match larger models |
| KE-074 (Universal Verification Design) | Confidence scoring on dispatch parallels process/outcome separation — routing confidence is a process signal |
| KE-047 (System Architecture) | Routing layer design directly informs our harness architecture |

---

## Limitations

1. **No standard routing benchmark**: Authors curated their own evaluation suite
2. **Only tested on 3B-7B**: Unclear how much frontier models benefit from structured decomposition
3. **No production deployment data**: Latency, failure modes, and edge cases untested
4. **Candidate retrieval is a black box**: How agent metadata is selected for prompt injection is underspecified

---

## Predictions

- **P-076-1**: Adding dispatch confidence scoring to our system will reveal that 10-20% of dispatches are low-confidence. (70% confidence)
- **P-076-2**: Making "direct response" an explicit tracked action will reduce unnecessary agent invocations by 5-15%. (65% confidence)
- **P-076-3**: Structured routing will become the standard approach for multi-agent dispatch within 12 months. (75% confidence)

---

## Connections

- **Complements**: KE-075 (Pipeline Optimization) — routing layer + execution layer = full cost optimization stack
- **Validates**: Our May dispatcher architecture — two-stage action-then-grounding is principled
- **Identifies gap**: No dispatch confidence scoring in our system
- **Cross-refs**: DD-663 (AgentOpt — within-pipeline), DD-657 (AgentCity — constitutional governance includes dispatch), DD-666 (Qualixar OS — broader orchestration)

---

## Actionable Implications

1. **MEDIUM PRIORITY**: Add confidence scoring to May's dispatch decisions — even heuristic-based initially
2. **MEDIUM**: Track "direct response" and "escalation" as explicit action types alongside agent dispatches
3. **LOW**: Explore hard negative training data for dispatch boundary cases
4. **LOW**: Consider multi-agent plan as first-class dispatch output for complex queries

---

## Open Questions

1. What is our current dispatch accuracy? Without measurement, we can't know if structured routing would help.
2. Could a lightweight classifier (local model) handle routine dispatches with cloud fallback for ambiguous cases?
3. How would confidence-based dispatch interact with our existing session management?

---
*Bob synthesis from DD-664 | 2026-04-09*
