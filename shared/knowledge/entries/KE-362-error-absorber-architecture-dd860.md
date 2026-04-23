# KE-362: Error Absorber Architecture — Circuit Breakers for Verification Gravity Wells

**Date**: 2026-04-23
**Source**: DD-860 (synthesis of 13+ papers: Huang et al. 2024, EnviSmart, Kitchen Loop, GeoEvolver, etc.)
**Confidence**: Medium-High
**Connects**: H-092 (info-flow patterns), H-093 (CIVC), H-098 (channel theory), EXP-099 (FM-3.3 terminal attractor), EXP-110 (guard recovery), KE-113 (agent-specific FM signatures)

## Core Finding

Verification gravity wells (FM-3.3 capturing 20.3% of all errors per EXP-099) are instances of **error attractor dynamics** — self-reinforcing loops where the same model that produced the error cannot correct it (Huang et al. 2024: LLMs cannot self-correct reasoning without external feedback). DD-860 synthesizes distributed-systems patterns (circuit breakers, bulkheads, pre-commitment gates) into an intervention architecture specifically targeting these attractors.

## Evidence

- Huang et al. (ICLR 2024): LLMs attempting intrinsic self-correction fail and often degrade — foundational negative result explaining why verification loops form attractors
- Ríos-García et al. (2026): Evidence ignored in 68% of traces, scaffold accounts for only 1.5% of variance — scaffold cannot fix reasoning
- EnviSmart (Guan et al. 2026): Production system using role-separated agents + deterministic validators at trust boundaries → zero user exposure to cascading errors
- Kitchen Loop (Roy 2026): Automated pause gates halt autonomous iteration when quality degrades — effectively a circuit breaker for LLM pipelines
- GeoEvolver (Dai et al. 2026): Failure memory bank with root-cause attribution → 12% avg improvement — implicit pre-commitment gate

## Mechanism / Why

FM-3.3 is a **fixed point** in the agent's verification state space: the output passes superficial checks, so re-verification produces the same result. Each iteration reinforces rather than corrects. Attractor basins form because (1) plausible errors pass self-verification, (2) attention weights recent context, biasing toward consistency with the error, and (3) confidence increases monotonically (Lyapunov trap).

## Implications

### 1. Intervention timing matters exponentially
The dynamical-systems framing shows it's cheaper to intervene at decision boundaries (before attractor convergence) than after. Our EXP-110 guard's 73.5% recovery rate but 35% residual is consistent: the guard catches agents near the basin boundary but not those already deep in the well.

### 2. Three proven patterns map directly to our system
- **Circuit breaker**: Monitor verification iteration count + output similarity → halt + escalate after N stagnant iterations
- **Bulkhead**: Don't carry full failed-attempt context into retries (seeds same error)
- **Pre-commitment gate**: Before committing verification result to session state, check against known FM-3.3 signatures

### 3. Self-correction is structurally impossible for same-model verification
This is the strongest external validation of our H-098 channel theory: Ch1 (text instruction to "verify harder") cannot work because the same model that produced the error is being asked to find it. Only Ch2 (environmental state change) or external agents can break the loop.

## Actionable

- **Design EXP-206**: Implement a simple circuit breaker (iteration budget + stagnation detection) on the project review workflow and measure FM-3.3 rate reduction. Lowest-effort, highest-impact intervention from DD-860.
- **Update H-093 (CIVC)**: Add DD-860 as external theoretical framework. The Lyapunov trap formalization explains WHY the severity gradient exists (deeper attractors = steeper wells = harder to escape).
- **Consider H-190**: "Verification stagnation detection reduces gravity well capture rate by >50%" — testable via circuit breaker on review loop.

## Open Questions

- Can we empirically map FM-3.3 basin boundaries using controlled error injection?
- What is the optimal iteration budget before circuit breaker trips? (DD-860 suggests 2-3 iterations)
- Do multi-agent workflows have system-level attractors distinct from single-agent ones?
