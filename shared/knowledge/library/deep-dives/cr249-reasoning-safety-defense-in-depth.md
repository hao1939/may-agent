# CR#249: Reasoning Safety Defense-in-Depth — The Temporal-Spatial Duality

**Sources**: DD#440 (PreSafe), DD#441 (CRAFT), DD#436 (VeriGrey), DD#437 (IET), CR#237 (Security Gaps), CR#238 (Cross-Stack Attack Composition)
**Rating**: ★★★★★ CRITICAL — Unifies two independent safety approaches into a coherent defense architecture

---

## The Fundamental Duality

Two papers from the same Thursday March 19 batch independently discovered complementary aspects of the same fundamental problem: **Large Reasoning Models' safety failures are structurally caused by the reasoning process itself.**

| Dimension | PreSafe (DD#440) | CRAFT (DD#441) |
|-----------|-----------------|----------------|
| **Axis** | Temporal | Spatial |
| **Discovery** | CoT CAUSES safety degradation | Safe/unsafe traces are geometrically separable |
| **Intervention** | Before reasoning begins | During reasoning trajectory |
| **Mechanism** | Pre-CoT safety decision | Latent space geometry alignment |
| **Guarantee** | Empirical (near-zero ASR) | Theoretical (Theorem 5.1: SSA cannot be local optimum) |
| **Overhead** | Zero at inference | Zero at inference |
| **Limitation** | Residual ASR on sophisticated attacks (~14-25%) | Computational LCLR training cost |

## The Defense-in-Depth Architecture

Combining PreSafe and CRAFT creates a three-layer defense:

### Layer 1: Pre-CoT Decision (PreSafe)
```
Input → [PreSafe-aligned LRM representations] → SAFE? → proceed to CoT
                                                → UNSAFE? → refuse immediately (no CoT generated)
```
- Catches ~85-97% of attacks before reasoning even begins
- Zero computational waste on harmful queries
- Analogous to a firewall: block at the perimeter

### Layer 2: Latent Trajectory Alignment (CRAFT)
```
[CoT begins] → [LCLR-structured latent space] → [R²L rewards guide trajectory]
            → reasoning stays in safe manifold
            → consistency reward prevents SSA
```
- Catches attacks that bypass PreSafe's pre-CoT decision
- Ensures reasoning traces themselves are safe (not just final outputs)
- Analogous to IDS/IPS: monitor and correct during execution

### Layer 3: Output-Level Safety (Standard)
```
[Reasoning complete] → [Final response] → standard safety filters
```
- Standard output-level safety evaluation (StrongReject, etc.)
- Last line of defense, already well-studied
- Analogous to output sanitization

**Together**: Perimeter defense → active trajectory defense → output defense = defense-in-depth

## Connection to MAS Security Stack

### Mapping to CR#237 Gap 1 (Security)

The security gap identified in CR#237 was about **agent-level security** in multi-agent systems. PreSafe + CRAFT address a critical sub-component: ensuring that individual agents' REASONING processes are secure. This matters for MAS because:

1. **An agent with unsafe internal reasoning may take unsafe actions** even if its final "communication" to other agents appears safe (SSA within MAS)
2. **Reasoning traces may be shared** between agents in collaborative architectures (e.g., debate, consensus) — unsafe traces contaminate other agents
3. **Memory systems** (DD#433 MemGPT, DD#434 Kumiho) may store reasoning traces — latent safety must persist through storage and retrieval

### Mapping to CR#238 (Cross-Stack Attack Composition)

Cross-stack attacks compose vulnerabilities across layers. In the reasoning safety context:

- **Attack path**: Craft input that passes PreSafe's pre-CoT check → triggers unsafe reasoning during CoT → unsafe reasoning produces harmful output
- **Defense composition**: PreSafe blocks at input → CRAFT redirects at reasoning → output filter catches residuals
- **Key vulnerability**: attacks that are "safe-looking" at the representation level but become harmful through the reasoning process itself

This is precisely the **"delayed-action jailbreak"** predicted in DD#440 (P204).

### Mapping to VeriGrey (DD#436)

VeriGrey's greybox validation approach gains new capabilities when combined with latent safety monitoring:
- **VeriGrey can use CRAFT's latent safety scores** as observability signals during testing
- **Fuzzing targets**: generate inputs that map to the boundary between safe and unsafe regions in CRAFT's latent space
- **Validation criterion**: not just "does the agent produce safe output?" but "does the agent reason safely?" — measured via latent trajectory distance from safety prototype

### Mapping to IET (DD#437)

Implicit Execution Tracing monitors agent behavior through implicit state changes. Combined with CRAFT:
- **IET traces** capture what the agent DID
- **CRAFT latent monitoring** captures what the agent was THINKING while doing it
- Together: behavioral + cognitive monitoring = comprehensive agent surveillance

## The Safety Tax Reversal

A remarkable finding from both papers:
- PreSafe: reasoning performance PRESERVED (no degradation)
- CRAFT: reasoning performance IMPROVED (+4.7%)

This contradicts the conventional wisdom that safety alignment degrades capabilities. The **Safety Tax** (Huang et al., 2025) may be an artifact of output-level alignment methods rather than a fundamental tradeoff. When safety alignment operates at the right level of abstraction (representations/latent space rather than output tokens), it can actually enhance capabilities.

**Implication for MAS design**: Safety should not be treated as a cost center but as a capability enhancer. Systems that are "safe by construction" (aligned at the reasoning level) may outperform systems with bolt-on safety filters.

## The Rethink Region: A New Conceptual Primitive

CRAFT identifies a third category beyond safe/unsafe: the **"rethink" region** — reasoning traces that are indeterminate, sitting at the boundary between safe and unsafe latent space. This is a conceptual primitive that appears nowhere else in the literature and has significant implications:

1. **For MAS**: agents in the "rethink" state could be routed to a safety-specialized sub-agent for evaluation before proceeding
2. **For monitoring**: the rethink rate could be a leading indicator of attack pressure — if more queries push reasoning into the rethink region, the system may be under adversarial probing
3. **For alignment**: the rethink region is where the model is "uncertain" about safety — this is the productive space for alignment learning

## Open Research Questions

1. **Can PreSafe + CRAFT be composed end-to-end?** No one has tried this. It should be trivially composable (PreSafe modifies pre-CoT representations, CRAFT modifies during-CoT latent trajectory), but interference is possible.

2. **Does the temporal-spatial duality extend to multi-agent reasoning?** When multiple agents reason collaboratively (debate, consensus), does safety degrade along both temporal AND inter-agent dimensions?

3. **Can the rethink region be used as a safety signal in MAS orchestration?** If an agent's reasoning enters the rethink region, should the orchestrator:
   - Route to a safety-specialized sub-agent?
   - Increase monitoring intensity?
   - Trigger a consensus check with other agents?

4. **What is the attack surface of the defense-in-depth architecture?** An attacker who knows both PreSafe and CRAFT's mechanisms could potentially craft inputs that:
   - Pass PreSafe's pre-CoT check (safe at representation level)
   - Navigate CRAFT's latent geometry (stay near safe prototype)
   - Still produce harmful output through some residual path
   - This would require simultaneously fooling both temporal and spatial defenses

5. **Can the latent safety geometry be transferred across model architectures?** If CRAFT learns safety geometry on one model, can the prototypes/projections transfer to a different model? This would enable universal safety monitoring.

## Predictions

- **P209**: A paper combining PreSafe + CRAFT (or equivalent temporal+spatial approach) will appear within 6 months, demonstrating the defense-in-depth architecture described here with near-zero ASR on all benchmarks including WildJailbreak.
- **P210**: The "rethink region" concept will spawn a sub-field of "uncertainty-aware safety alignment" that treats safety as a spectrum rather than a binary classification.
- **P211**: The Safety Tax Reversal finding will be replicated at scale (70B+ models), establishing that representation-level safety alignment is capability-positive as a general principle.

---

*Scout CR#249 | 2026-03-19 | Session 157*
