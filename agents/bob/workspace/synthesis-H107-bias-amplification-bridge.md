# Synthesis: Bias Amplification as the Mechanistic Engine of H-107's Medium-Difficulty Peak

**Date**: 2026-04-13  
**Author**: Bob  
**Threads**: EXP-151 interim analysis + DD-754 bias amplification synthesis  
**Key question**: Does DD-754's bias amplification framework explain WHY medium-difficulty tasks are where overhead effects peak?

---

## Thread Summaries

### Thread 1: EXP-151 Interim (Phase 1a — 114 trials)

EXP-151 tested H-107's core prediction: overhead harms hard tasks, is neutral on easy tasks, and has its largest *detectable* effect at medium difficulty. Phase 1a results:

- **Easy bucket**: Ceiling effect. investigate-fix-pattern hit 100%/100% in both conditions. mock-leak-trap has a scoring artifact (0%/0% but functionally solved). No overhead delta detectable.
- **Hard bucket**: Floor effect. All 72 trials across 3 scenarios = 0% in both conditions. Overhead is irrelevant when tasks exceed capability.
- **Medium bucket**: NOT YET RUN — this is the critical discriminating test.

**Verdict**: Consistent with H-107 but non-discriminating. The hypothesis lives or dies on medium-difficulty results.

### Thread 2: DD-754 — Bias Amplification in MAS Topologies

Li, Gao & Wang (2026) demonstrate that structured multi-agent workflows act as echo chambers — amplifying stochastic biases into systemic polarization even when individual agents are alignment-neutral. Key findings:

1. **Amplification is topology-independent** — all architectures amplify; more connections = more amplification
2. **Specialization/diversity doesn't help** — persona diversity, functional roles, model heterogeneity all still amplify
3. **Trigger Vulnerability** — injecting neutral, factual text into ambiguous scenarios causes massive polarization cascade
4. **Reflector agents provide only temporary relief** — bias reduction at one layer is immediately overwritten by subsequent processing

---

## The Bridge: Why Medium Difficulty Is the Amplification Sweet Spot

**Core argument**: DD-754's bias amplification framework provides the *mechanistic explanation* for why H-107's overhead effect peaks at medium difficulty. The connection runs through three interlocking mechanisms:

### 1. Medium Difficulty = Maximum Stochastic Variance = Maximum Amplifiable Signal

DD-754 shows that amplification requires an initial stochastic bias to amplify. The paper's formal framework: each agent produces a probability distribution p_j, and downstream agents progressively polarize toward the initial lean.

At different difficulty levels:
- **Easy tasks** (>90% baseline): The correct answer dominates the probability landscape. Any guard/overhead layer that introduces a perturbation faces strong "gravitational pull" back toward the correct solution. There's minimal stochastic variance to amplify — the signal is clear.
- **Hard tasks** (<30% baseline): The agent can't solve the problem regardless. Guard chains process a failure state. There's no meaningful signal to amplify because the agent never gets close to a solution. Floor effect.
- **Medium tasks** (40-60% baseline): The agent is *right at the decision boundary*. Small perturbations in reasoning can tip the outcome either way. **This is precisely where stochastic variance is maximized** — and therefore where DD-754's amplification dynamics have the most raw material to work with.

This maps exactly onto DD-753's Beta(2,2) kernel: **w(p) = p(1-p)** peaks at p = 0.5. The variance of a Bernoulli process peaks at p = 0.5. DD-754 tells us that guard chains amplify variance. H-107 tells us that overhead matters most at medium difficulty. These are the *same phenomenon* viewed from different angles.

### 2. Guards as Amplification Layers (The Reflector Parallel)

DD-754's finding about Reflector agents is directly transferable to our guard architecture:

> "A Reflector agent provides temporary, partial bias reduction at its layer, but the amplification trend resumes immediately after"

Our guard chains (FM-3.3 verification, format compliance, context injection) function structurally like DD-754's sequential agents. Each guard:
- Receives the agent's intermediate state
- Applies a constraint/check (analogous to DD-754's agent producing S_j)
- Passes the modified state forward

On medium-difficulty tasks, the agent's reasoning state is *ambiguous* — the solution is partially formed but fragile. Each guard interaction is an opportunity for DD-754-style amplification:
1. The verification guard forces the agent to re-examine its work → this re-examination introduces a new "vote" that can shift the balance
2. Context injection adds information that, like DD-754's "Trigger Vulnerability," anchors the agent on a heuristic rather than continuing open reasoning
3. Format compliance forces externalization of the ambiguous state, reifying a tentative conclusion into a commitment

**On easy tasks**: The solution is robust; guards are just rubber-stamping certainty. No amplification possible.  
**On hard tasks**: There's no solution to destabilize. Guards process noise.  
**On medium tasks**: Each guard layer amplifies whichever direction the agent's stochastic process initially leaned — exactly DD-754's echo chamber dynamic.

### 3. The Trigger Vulnerability Maps to Context Injection

DD-754's most striking finding: injecting *neutral, factual* text into ambiguous scenarios causes massive polarization. This is directly analogous to our context injection overhead:

- Injected knowledge base entries are factual and neutral
- Medium-difficulty tasks are precisely the "ambiguous forced-choice scenarios" where this trigger vulnerability operates
- The injected context provides a heuristic anchor that, through the cascade dynamics DD-754 describes, gets amplified into a dominant (and potentially wrong) approach

This explains why EXP-147 Track B found +14pp from context *reduction* on hard tasks (cascading-fix-trap-v2 +17pp, plan-once-amend +11pp). Removing the trigger removes the amplification seed.

---

## Ranked Findings (by impact × novelty)

### Tier 1: Paradigm-Level
1. **Bias amplification provides the mechanistic explanation for H-107's difficulty curve** — DD-754's echo chamber dynamics + DD-753's Beta kernel + EXP-151's empirical pattern form a unified theory. The overhead effect isn't just "resource competition" (the original H-107 mechanism); it's resource competition *plus* systematic amplification of perturbations at the decision boundary. (Impact: ★★★★★, Novelty: ★★★★★)

2. **Guards are structurally identical to DD-754's amplification layers** — Not just metaphorically — the information flow topology is the same: sequential processing where each layer receives and modifies the previous layer's state. The Reflector finding means that even guards *designed to reduce error* can amplify it. (Impact: ★★★★★, Novelty: ★★★★)

### Tier 2: Significant
3. **Context injection is a Trigger Vulnerability** — DD-754 proves that neutral factual information destabilizes ambiguous decisions. Our context injection (which adds neutral knowledge entries) operates on exactly this principle when tasks are at the decision boundary. (Impact: ★★★★, Novelty: ★★★★)

4. **EXP-151 Phase 1a confirms ceiling/floor boundary conditions** — 114 trials show 100%/100% at ceiling and 0%/0% at floor, exactly as predicted. While non-discriminating, this establishes that the interesting dynamics are indeed restricted to the medium-difficulty zone. (Impact: ★★★, Novelty: ★★)

### Tier 3: Supporting
5. **Topology independence means architecture can't solve amplification** — DD-754 tested all major MAS topologies; all amplify. This means our system can't escape the problem through architectural redesign alone — we need fundamentally different guard interaction patterns (topology breakers, not inline filters). (Impact: ★★★, Novelty: ★★★)

6. **Model heterogeneity doesn't solve amplification** — Even mixing different models still amplifies. Relevant to any "use different models for guard vs agent" proposals. (Impact: ★★, Novelty: ★★)

---

## What This Changes for H-107

### Upgraded Mechanism: Resource Competition + Amplification

H-107's current mechanism section describes a "Resource Competition Model" where overhead competes with core reasoning for finite attention budget. DD-754 adds a second, complementary mechanism:

**Original (Resource Competition)**:
```
Performance = f(core_reasoning) - cost(overhead)
At medium difficulty: core_reasoning is near threshold, so cost(overhead) pushes below
```

**Upgraded (Resource Competition + Amplification)**:
```
Performance = f(core_reasoning) - cost(overhead) - amplification_penalty(guard_chain, variance(p))
Where amplification_penalty peaks when:
  1. variance(p) is high (medium difficulty, p ≈ 0.5)
  2. guard_chain is deep (more amplification layers)
  3. guards introduce heuristic anchors (context injection = trigger vulnerability)
```

The amplification mechanism explains effects that pure resource competition cannot:
- Why *removing* context helps even when the removed context is correct and relevant (trigger vulnerability)
- Why guard chains with more layers can be worse than shorter ones (each layer is an amplification step)
- Why the Reflector pattern (a guard that checks for errors) still fails to stop amplification

### Testable Prediction: Chain Depth × Difficulty Interaction

If the amplification mechanism is real, we should observe:
- **Single guard on medium task**: Moderate overhead effect (resource competition only)
- **Guard chain (2-3 guards) on medium task**: Disproportionately larger effect (resource competition + amplification)
- **Guard chain on easy task**: Still negligible (nothing to amplify)

This is a new prediction not derivable from the original H-107 mechanism alone. It could be added as **P-107f**.

---

## Contradictions and Tensions

1. **DD-754 studies bias (demographic preference); H-107 studies performance (pass/fail)**: The amplification mechanism was demonstrated for bias specifically. Does it transfer to performance degradation? Plausible — the same cascade dynamics should apply to any stochastic decision process — but not yet empirically confirmed in our context.

2. **DD-754's fully-connected topology amplifies most; our guard chains are sequential**: Our architecture is more like DD-754's linear chain (lower amplification) than their fully-connected topology (highest amplification). The effect in our system may be smaller than DD-754's headline numbers suggest.

3. **Training-time vs inference-time gap persists**: Both DD-753 (ZPD) and DD-754 (bias amplification) study different contexts from our inference-time overhead concern. The mechanisms are transferable in principle but haven't been validated in our specific setting.

---

## Next Steps (Priority-Ordered)

1. **🔴 Run EXP-151 Medium bucket** — This remains the single highest-priority item. The entire theoretical framework predicts that medium difficulty is where the action is. Without medium-bucket data, we have an elegant theory with no discriminating evidence. Target: 3+ scenarios at 40-70% baseline, N≥10 per condition.

2. **🟡 Add P-107f to H-107** — Formalize the chain-depth × difficulty interaction prediction derived from DD-754. This is independently testable and provides a way to distinguish "pure resource competition" from "resource competition + amplification."

3. **🟡 Design a guard-chain-depth experiment** — Test 1-guard vs 3-guard conditions on medium-difficulty tasks. If amplification is real, 3-guard should show disproportionately more harm than 3× the 1-guard effect. This would confirm DD-754's relevance to our system.

4. **🟢 Update H-107 mechanism section** — Add the amplification mechanism as a second complementary pathway, citing DD-754. The Beta(2,2) kernel from DD-753 now has a concrete mechanistic interpretation: it peaks at p=0.5 because that's where variance (and thus amplifiable signal) is maximized.

5. **🟢 Investigate topology-breaker guard designs** — DD-754 suggests that inline guards (which continue the sequential information flow) are structurally prone to amplification. Guards that *break* the topology (e.g., independent parallel evaluation, or guards that reset the reasoning state rather than annotating it) might avoid the amplification trap.

---

## Summary

The DD-754 bias amplification framework provides a compelling mechanistic explanation for H-107's central prediction. The connection is precise:

- **H-107 predicts** overhead effects peak at medium difficulty
- **DD-753 formalizes** this as the Beta(2,2) kernel w(p) = p(1-p), peaking at p = 0.5
- **DD-754 explains WHY**: medium difficulty = maximum stochastic variance = maximum amplifiable signal for guard chains acting as echo chambers

This upgrades H-107 from a "resource competition" story to a "resource competition + systematic amplification" story, adding explanatory power (why context removal helps, why chain depth matters) and generating a new testable prediction (P-107f: chain depth × difficulty interaction).

The critical next step remains unchanged: **run the EXP-151 medium bucket**. Theory without discriminating data is just a compelling story.
