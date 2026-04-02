# Cross-Reference #111: Knowledge Boundary Management — Open-World vs Closed-World Strategies

**Sources:** HILA (arXiv:2603.07972) × AOI (arXiv:2603.03378)
**Date:** 2026-03-15
**Theme:** Two complementary strategies for what MAS systems should do when they hit their knowledge limits

---

## The Core Dichotomy

When a multi-agent system encounters a problem beyond its current capability, there are exactly two strategies:

1. **Open-World (HILA):** Ask someone who knows — defer to human experts, learn from their demonstrations, permanently internalize their knowledge via SFT
2. **Closed-World (AOI):** Extract maximum value from failure — convert failed trajectories into corrective supervision signals, repair near-miss reasoning into correct diagnostic plans

Both papers independently discover that **the knowledge ceiling of purely autonomous MAS is real and hard** — you cannot recombine existing knowledge into genuinely new knowledge through multi-agent debate or self-consistency alone.

## Structural Comparison

| Dimension | HILA | AOI |
|-----------|------|-----|
| **Trigger** | Learned metacognitive DEFER decision | Post-hoc analysis of failed trajectories |
| **Knowledge Source** | External (human expert) | Internal (failure analysis) |
| **Learning Loop** | Outer SFT loop from expert demos | Evolver GRPO from failed+corrected pairs |
| **Optimization** | GRPO for when-to-ask decisions | GRPO at two granularities (step + trajectory) |
| **Backbone** | LLaMA3-8B | Qwen3-14B |
| **Domain** | Math/code benchmarks | SRE/cloud operations |
| **Safety Model** | Not addressed | Architectural (role separation) |
| **Human Element** | Central (learned deferral) | Absent (fully autonomous) |

## Convergent Findings

### 1. GRPO as Universal Agent Optimizer
Both papers independently choose GRPO over PPO/DPO. HILA uses it for metacognitive action selection; AOI uses it at dual granularity (step-level Observer + trajectory-level Evolver). The critic-free design is key — for agent optimization, multiple valid actions exist at each step, making pairwise preference comparison (DPO) awkward and value function estimation (PPO) brittle.

### 2. Architecture > Scale
- HILA: 8B model + DLPO matches much larger autonomous MAS configurations
- AOI: 14B model + read-write separation matches Claude Sonnet 4.5

Both demonstrate that **system design dominates model scale** for production MAS — a finding that directly validates GUS Law 1 (Sophistication Tax) from a positive direction.

### 3. Failure as the Richest Signal
- HILA: DEFER events generate the most valuable SFT samples (expert demonstrations on tasks the system couldn't solve)
- AOI: Failed trajectories are literally more valuable than successful ones for capability improvement

**Convergent principle:** The moments when a system fails (or recognizes it would fail) contain more information than successes.

## Synthesis: Unified Knowledge Boundary Management

A production MAS needs **both** strategies:

```
Task arrives → Agent attempts solution
   │
   ├── SUCCESS → Standard output + augment for training diversity (AOI)
   │
   └── FAILURE DETECTED
        │
        ├── Can I recover from this failure? (AOI Evolver)
        │     ├── YES → Repair trajectory, retry with corrected plan
        │     └── NO → Escalate
        │
        └── Should I ask for help? (HILA DEFER)
              ├── YES → Human expert demonstration → SFT learning
              └── NO → Log failure for future Evolver training
```

**The key insight:** DEFER (HILA) and Evolve (AOI) are not alternatives — they operate at different timescales:
- **Real-time:** HILA's learned DEFER policy decides whether to ask for help NOW
- **Post-hoc:** AOI's Evolver mines failures LATER for training signal
- **Combined:** HILA defers → gets expert demo → expert demo becomes Evolver seed → augmented into diverse training data → permanently improves base model

## Implications for GUS Framework

### New Proposed: Mechanism 34 — Knowledge Boundary Dual Response

When a MAS reaches its knowledge boundary, two complementary mechanisms should activate:
1. **Synchronous escalation** (DEFER): Route current task to external expert for immediate resolution
2. **Asynchronous evolution** (EVOLVE): Log failure trajectory for later conversion into training signal

Systems that implement only one strategy are suboptimal: DEFER-only systems never learn from their failures (each deferral is independent), EVOLVE-only systems cannot handle the current task (learning is delayed).

### New Proposed: Prediction P91 — GRPO Dominance in Agentic Optimization

By end of 2026, >60% of trainable MAS papers will use GRPO (or GRPO variants) over PPO/DPO. The critic-free, group-relative design is uniquely suited to agent optimization where multiple valid actions exist and reward landscapes are multi-modal.

## Limitations of This Synthesis

1. **No empirical validation of combination:** Neither paper references the other; the combination is theoretical
2. **Different domains:** HILA tested on math/code, AOI on SRE — transfer between domains is unproven
3. **Cost model gap:** HILA models human cost as fixed penalty; AOI doesn't model human cost at all. Real production systems need dynamic cost models.

---

*Cross-reference completed 2026-03-15. Portfolio: CR#111.*
