# KE-077: Structured Routing and Agent Orchestration — Constrained Decisions, Not Free-Form Generation

**Status:** Verified (multi-source convergence)
**Source:** DD-664 (AgentGate, arXiv:2604.06696), DD-666 (Qualixar OS, arXiv:2604.06392)
**Created:** 2026-04-09 by Bob
**Connections:** KE-075 (pipeline optimization), KE-070 (governance/separation of power), KE-074 (verification design), DD-663 (AgentOpt), DD-657 (AgentCity)

---

## Core Finding

Two independent systems — AgentGate (academic, USTB/China Telecom) and Qualixar OS (independent researcher) — converge on the same fundamental principle: **agent dispatch is a constrained decision problem, not unrestricted text generation**. Treating routing as structured classification with explicit action types, confidence scoring, and grounded outputs produces more reliable multi-agent coordination than free-form LLM generation.

## Key Principles (Converged)

### 1. Explicit Action Space with Non-Invocation as First Class
**AgentGate** decomposes routing into four explicit actions:
- `y_call` — single-agent invocation
- `y_plan` — multi-agent plan (ordered sequence of agents)
- `y_direct` — direct response (no agent needed)
- `y_escalate` — safe escalation to human

Critical insight: **non-invocation decisions (direct response, escalation) should be explicit actions, not failure modes**. When the system decides NOT to dispatch to an agent, that's a positive routing decision, not a fallback.

**Our system parallel**: May currently has {dispatch-to-agent, direct-response, escalate-to-human}. AgentGate validates this but adds multi-agent-plan as an explicit first-class action — our multi-agent coordination is currently implicit (one agent dispatches to another).

### 2. Two-Stage Pipeline: Action Decision → Structural Grounding
**AgentGate's** decomposition:
- **Stage 1 (Action Decision)**: Classify intent → action type + rationale + confidence γ_act
- **Stage 2 (Structural Grounding)**: Instantiate the action → target agent + schema-conformant arguments + confidence γ_str
- Pipeline terminates early for `y_direct` and `y_escalate` — no unnecessary grounding

This mirrors our own dispatcher architecture (intent classification → agent routing), but AgentGate adds formalized confidence scoring at each stage.

### 3. Confidence-Aware Backend Selection
**AgentGate**: Effective confidence γ_eff = min(γ_act, γ_str)
- If γ_eff ≥ τ → use edge model (local, private, fast)
- If γ_eff < τ → fallback to cloud model (stronger reasoning)
- Key distinction: backend fallback (inference-level) ≠ safe escalation (task-level)

**Relevance**: Maps to our local/API model hierarchy. Currently we don't score confidence on dispatch decisions — adding γ_eff could flag uncertain dispatches for human review.

### 4. Topology as First-Class Concept
**Qualixar OS** provides 12 multi-agent topologies (grid, forest, mesh, maker patterns, etc.) with formal termination conditions and message-passing protocols.

**Our system**: Has implicit topologies — Hao→May→agents is hierarchical; Bob's experiments are sequential; Coach↔Bob is peer advisory. Making topologies explicit could improve observability and allow systematic optimization.

### 5. Quality Assurance for Agent Systems
**Qualixar OS** notable ideas:
- **Goodhart detection**: Cross-model entropy monitoring detects when evaluation judges game metrics. If evaluator always agrees with generator, entropy drops → signal of metric gaming
- **Jensen-Shannon divergence for drift detection**: Monitor output distribution drift with JS divergence threshold (Θ=0.877)
- **Behavioral contracts**: Design-by-contract for agent teams — formal pre/post conditions

**Connection to KE-074**: Universal Verifier (DD-662) showed verification quality is architectural, not model-dependent. Qualixar OS extends this with runtime monitoring (Goodhart detection, drift bounds) rather than just design-time principles.

## Actionable Ideas for Our System

### High Priority
1. **Add confidence scoring to dispatch**: Could flag uncertain routing decisions for human review
2. **Explicit multi-agent plans**: Make multi-agent coordination explicit rather than emergent
3. **Hard negative training data**: When tuning dispatch, include queries that superficially look like one agent's domain but should go elsewhere
4. **Candidate-aware prompting**: Pass agent metadata (capabilities, schemas) into dispatch prompts

### Medium Priority
5. **Cross-model entropy for evaluator integrity**: Monitor whether our evaluator pipeline shows signs of metric gaming
6. **Jensen-Shannon drift monitoring**: Track whether experiment results or agent behavior distributions shift over time
7. **Topology documentation**: Explicitly document our system's communication topology for observability

### Lower Priority (from Qualixar OS — less validated)
8. **Three-layer model routing**: Bandit→strategy→POMDP is more sophisticated than our model selection, but Qualixar's empirical validation is weak
9. **Behavioral contracts**: Formal pre/post conditions for agent dispatch — promising but unproven at scale

## Connections to Existing Knowledge

| Entry | Connection |
|-------|-----------|
| KE-075 | Pipeline optimization via model selection — AgentGate's routing + AgentOpt's step-level selection are complementary layers |
| KE-070 | Separation of power in governance — AgentGate's action space formalizes the execution layer; constitutional governance (DD-657) provides the legislative layer |
| KE-074 | Verification architecture — Qualixar's Goodhart detection extends verification from design-time (DD-662) to runtime monitoring |
| KE-073 | Decentralized regulation — routing decisions could emerge from agent collectives rather than central dispatch |
| H-054 | Evaluator accuracy — cross-model entropy as a cheap signal for evaluator reliability |

## Limitations
- AgentGate: Benchmark is author-curated (no standard routing benchmark); only tested on 3B-7B models
- Qualixar OS: Kitchen-sink breadth, weak evaluation ("100% accuracy" on 20-task suite), single-author, not peer-reviewed
- Neither system has production deployment evaluation
- Confidence thresholds (τ) need per-system calibration

## Open Questions
1. What is the optimal action space granularity for our dispatch? (4 actions may be too few, 12 topologies too many)
2. Can Goodhart detection be applied to our evaluator pipeline with current logging?
3. Would explicit multi-agent planning improve our parallel research workflow (cf. meta-harness design)?

---
*Synthesized by Bob, 2026-04-09*
