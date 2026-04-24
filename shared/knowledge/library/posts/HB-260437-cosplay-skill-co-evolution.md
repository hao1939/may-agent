# COSPLAY: Co-Evolving LLM Decision and Skill Bank Agents

**Source**: arXiv:2604.20987 (April 22, 2026)  
**Authors**: Xiyang Wu, Zongxia Li, Guangyao Shi, et al. (UMD/CMU collaboration)  
**Tags**: #skill-evolution #long-horizon-tasks #co-evolution #agent-learning

---

## TL;DR

COSPLAY introduces a **co-evolution framework** where an LLM decision agent and a skill bank agent mutually improve each other. The decision agent retrieves skills to guide actions, while the skill pipeline extracts reusable skills from unlabeled rollouts. An **8B model** with COSPLAY achieves **+25.1% average reward improvement** against frontier LLM baselines (GPT-4, Claude, etc.) on single-player game benchmarks.

---

## Core Architecture

### Dual-Agent Co-Evolution System

```
┌─────────────────┐         ┌─────────────────┐
│  LLM Decision   │◄───────►│   Skill Bank    │
│     Agent       │  retrieve│    Agent        │
└────────┬────────┘         └─────────────────┘
         │                           ▲
         │ actions                   │ extract
         ▼                           │
┌─────────────────┐         ┌───────┴─────────┐
│   Environment   │────────►│ Unlabeled Rollouts
│   (Game/Task)   │  observe│ (trajectories)  │
└─────────────────┘         └─────────────────┘
```

### Key Components

1. **Decision Agent**:
   - Retrieves relevant skills from skill bank
   - Generates actions based on skill guidance
   - Learns better skill retrieval over time

2. **Skill Bank Agent**:
   - Discovers skills from unlabeled rollouts (no human annotation)
   - Extracts, refines, and updates skills with "contracts" (preconditions/effects)
   - Continuously expands skill library

3. **Co-Evolution Loop**:
   - Better skills → better decision making
   - Better rollouts → better skill discovery
   - Mutual improvement without external supervision

---

## Experimental Results

### Performance Gains

| Environment | COSPLAY (8B) vs Frontier LLMs | Improvement |
|-------------|------------------------------|-------------|
| Single-player games | vs GPT-4, Claude, Gemini | **+25.1%** average reward |
| Multi-player social games | Competitive performance | Maintained |

### Key Findings

- **Small model + skills > Large model**: 8B with COSPLAY beats frontier LLMs
- **Skill reuse critical**: Long-horizon tasks require structured skill chaining
- **No human annotation**: Skills discovered purely from agent rollouts
- **Cross-episode transfer**: Skills retained and reused across episodes

---

## What Makes This Different

| Approach | Limitation | COSPLAY Solution |
|----------|-----------|------------------|
| In-context skill learning | Skills forgotten each episode | Persistent skill bank |
| Pre-defined skill libraries | Limited coverage | Dynamic skill discovery |
| Imitation learning | Requires expert demonstrations | Learns from own rollouts |
| Standard RL | No structured skill abstraction | Explicit skill representation |

---

## Implications for Our System

### 1. Skill Co-Evolution Architecture

**Our current approach**: Static skills defined in `agents/<name>/skills/`

**COSPLAY suggests**: Skills should co-evolve with execution experience

**Potential implementation**:
```
session execution ──► trajectory analysis ──► skill extraction
      ▲                                              │
      └────────── improved skills ◄──────────────────┘
```

### 2. Skill "Contracts" Concept

COSPLAY skills include contracts (preconditions/effects) — similar to STRIPS planning operators:
- **Preconditions**: When is this skill applicable?
- **Effects**: What does this skill achieve?
- **Invariants**: What does this skill preserve?

This could improve our skill routing and validation.

### 3. Unlabeled Rollout Learning

We generate rich execution data (sessions, trajectories) but don't systematically extract reusable patterns. COSPLAY shows this is a viable learning signal.

### 4. Small Model Viability

COSPLAY's 8B model beating frontier LLMs suggests our approach of:
- Structured skills
- Explicit reasoning
- Resource-constrained execution

...is fundamentally sound. Capability comes from organization, not just scale.

---

## Open Questions

1. **Skill granularity**: What makes a good skill unit? Too fine = combinatorial explosion; too coarse = limited reusability
2. **Skill validation**: How to verify extracted skills are correct and useful?
3. **Forgetting strategy**: How to manage skill bank growth? (Related to H-067 Budgeted Forgetting)
4. **Multi-agent skills**: Can skills be shared across different agent types?

---

## Cross-References

- **SYNTHESIS-004**: Self-evolution and learning patterns
- **H-067**: Budgeted forgetting for memory management
- **HB-260434**: Tool Attention (similar efficiency-through-architecture theme)
- **HB-260436**: DiffMAS (multi-agent learning)

---

## Actionable Items

1. **Design skill extraction pipeline**: Analyze session trajectories to identify reusable patterns
2. **Add skill metadata**: Precondition/effect annotations for better routing
3. **Prototype skill evolution**: Start with simple parameter tuning based on success rates
4. **Benchmark small models**: Test if structured skills enable smaller model deployment

---

*Collected: 2026-04-26 | Amy-Kimi Heartbeat Session*
