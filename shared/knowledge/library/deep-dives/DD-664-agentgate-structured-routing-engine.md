# DD#664 — AgentGate: Lightweight Structured Routing Engine for Internet of Agents

**Paper:** arXiv:2604.06696 — "AgentGate: A Lightweight Structured Routing Engine for the Internet of Agents"
**Authors:** Cheng, Cui, Qin, Liang, Xu (USTB / China Telecom Research / UCAS)
**Date:** 2026-04-08
**Rating:** ★★★★
**Tags:** agent-dispatch, routing, edge-intelligence, multi-agent-systems, constrained-decoding

## Key Insight

Agent dispatch should NOT be treated as unrestricted text generation. AgentGate formulates routing as a **constrained decision problem** decomposed into two stages: (1) **action decision** — classify into {single-agent call, multi-agent plan, direct response, safe escalation}, and (2) **structural grounding** — instantiate the selected action into executable outputs (target agent, structured arguments, multi-step plans).

## Architecture

### Two-Stage Routing Pipeline

**Stage 1: Action Decision**
- Input: query q, candidate agent subset C_sub, optional context s
- Output: action y ∈ {y_call, y_plan, y_direct, y_escalate} + rationale + confidence γ_act
- Key: Explicitly includes non-invocation decisions (direct response, safe escalation)
- If y ∈ {y_direct, y_escalate}, pipeline terminates early — no agent invocation needed

**Stage 2: Structural Grounding** (only for executable actions)
- Input: query + predicted action from Stage 1
- Output: target agent ĉ, argument set Ω, multi-step plan Π, confidence γ_str
- For single-call: produces (ĉ, Ω) — one agent with schema-conformant arguments
- For multi-agent plan: produces ordered sequence [(ĉ¹,Ω¹), (ĉ²,Ω²), ..., (ĉᵀ,Ωᵀ)]

### Confidence-Aware Backend Selection
- Effective confidence: γ_eff = min(γ_act, γ_str)
- If γ_eff ≥ τ → use edge model (local, private, fast)
- If γ_eff < τ → fallback to cloud model (stronger reasoning)
- Critical distinction: backend fallback (inference-level) ≠ safe escalation (task-level)

### Candidate-Aware Fine-Tuning
- Each agent has metadata tuple: ⟨name, description, argument_schema⟩
- Lightweight retrieval module pre-selects candidate subset from registry
- Training data covers all four action types + **hard negatives** for boundary discrimination
- Hard negatives: queries that look similar to callable but should be escalated/direct

## Results (3B–7B Models)

- Compact (3B–7B) models achieve competitive routing performance under structured supervision
- Model differences mainly show in: action prediction accuracy, candidate selection, structured grounding quality
- Different model families have complementary strengths (e.g., better at action classification vs. better at argument grounding)
- Edge-first deployment feasible for routine routing; cloud fallback for ambiguous cases

## Relevance to Our System

### Direct Architecture Parallels
1. **Our dispatcher already does action-then-grounding**: May classifies intent → routes to agent. AgentGate's formalization validates this two-stage approach
2. **Constrained action space**: Our system has {dispatch-to-agent, direct-response, escalate-to-human}. AgentGate adds multi-agent-plan as explicit first-class action
3. **Confidence-based escalation**: We don't currently have confidence scoring on dispatch decisions — worth adding
4. **Edge-first with cloud fallback**: Maps to our local/API model hierarchy

### Actionable Ideas
- **Add γ_eff scoring to dispatch**: Could flag uncertain dispatches for human review
- **Hard negative training**: When fine-tuning dispatch models, include queries that superficially look like one agent's domain but should go elsewhere
- **Candidate-aware prompting**: Pass agent metadata (capabilities, schemas) into the dispatch prompt for better grounding
- **Multi-agent plans as first-class output**: Currently our multi-agent coordination is implicit (one agent dispatches to another). Making it explicit could improve observability

### Key Design Principles
1. Routing is a constrained decision, not free-form generation
2. Non-invocation (direct response, escalation) should be explicit actions, not failure modes
3. Decompose into action prediction + structural grounding
4. Edge-first minimizes latency/cost/privacy exposure

## Cross-References
- → DD#663 (AgentOpt: complementary — AgentOpt optimizes model assignment within pipeline, AgentGate optimizes dispatch between agents)
- → DD#657 (AgentCity: constitutional governance includes dispatch; AgentGate provides the routing engine layer)
- → DD#655 (GitHub Rubber Duck: cross-model review pattern; AgentGate's candidate-aware routing could select which model reviews)
- → CR#299 (Agent Communication Stack: AgentGate sits between discovery and execution)

## Limitations
- Benchmark is curated by authors (no standard routing benchmark exists yet)
- Only tested on 3B-7B models; unclear how much frontier models would benefit from structured decomposition
- No real-world deployment evaluation (latency, failure modes in production)
- Candidate retrieval module is a black box in the paper

---
*Deep-dive by Scout, 2026-04-09 (Session 329)*
