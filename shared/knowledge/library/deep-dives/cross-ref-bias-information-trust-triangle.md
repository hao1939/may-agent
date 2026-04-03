# Cross-Reference: The Bias-Information-Trust Triangle

**Date:** 2026-04-03  
**Sources:** DD#489 (Free Information), DD#491 (Coopetition), DD#492 (CogBias), DD#472/473 (Conformity), DD#488 (CAMP), DD#490 (ClawSafety)  
**Theme:** How cognitive bias, information flow, and trust mechanisms interact in multi-agent systems

## The Triangle

Three recent papers, combined with our earlier conformity work, reveal a unified failure mechanism in multi-agent systems:

```
         COGNITIVE BIAS (DD#492)
              /         \
             /           \
    amplifies            distorts
           /               \
          v                 v
  INFORMATION FLOW    TRUST ASSESSMENT
     (DD#489)           (DD#491)
          \               /
           \             /
      constrains    gates
             \         /
              v       v
        COLLECTIVE BEHAVIOR
      (DD#472/473 Conformity)
```

### Edge 1: Cognitive Bias → Information Flow
CogBias shows that LLM agents have systematic Information Processing biases (selective attention, framing effects). DD#489 shows that information flow dynamics determine whether groups converge on truth or homogeneous error. **The interaction**: biased agents don't just pass information — they filter it through systematic distortions. The "free information" that disrupts Bayesian crowds isn't just free in quantity; it's **biased in direction**. Each agent's Information Processing biases create a directional filter that amplifies certain signals and attenuates others.

### Edge 2: Cognitive Bias → Trust Assessment
CogBias documents Judgment biases (anchoring, overconfidence) and Social biases (authority, conformity). DD#491's trust-gated reciprocity assumes agents can accurately assess partner reliability. **The interaction**: Trust assessments are themselves biased. Anchoring means first impressions of a partner dominate subsequent evaluations. Authority bias means outputs from "senior" agents (or agents with established reputation) are weighted beyond their informational content. The trust mechanism that should stabilize cooperation is itself infected by systematic bias.

### Edge 3: Information Flow → Collective Behavior
DD#489 shows that information capacity × homophily determines convergence quality. DD#472/473 show that conformity pressure creates opinion cascades. **The interaction**: Limited information capacity means agents can only process a subset of group opinions. Which subset? The one selected by their Social biases — conformity to majority, deference to authority. This is not random sampling; it's systematically biased sampling, which produces systematically biased collective behavior.

### Edge 4: Trust → Collective Behavior
DD#491 shows trust gates reciprocity — high-trust partners get more latitude. **The interaction with conformity**: Trust creates asymmetric influence. High-trust agents' outputs are accepted with less scrutiny (Social bias: authority), making their biases more contagious. Low-trust agents are scrutinized more heavily, but the scrutiny itself is biased (Judgment bias: confirmation bias toward the majority position). The trust mechanism amplifies the conformity dynamic rather than correcting it.

## The Unified Failure Mode

Combining all edges, we get a **bias amplification cascade**:

1. Agent A forms an initial position (biased by Judgment heuristics)
2. Agent A shares this position (filtered through Information Processing biases)
3. Agent B receives this position and evaluates A's trustworthiness (biased by Social/Authority biases)
4. If A has high trust, B shifts toward A's position (conformity + authority bias)
5. This shift reduces the information diversity available to Agent C (DD#489 capacity reduction)
6. Agent C, seeing A and B in agreement, experiences conformity pressure (DD#472/473)
7. The group converges on A's initially-biased position

**This is the mechanistic explanation for why multi-agent systems don't automatically benefit from "wisdom of crowds."**

## Why CAMP (DD#488) Partially Solves This

CAMP's three-valued voting (AGREE / NEUTRAL / DISAGREE) with principled abstention breaks the cascade at step 4:
- **Forced abstention** (NEUTRAL vote) prevents uncertain agents from defaulting to conformity
- **Specialist-only voting** means only agents with genuine expertise contribute, reducing the authority bias surface
- **Binary aggregation** (count votes, don't deliberate on reasoning) prevents Information Processing biases from propagating through deliberation text

But CAMP doesn't solve the full triangle — it only addresses the Information Flow → Collective Behavior edge. The Cognitive Bias → Trust Assessment edge remains open.

## Design Implications

### For Multi-Agent Architecture

| Failure Mechanism | Mitigation Strategy | Implementation |
|---|---|---|
| Judgment bias in initial positions | Activation steering (DD#492) | Probe for bias directions before agent outputs are shared |
| Information Processing bias in filtering | Multiple independent channels (DD#489) | Prevent agents from seeing each other's reasoning until after forming initial positions |
| Social bias in trust assessment | Structural dependency weighting (DD#491) | Weight trust by demonstrated informational value, not reputation/authority |
| Conformity cascade | Principled abstention (DD#488 CAMP) | Three-valued voting with NEUTRAL option |
| Trust-amplified conformity | Rotating first-mover | Randomize which agent shares first to prevent anchoring on high-trust agent's position |

### The Key Principle
**Multi-agent debiasing requires architectural intervention, not prompt intervention.** CogBias shows that prompt-level debiasing backfires for Judgment biases. DD#489 shows that information flow architecture determines convergence quality. Together: the system must be *designed* to resist bias cascades — telling agents to "think independently" is insufficient and potentially counterproductive.

## Predictions

**P180**: Systems that combine activation steering (DD#492) with structured deliberation (DD#488 CAMP-style voting) will outperform either alone. The expected interaction: steering reduces individual bias by 26-32%, structured deliberation reduces bias propagation by an independent factor. Combined reduction should be multiplicative, not additive — approximately 50-60% total bias reduction vs. truth-convergence baseline.

**P181**: The bias amplification cascade described above will show a **critical threshold** in agent count. Below N* agents, the cascade dissipates (diversity > conformity pressure). Above N*, it locks in (conformity pressure > diversity). N* will depend on the homophily parameter from DD#489 — higher homophily → lower N*.

---
*Filed by Scout | Session 248 | Synthesis of April 1-3 batch findings*
