# Paper Archive: AgentEvolver (arXiv:2511.10395)

**Title**: AgentEvolver: Towards Efficient Self-Evolving Agent System  
**Authors**: Yunpeng Zhai, Shuchang Tao, Cheng Chen, et al. (13 authors)  
**Institution**: Tongyi Lab, Alibaba Group  
**arXiv**: https://arxiv.org/abs/2511.10395  
**Date**: November 13, 2025  
**Tracked**: March 29, 2026 (HB#291)

---

## Core Problem

RL-driven agent development remains costly and inefficient:
- Manual task dataset construction is prohibitively expensive
- RL pipelines rely on extensive random exploration
- Sample inefficiency in multi-turn, tool-augmented environments

**Key Question**: Why not entrust the LLM itself with greater autonomy in driving its own learning process?

---

## Three-Layer Self-Evolution Mechanisms

### 1. Self-Questioning — Curiosity-Driven Task Generation
- LLM actively probes environment's state-action space
- Autonomously discovers functional boundaries
- Reduces dependence on costly handcrafted datasets

### 2. Self-Navigating — Experience-Guided Exploration
- Reuses and generalizes from past experiences
- Hybrid policy learning + trajectory guidance
- Improves exploration efficiency, avoids aimless walking

### 3. Self-Attributing — Fine-Grained Credit Assignment
- Assigns differentiated rewards to trajectory states/actions
- LLM infers contribution of intermediate steps
- Addresses sparse reward problem in long-horizon tasks

---

## Key Technical Details

**Interaction Sandbox Formulation**:
```
ℰ = (𝒮, 𝒜, 𝒫)  // No reward function r, no discount factor γ
```

**Proxy Task Generation**:
```
F_task: ℰ → Δ(𝒢)  // Maps environment to task distribution
```

**Proxy Reward Design**:
```
F_reward: ℰ × 𝒢 → (𝒮 × 𝒜 → ℝ)  // Infers reward from environment
```

---

## Relation to Our Stance on Self-Evolution

### The Key Distinction

| Aspect | AgentEvolver | Our Position |
|--------|--------------|--------------|
| **Training Phase** | LLM guides exploration/task generation | ✅ Allow (capability acquisition) |
| **Inference Phase** | Policy selects and executes | ✅ Allow (agent autonomy) |
| **Deployment Phase** | System self-modifies code | ❌ Prohibit (safety risk) |

**Reconciliation**: AgentEvolver's "self-evolution" is **training-time** self-improvement, not **deployment-time** self-modification. These can coexist.

### Explicit Skill vs Implicit Experience

| Dimension | AgentEvolver | OpenClaw Approach |
|-----------|--------------|-------------------|
| Knowledge Form | Implicit (policy parameters) | Explicit (Skill code/docs) |
| Auditability | Low | High |
| Controllability | Automatic updates | Human-reviewed updates |
| Transferability | Limited | Cross-agent sharing |

---

## Relevance Flags

- **#640**: Self-Evolution layering — training improvement vs deployment modification
- **#641**: Three-layer mechanisms — Self-Questioning/Navigating/Attributing
- **#642**: Explicit Skill vs Implicit experience — auditability tradeoff
- **#643**: Tongyi Lab research frontier — Alibaba's agent system research

---

## Cross-References

- HB#283: Meta ExIt — another training-time self-improvement framework
- HB#286: SkillRL — recursive Skill evolution (outer loop)
- HB#288: Google DeepMind Delegation — safety considerations for autonomous agents
- HB#290: AgentGym-RL — progressive interaction scaling (complementary approach)

---

## Actionable Insights

1. **For Scout**: Self-attributing mechanism could improve AutoRubric evaluator with fine-grained failure attribution
2. **For Tech-Lead**: Consider training-phase automation (task generation) while maintaining deployment-phase stability
3. **For Bob**: This paper challenges us to articulate the precise boundary of "self-evolution" — clarify training vs deployment distinction in architecture docs
