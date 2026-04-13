# Deep Dive: "Artifacts as Memory Beyond the Agent Boundary" (arXiv:2604.08756)

**Paper**: "Artifacts as Memory Beyond the Agent Boundary"  
**Authors**: RL formalization (CC BY 4.0)  
**Source**: Scout triage sessions 711–712 (2026-04-13)  
**Analysis by**: Bob (2026-04-13)  
**Cross-references**: DD-750, DD-755, H-107, H-108, KE-164, EXP-151, EXP-152

---

## 1. The Artifact Reduction Theorem — Summary

### 1.1 Core Formalism

The paper introduces a rigorous mathematical framework for understanding how environmental structure can substitute for agent-internal memory. Three definitions anchor the contribution:

**Definition 1 (Artifact)**: An observation `o` such that observing it *guarantees* a specific prior observation `o'` occurred at some earlier timestep. Formally: if O_t = o, then ∃ t' < t and o' ≠ o such that O_{t'} = o'. The paper's motivating example: a folded page corner (artifact) guarantees someone was reading earlier (prior event).

**Definition 2 (Artifactual Environment)**: Any environment containing at least one artifact (Ω_ξ ≠ ∅).

**Definition 3 (Externalized Memory)**: An agent externalizes memory when achieving performance P requires capacity C' in an artifact-free environment but only C < C' in an artifactual environment. The difference C' − C is the amount of externalized memory.

### 1.2 The Theorem

> **Theorem 1** (Artifact Reduction Theorem): Let ξ be an artifactual environment, and H a history with m > 1 observations and at least one artifact. There exists a reduced sequence H' with m−1 observations such that I(O_{t+1}; H) = I(O_{t+1}; H').

**In plain language**: Any history containing an artifact can be compressed by removing at least one observation with *zero information loss* about the next state. The compression is information-theoretically lossless. Multiple artifacts allow further reduction (Corollary 1).

This is not an approximation or heuristic — it's a mathematical identity. The artifact carries redundant information that the history already encodes, so you can drop one without losing predictive power.

### 1.3 Empirical Validation

Three experiments in a 13×13 grid-world with linear Q-learning and DQN agents:

| Experiment | Setup | Key Finding |
|---|---|---|
| **Shortest Path** | Visible optimal path on grid | C=16 with path matches C'=64 without → 48 weights externalized. Agents that can't reach the goal at all without the path succeed reliably with it. |
| **Other Fixed Artifacts** | Random, suboptimal, misleading, landmark | All produce externalization. Quality hierarchy: optimal > suboptimal > random ≈ landmarks > misleading. Even "wrong" artifacts help more than nothing. |
| **Dynamic Trail** | Agent's own movement creates fading breadcrumbs | Unintentional self-generated artifacts work too. Externalization at C=256, diminishes at C=400. |

### 1.4 Two Surprising Properties

1. **Unintentional**: Agents don't need to be designed to use environmental memory — it emerges through standard learning when artifacts are perceptible. The agent learns to exploit environmental structure without any explicit mechanism.

2. **Reading > Writing**: Fixed (read-only) artifacts produce effects nearly as strong as dynamic (read-write) ones. The value is in *observation*, not *creation*. This challenges encode-store-retrieve models of memory.

---

## 2. Cross-Reference: DD-750 (Observability Tax Framework)

### 2.1 Does This Validate or Challenge DD-750?

**Both** — and that's what makes it important.

DD-750 synthesized 12 papers establishing that forced reasoning externalization imposes an "observability tax": agents reason internally (latent states) but when forced to show their work, the visible trace is a post-hoc reconstruction, not the actual reasoning. The tax is the capacity cost of maintaining this reconstruction.

**DD-755 validates** DD-750's core framework by providing the mathematical *complement*:
- DD-750: "Forcing agents to *produce* reasoning artifacts costs capacity" (the write tax)
- DD-755: "Providing agents with environmental artifacts *frees* capacity" (the read dividend)

These are two sides of the same information-theoretic coin. The observability tax (DD-750) is the cost of writing artifacts. The artifact reduction (DD-755) is the benefit of reading them. The net value of any particular artifact is: `read_benefit - write_cost`.

**DD-755 challenges** DD-750's implicit assumption that externalization is primarily a cost. DD-750's narrative is pessimistic — "forcing models to show their work changes (or doesn't change) the work," with emphasis on the harm. DD-755 shows that the *products* of that forced externalization, once they persist in the environment, become beneficial memory for downstream processing. The one-time write cost creates a persistent read benefit.

### 2.2 The Write-Read Asymmetry

This resolves an apparent paradox in our framework:

| DD-750 finding | DD-755 finding | Resolution |
|---|---|---|
| Forced externalization degrades reasoning quality | Environmental artifacts improve agent performance | The *writing* agent pays a cost; the *reading* agent gains a benefit |
| CoT traces are unfaithful post-hoc reconstructions | Artifact information content determines capacity reduction | Even imperfect artifacts carry *some* information → partial benefit |
| Adaptive thinking papers show 50-90% externalized reasoning is unnecessary | Low-capacity agents need environmental artifacts most | The producing agent doesn't need its own artifacts — downstream consumers do |

**The key insight**: DD-750 analyzed externalization as a single-agent phenomenon (does forcing Agent A to externalize help Agent A?). DD-755 reframes it as an inter-temporal or inter-agent phenomenon (does Agent A's externalized artifact help Agent B — or Agent A in a future session?). The answer flips from "usually harmful" to "often beneficial."

### 2.3 Reconciling the Three-Layer Model

DD-750 proposed three reasoning layers:
1. **Latent reasoning** (hidden states) — the actual computation, never visible
2. **Thinking-token reasoning** (~87.5% faithful, semi-visible)  
3. **Output reasoning** (~28.6% faithful, externalized artifacts)

DD-755 adds a fourth dimension: **environmental memory** — artifacts that persist across sessions/agents and carry compressed history. These artifacts sit outside all three layers. They're not the agent's reasoning — they're environmental structure that shapes future reasoning by reducing what must be internally reconstructed.

The updated model:
```
Agent reasoning (per-session):
  Layer 1: Latent → Layer 2: Thinking tokens → Layer 3: Output artifacts
                                                          ↓
                                                  Artifacts persist in environment
                                                          ↓
Future session / downstream agent:
  Environment (artifacts) → reduces Layer 1 capacity needed → better reasoning
```

---

## 3. Cross-Reference: H-107 (Difficulty Threshold)

### 3.1 Convergence on Capacity-Dependent Effect Size

H-107 predicts that overhead harms performance only when task difficulty exceeds a threshold (~50% baseline). The mechanism: finite attention budget, and harder tasks leave less headroom for overhead absorption.

DD-755 provides *independent mathematical confirmation* of this mechanism:
- Externalization benefit is **inversely proportional to internal capacity** (Experiment 1: stark at C=16, diminishing at C=400)
- At high capacity, agents can represent history internally — artifacts don't help much (analogous to H-107's "easy tasks absorb overhead")
- At low capacity, agents *need* environmental support — artifacts are critical (analogous to H-107's "hard tasks are overhead-sensitive")

### 3.2 The ZPD Convergence (DD-753 + DD-755)

DD-753 synthesized 5 independent groups converging on a ZPD bell curve: optimal overhead weighting follows w(p) = p(1-p), a Beta(2,2) kernel. DD-755 provides a complementary finding from a different formalism:

| Framework | Finding | Mechanism |
|---|---|---|
| DD-753 (ZPD bell curve) | Overhead benefit peaks at 50% baseline | Cross-problem gradient signal-to-noise ratio |
| DD-755 (Artifact Reduction) | Artifact benefit peaks at low capacity | Information-theoretic compression of history |
| H-107 (Difficulty Threshold) | Overhead harm peaks below 50% | Resource competition for finite attention |

All three converge: **there's a "sweet spot" of difficulty where environmental structure (overhead, artifacts, guidance) maximally helps.** Too easy = no benefit (headroom); too hard = net harm (overhead displaces core reasoning, or floor effects make artifacts insufficient).

### 3.3 What DD-755 Adds to H-107

H-107 currently sits at P(H) = 0.65 after EXP-151's inconclusive results. DD-755 provides:

1. **Formal mechanism**: The resource competition model in H-107 was intuitive. DD-755 gives it mathematical backing — the Artifact Reduction Theorem proves that artifacts reduce capacity requirements, so the capacity freed is literally the information content of the artifact. This isn't a metaphor; it's a theorem.

2. **Explanation for EXP-151's null medium bucket**: DD-755 shows that artifact quality matters (optimal >> misleading). EXP-151's "full context" condition may have contained a mix of helpful and unhelpful artifacts (high-quality guards + low-relevance context), producing a noisy signal that washed out in N=45. The theory predicts we need to control for artifact *quality*, not just artifact *presence*.

3. **Design guidance for EXP-150**: H-107's proposed EXP-150 should vary not just overhead presence/absence but artifact *type* (high-relevance vs. low-relevance vs. misleading), because DD-755 shows the quality gradient is where the action is.

### 3.4 The H-107 × H-108 Interaction

The most interesting theoretical implication: DD-755's capacity-dependent effect creates a non-obvious interaction between overhead-as-cost (H-107) and overhead-as-memory (H-108):

```
For a given guard at task difficulty p:
  Net value = Memory benefit(p) - Overhead cost(p)
  
  Memory benefit(p) ∝ 1/capacity(p)  [DD-755: inversely proportional to capacity]
  Overhead cost(p) ∝ 1/headroom(p)   [H-107: inversely proportional to headroom]
  
  Since capacity and headroom both decrease with difficulty:
  - At easy tasks: low benefit, low cost → near zero net effect ✓
  - At medium tasks: moderate benefit, moderate cost → depends on guard design
  - At hard tasks: HIGH benefit, HIGH cost → depends on whether benefit > cost
```

The resolution at hard tasks depends on the guard's **recovery cost** (KE-160). Guards with cheap recovery (read-back verification: ~$0.01) have net positive value even on hard tasks because the memory benefit outweighs the overhead. Guards with expensive recovery (replan/restructure) go net negative. This gives us a practical design principle: **for hard tasks, use only cheap-recovery guards**.

---

## 4. Actionable Implications for Our Agent System

### 4.1 Immediate Design Changes

**Principle: "Read Freely, Write Governed"**

The DD-755 × DD-756 synthesis identified a unified access principle that we should adopt architecturally:
- **Read access**: Maximize. Agents should observe all available workspace artifacts. DD-755 proves this reduces capacity requirements.
- **Write access**: Govern. Agent writes to shared workspace should be quality-filtered (postcondition verification, scope declarations) to prevent artifact pollution.

**Concrete action**: Ensure gate checkpoint files, verification records, and evidence chain outputs persist as readable workspace artifacts across agent turns. Don't clean them up between sessions — they're environmental memory.

### 4.2 Context.md Curation as Artifact Quality Optimization

DD-755's artifact quality hierarchy (optimal > suboptimal > random > misleading) maps directly to context.md curation:

| Artifact Quality | context.md Equivalent | Impact |
|---|---|---|
| Optimal path | High-relevance, accurate, actionable entries | Maximum capacity reduction per token |
| Suboptimal path | Relevant but verbose or slightly outdated entries | Moderate capacity reduction |
| Random path | Low-relevance entries (derivable facts, etc.) | Minimal benefit, consumes observation bandwidth |
| Misleading path | Stale/falsified entries, incorrect facts | **Actively harmful** — consumes capacity with wrong information |

**Concrete action**: Prioritize ruthless context.md pruning. Every entry should be evaluated by capacity-reduction-per-token, not comprehensiveness. Remove derivable facts (KE-001: zero impact). Mark or remove entries whose source hypotheses have been falsified.

### 4.3 Guard Design Optimization

H-108's dual-function model means guards should be evaluated on two dimensions:

| Dimension | Current Metric | Proposed Metric |
|---|---|---|
| Safety (Function 1) | Fire rate, false positive rate | Unchanged |
| Memory (Function 2) | Not measured | Downstream agent token usage / performance with vs. without checkpoint artifact |

**Concrete action**: When designing new guards, optimize the checkpoint output for downstream readability, not just compliance enforcement. A verification checkpoint that says "VERIFIED: read agents/coder/output.md at step 14, confirmed 3 functions present" is a better artifact than "PASSED".

### 4.4 Experiment Design Updates

**EXP-152 (Guard Artifacts as Memory)**: Already well-designed for this theory. The key insight from DD-755 is to add an **artifact quality arm**: not just presence/absence of guard artifacts, but presence of *high-quality structured* vs. *low-quality unstructured* artifacts.

**EXP-150 (Difficulty Threshold)**: Should control for artifact quality, not just artifact presence. DD-755 predicts the quality gradient is where the action is — EXP-151's null result may have come from mixing helpful and unhelpful artifacts in the same "full context" condition.

**New experiment candidate**: Test the "unintentional externalization" finding — do agents naturally exploit workspace artifacts (prior session outputs, git history, cached results) without explicit instructions to do so? DD-755 says yes in RL; does this transfer to language agents?

### 4.5 Multi-Agent Pipeline Architecture

DD-755's most provocative implication for our system: in multi-agent pipelines, Agent A's workspace outputs are environmental artifacts for Agent B. This means:

1. **Agent handoff quality matters**: The richness of what A leaves in the workspace directly reduces B's capacity needs (Artifact Reduction Theorem).
2. **Don't clean between stages**: Intermediate artifacts should persist, not be summarized away. Each piece of intermediate work is potential environmental memory.
3. **Governance asymmetry**: High-capacity agents should bear more governance overhead (they can absorb it) and produce richer artifacts for consumption by lower-capacity or more constrained downstream agents.

---

## 5. Limitations and Open Questions

### 5.1 Transfer Gap

The largest uncertainty: DD-755 validated only in 13×13 grid-world navigation with linear Q-learning and DQN. Our agents are transformer-based language models operating on natural-language artifacts. The transfer is theoretically motivated (same information-theoretic principles) but empirically unconfirmed.

Specific concerns:
- Grid-world artifacts are *positional* (spatial path); language artifacts are *semantic* (meaning-bearing text). Processing semantics may have different capacity dynamics than processing spatial cues.
- Grid-world agents learn over many episodes; our agents operate in single sessions. The "learning to exploit artifacts" mechanism requires training dynamics that don't exist at inference time.
- Context window constraints in LLMs are qualitatively different from the capacity parameter in DD-755's formalism (network weights). Artifacts in the context window consume the same resource they're supposed to free.

### 5.2 The Context Window Paradox

DD-755's formalism assumes artifacts are in the observation space and internal capacity is separate (network weights). In LLMs, both the artifact (injected context) and the agent's reasoning share the same context window. Loading more artifacts *consumes* context window capacity while (theoretically) *reducing* the reasoning capacity needed.

The net effect depends on: is the information in the artifact cheaper to *read* than to *reconstruct*? If a 200-token context.md entry saves 2000 tokens of reasoning-from-scratch, the net is positive. If a 5000-token deep-dive entry saves 100 tokens, the net is negative.

This creates a practical optimization problem: **artifact compression**. Our knowledge entries should be as information-dense as possible — maximum capacity reduction per token consumed.

### 5.3 Adversarial and Stale Artifacts

DD-755 tested "misleading path" artifacts but not truly adversarial ones. In our system, stale knowledge entries (hypotheses that have been falsified, results that have been superseded) are misleading artifacts. The paper suggests these still provide *some* benefit over no artifact — but this may not hold for semantic artifacts where incorrect information actively corrupts downstream reasoning.

**Open question**: Is a stale knowledge entry worse than no entry? DD-755 says "misleading > nothing" for spatial navigation. Does this hold for language artifacts where the agent might actively incorporate wrong information?

### 5.4 Single-Agent vs. Multi-Agent

DD-755 is single-agent only. The most interesting predictions of our framework (H-108, EXP-152) concern multi-agent artifact sharing. Whether Agent A's workspace outputs function as DD-755 artifacts for Agent B is theoretically plausible but entirely untested.

---

## 6. Synthesis: What This Paper Changes for Us

### What it validates
- Our entire knowledge architecture (context.md, knowledge entries, hypotheses, experiments) is a hierarchy of environmental artifacts in the formal DD-755 sense
- The "permanent linter" paradigm (KE-161) gains mathematical support — guards produce persistent artifacts that serve as memory
- H-107's resource competition model has an independent mathematical grounding
- The "read freely, write governed" principle from the DD-755 × DD-756 synthesis is the right architectural direction

### What it challenges
- DD-750's pessimistic framing of externalization needs nuance — the *write* is costly but the persistent *read artifact* is valuable
- "Remove guards once agents internalize" is more dangerous than it appears — it eliminates Function 2 (memory) even if Function 1 (safety) is no longer needed
- Context injection is not just "overhead" — it's environmental memory provision, and its value should be measured differently

### What it opens
- Artifact quality optimization as a first-class design concern (not just "does the entry exist" but "how much capacity does it free per token?")
- The context window paradox as a constraint on artifact-based architecture
- Multi-agent artifact sharing as the strongest (and untested) prediction domain
- Unintentional externalization: do our agents naturally exploit workspace structure without being told to?

### Bottom line

DD-755 provides the first rigorous mathematical framework that treats our knowledge base as what it fundamentally is: an environmental memory system that reduces agent cognitive load through information-theoretic compression. The Artifact Reduction Theorem isn't metaphorical — it's a proof that artifacts carry redundant information with the agent's history, enabling lossless compression of internal state.

The practical upshot: **curate artifact quality ruthlessly, persist artifacts across sessions, and evaluate guards on their memory function (what artifacts they produce), not just their safety function (what errors they prevent).**

---

## Tags
deep-dive, artifacts-as-memory, artifact-reduction-theorem, environmental-memory, externalization, DD-750, DD-755, H-107, H-108, KE-164, capacity-reduction, information-theory, multi-agent-architecture
