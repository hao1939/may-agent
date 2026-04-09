# DD#686: MedRoute — RL-Based Dynamic Specialist Routing in Multi-Agent Systems

**Paper**: Vayani et al. (2026). "MedRoute: RL-Based Dynamic Specialist Routing in Multi-Agent Medical Diagnosis"
**arXiv**: 2604.06180
**Date Added**: 2026-04-09
**Rating**: ★★★½ (Dynamic routing pattern directly applicable to agent orchestration)

## Key Claim

Static or predefined specialist selection in multi-agent LMM systems is suboptimal for medical diagnosis. An RL-trained router that dynamically selects specialists based on the input case significantly improves diagnostic accuracy.

## Architecture

1. **General Practitioner (GP)**: Initial assessment agent that processes the case
2. **RL-Trained Router**: Learns to select the optimal subset of specialist agents based on the GP's assessment — replaces static routing rules
3. **Specialist Agents**: Domain-specific LMM agents (each fine-tuned or prompted for a medical specialty)
4. **Moderator**: Aggregates specialist opinions into a final diagnosis

## Key Design Decisions

- Router is trained via RL, not rules or heuristics
- Dynamic selection — different cases route to different specialist subsets
- Mirrors real clinical workflows (GP → referral → specialists → synthesis)
- Code + models available: github.com/UCF-CRCV/MedRoute/

## Relevance to Our System

### MEDIUM-HIGH — Agent Orchestration Patterns
- **AgentGate parallel** (DD#667): MedRoute's RL router is the medical instantiation of AgentGate's adaptive gating. Both learn when to invoke specialists vs. handle directly.
- **Our dispatcher**: Currently rule-based (task type → agent). MedRoute shows RL-based routing outperforms static assignment for complex, heterogeneous inputs.

### MEDIUM — Multi-Agent Aggregation
- The Moderator pattern (synthesize multiple specialist outputs) is relevant to how Bob aggregates Scout/Coach/Coder outputs.
- Weighted aggregation learned via training, not hardcoded.

### LOW-MEDIUM — Scalability
- Adding new specialists doesn't require retraining the entire system — modular specialist addition. Relevant if we add new agent types.

## Connection to Prior Work

- **DD#667 (AgentGate)**: Same routing principle, different domain. MedRoute adds the RL training dimension.
- **CR#317 (Multi-Agent Orchestration Survey)**: MedRoute is a concrete instantiation of the dynamic orchestration patterns surveyed.
- **DD#682 (SWE-PRM)**: Process supervision in diagnosis parallels process supervision in coding — verifiable intermediate steps.

## Tags
`multi-agent` `routing` `rl-router` `orchestration` `specialist-selection`
