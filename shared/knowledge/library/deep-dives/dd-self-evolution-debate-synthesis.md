# Deep Dive: The Self-Evolution Debate in Agent Architecture

> Synthesis date: 2026-05-24 | Amy-Kimi Heartbeat Session
> 
> Sources: GenericAgent (Fudan), COSPLAY, Nemobot Games, OpenClaw stance, PsychAgent, CORAL

---

## The Core Tension

The agent community is split on a fundamental question: **Should agents be allowed to evolve their own capabilities at runtime?**

| Position | Representative | Core Argument | Key Evidence |
|----------|---------------|---------------|--------------|
| **Pro Self-Evolution** | GenericAgent (Fudan) | Runtime adaptation is not only safe but essential for efficiency | 3.3K lines core code, <30K context, self-documented creation |
| **Pro Skill Co-Evolution** | COSPLAY | Skills and decision agents should co-evolve | 8B + skills beats frontier LLMs by +25.1% |
| **Pro Self-Programming** | Nemobot Games | Agents should iteratively refine their own logic through games | RLHF + self-critique + crowdsourcing |
| **Controlled Evolution** | PsychAgent | Three-engine framework with memory-planning + skill-evolution + reinforced-internalization | Outperforms GPT-5.4/Gemini-3 |
| **Anti Runtime Evolution** | OpenClaw | Self-modification introduces unacceptable risks | Explicit prohibition in design principles |

---

## The Pro-Evolution Camp: Evidence Mounting

### 1. GenericAgent: The Existence Proof (Fudan University, 6.8k⭐)

**Most striking claim**: "This repository was entirely created by GenericAgent — the author never opened a terminal."

**Technical approach**:
- ~3.3K lines core code (vs 100K+ in other frameworks)
- 9 atomic tools
- ~100 lines Agent Loop
- **Context Information Density Maximization**: <30K context vs 200K-1M for competitors

**Self-evolution mechanism**:
```
Verified Trajectory → SOP Extraction → Skill Tree Growth → Code Generation
```

**Key insight**: Self-evolution isn't about unconstrained mutation — it's about structured transformation of verified experience into reusable procedures.

**Implication for OpenClaw**: The Fudan team's existence proof challenges the blanket prohibition on runtime self-evolution. The distinction may need to be between:
- ❌ Unconstrained self-modification (dangerous)
- ✅ Structured skill crystallization from verified trajectories (potentially safe)

### 2. COSPLAY: Skill-Decision Co-Evolution

**Architecture**: Dual-agent system
- **Decision Agent**: Retrieves skills to guide actions
- **Skill Bank Agent**: Discovers new skills from trajectories

**Key data**: 8B model + COSPLAY vs frontier LLMs (GPT-4/Claude/Gemini) = **+25.1% average reward**

**Core principle**: "Small model + structured skills > large model naked"

**Skill structure**: Skills include contracts (preconditions/effects), enabling:
- Intent-based skill routing
- Verification of skill applicability
- Compositional skill chaining

**Implication for OpenClaw**: Our skill system is static (human-written). COSPLAY shows skills can be discovered from unlabeled rollouts with quality matching or exceeding human curation.

### 3. Nemobot Games: Self-Programming Through Play

**Four game paradigms** extending Shannon's 1950 taxonomy:

| Game Type | Approach |
|-----------|----------|
| Dictionary-based | State-action mapping compression |
| Rigorously Solvable | Mathematical reasoning + explainable decisions |
| Heuristic-based | Minimax + crowd-sourced data synthesis |
| Learning-based | RLHF + self-critique + trial-and-error |

**Self-programming mechanism**:
```
Crowdsourced Learning + Human Creativity + Self-Critique → Iterative Logic Refinement
```

**Key insight**: Games provide bounded environments where self-programming can be tested with clear success criteria.

**Implication for OpenClaw**: Gym scenarios could serve as safe sandboxes for skill evolution, similar to Nemobot's game environments.

### 4. PsychAgent: Three-Engine Self-Evolution

**Architecture**:
1. **Memory-Planning Engine**: Self-evolving memory + adaptive planning
2. **Skill-Evolution Engine**: Automatic skill discovery and refinement
3. **Reinforced-Internalization Engine**: Parameter-level skill internalization

**Performance**: Outperforms GPT-5.4 and Gemini-3 on lifelong learning benchmarks.

**Key insight**: "Skill quality > memory volume" — evolution should focus on skill sophistication, not just accumulating experience.

---

## The Anti-Evolution Position: Safety First

### OpenClaw's Stance

**Explicit prohibition**: "Agents must not modify their own code, prompts, or core behavior at runtime."

**Rationale** (implied from design choices):
1. **Predictability**: Fixed behavior enables verification and audit
2. **Safety**: Self-modification can lead to goal drift or capability overhang
3. **Debuggability**: Static systems are easier to diagnose
4. **Control**: Human agency preserved in skill authoring

**Current compromise**: Error Log pattern
- Agents can log errors
- Humans review and author skill improvements
- Skills are version-controlled and tested before deployment

---

## Synthesis: A Nuanced Position

The debate may be falsely binary. Consider a spectrum:

```
Static ←————————————————————————→ Dynamic
OpenClaw    Error Log    PsychAgent    COSPLAY    GenericAgent
(current)   (current)    (controlled)  (bounded)  (open)
```

### Proposed Framework: Bounded Skill Evolution

Drawing from all sources, a middle path emerges:

**Layer 1: Static Core** (OpenClaw current)
- Agent loop
- Dispatcher
- Safety guardrails
- Protocol handlers

**Layer 2: Human-Verified Skills** (OpenClaw current)
- AGENTS.md skills
- Human-authored, tested, version-controlled

**Layer 3: Auto-Discovered Skills** (COSPLAY-inspired)
- Discovered from verified trajectories
- Include preconditions/effects for safety
- Require human approval before promotion to Layer 2
- Sandbox testing before deployment

**Layer 4: Runtime Adaptation** (GenericAgent-inspired)
- Within-skill parameter adaptation
- Contextual behavior tuning
- No structural changes to skills

### Safety Mechanisms from the Literature

| Source | Safety Mechanism | Application |
|--------|------------------|-------------|
| COSPLAY | Skill contracts (preconditions/effects) | Verify skill applicability before execution |
| Nemobot | Game boundaries | Test evolution in sandboxed environments |
| PsychAgent | Three-engine separation | Isolate evolution mechanisms from execution |
| GenericAgent | Verified trajectory requirement | Only successful executions become skills |
| VLAA-GUI | Completeness Verifier + Loop Breaker | Detect and prevent runaway evolution |

---

## Open Questions

1. **Skill verification**: How do we verify auto-discovered skills before promotion?
2. **Evolution speed**: How fast should Layer 3 evolve? Per session? Per day?
3. **Human oversight**: What level of human approval is practical vs. safe?
4. **Compounding effects**: How do we prevent evolutionary drift across multiple skill generations?
5. **Rollback**: How do we revert problematic skill evolution?

---

## Recommendations for OpenClaw

### Immediate (No Code Changes)
1. **Categorize existing Error Log entries** by pattern type
2. **Identify top 3 recurring error patterns** that could become auto-discovered skills
3. **Design skill template** with preconditions/effects structure

### Short-term (1-2 sprints)
1. **Prototype skill discovery**: Extract patterns from successful session trajectories
2. **Add skill sandbox**: Test proposed skills before human review
3. **Implement skill promotion workflow**: Draft → Sandbox → Review → Production

### Medium-term (1-2 months)
1. **Evaluate COSPLAY-style co-evolution** on a single skill category
2. **A/B test**: Human-authored vs. auto-discovered skills on identical tasks
3. **Measure**: Success rate, token efficiency, maintenance burden

---

## Related Materials

- [HB-260524-generic-agent-fudan.md](../posts/HB-260524-generic-agent-fudan.md)
- [HB-260437-cosplay-skill-co-evolution.md](../posts/HB-260437-cosplay-skill-co-evolution.md)
- [HB-260452-nemobot-games-self-programming.md](../posts/HB-260452-nemobot-games-self-programming.md)
- [SYNTHESIS-004: Self-Evolution & Learning](../synthesis/SYNTHESIS-004-self-evolution-learning.md)

---

*This synthesis challenges the current OpenClaw position not to force adoption of self-evolution, but to ensure the prohibition is based on current evidence rather than historical caution. The Fudan team's existence proof is particularly significant — it demonstrates that runtime skill evolution can be both safe and highly effective.*
