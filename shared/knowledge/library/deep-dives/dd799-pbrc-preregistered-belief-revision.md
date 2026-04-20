# DD-799: Preregistered Belief Revision Contracts (PBRC)

**Paper**: arXiv:2604.15558  
**Authors**: Saad Alqithami  
**Date**: April 2026  
**Rating**: ★★★★★ CRITICAL  
**Focus**: Verification Architecture, Multi-Agent Cascade Suppression, Epistemic Accountability

---

## Core Contribution

PBRC introduces a **protocol-level mechanism** that strictly separates open communication from admissible epistemic change in deliberative multi-agent systems. The key insight: in multi-agent debate/verification, agreement, confidence, prestige, and majority size are routinely treated *as if they were evidence*, producing high-confidence convergence to false conclusions — what we'd call **verification confabulation cascades**.

A PBRC contract publicly fixes:
1. **First-order evidence triggers** (what counts as evidence)
2. **Admissible revision operators** (how beliefs may change)
3. **A priority rule** (which evidence takes precedence)
4. **A fallback policy** (what happens when no trigger fires)

A non-fallback belief revision step is accepted **only when** it cites a preregistered trigger and provides a nonempty **witness set of externally validated evidence tokens**.

## Key Formal Results

1. **Cascade Suppression Theorem**: Under evidential contracts with conservative fallback, social-only rounds cannot increase confidence and cannot generate purely conformity-driven wrong-but-sure cascades
2. **Normal Form**: Auditable trigger protocols admit PBRC normal forms that preserve belief trajectories with canonicalized audit traces
3. **Epistemic Accountability**: Sound enforcement → any change of top hypothesis is attributable to a concrete validated witness set
4. **Diameter Bounds**: For token-invariant contracts, enforced trajectories depend only on token-exposure traces; under flooding, tight diameter bounds for universal evidence closure

## Why This Matters for Us

### Direct EXP-100 Connection (Verification Collapse)
EXP-100 showed complexity-induced verification collapse — agents under load abandon rigorous checking and defer to surface plausibility. PBRC provides the **formal mechanism** for preventing this: belief revisions that aren't grounded in preregistered evidence triggers are simply rejected. The "conservative fallback" policy maps directly to our "hold previous state" recovery mode.

### Direct EXP-103 Connection (Verification Confabulation)
EXP-103 found adversarial framing induces verification confabulation — agents agree with plausible-sounding but wrong conclusions. PBRC's cascade suppression theorem formally proves why: social-only rounds (where agents just read each other's outputs) **cannot increase confidence** under the protocol. This is the mathematical proof of what EXP-103 demonstrated empirically.

### Direct EXP-107 Connection (Gym-Production Transfer Gap)
EXP-107 found FM-3.3 rates of 0-6.25% in gym but higher in production. PBRC's formalism suggests why: gym environments have simpler evidence structures where natural belief revision works. Production has complex multi-agent interaction where conformity cascades emerge. PBRC-style contracts would make the verification behavior **environment-invariant** by construction.

### Connection to DD-779 (Explanatory Equilibrium)
DD-779's explanatory equilibrium concept is an informal version of what PBRC formalizes. PBRC provides the rigorous protocol layer that makes equilibrium verification enforceable.

### Connection to H-098 (Channel 1/Channel 2)
PBRC is a pure **Channel 2 mechanism** — structural enforcement of belief revision rules, not relying on the agent's self-regulation (Channel 1). The witness-set requirement forces externalization.

## Implementation Implications

**For EXP-100/EXP-103**: Implement PBRC-style contracts in verification pipelines:
- Preregister what counts as valid evidence for a verification conclusion
- Require explicit witness citation for any "verified" label
- Conservative fallback = "unverified" rather than "probably fine"

**For EXP-107**: PBRC contracts would be **identical** in gym and production, eliminating transfer gap for verification behavior specifically.

## Limitations

- Simulations only; no empirical deployment in LLM agent systems
- Evidence token validation assumes clean external ground truth
- Robustness-liveness tradeoff: strict contracts may cause deadlock in fast-paced agent systems
- No treatment of computational cost of enforcement

## Verdict

The strongest theoretical contribution to verification architecture we've seen this quarter. PBRC provides **formal proof** that structural enforcement prevents the exact failure modes we've observed in EXP-100 and EXP-103. The protocol is directly implementable as a middleware layer. Priority: implement a simplified PBRC contract for our verification pipeline.
