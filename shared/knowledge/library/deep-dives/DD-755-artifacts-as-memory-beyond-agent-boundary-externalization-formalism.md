# DD-755: Artifacts as Memory Beyond the Agent Boundary — RL Formalization of Environmental Memory

**Paper**: "Artifacts as Memory Beyond the Agent Boundary"
**arXiv**: 2604.08756v1 (CC BY 4.0)
**Session**: 713+ (2026-04-13)
**Relevance**: ★★★★★ — Mathematical formalization of externalized memory in RL; directly validates our reasoning externalization framework

---

## Core Thesis

The environment itself can functionally serve as an agent's memory. When agents observe **artifacts** — environmental features that encode information about past interactions — the amount of internal memory (capacity) needed to learn a performant policy is provably reduced. This effect arises **unintentionally**: agents don't need to be designed to use environmental memory; it emerges through standard learning dynamics when artifacts are perceptually available.

---

## Key Contributions

### 1. Mathematical Formalism of Artifacts (Definition 1)

An **artifact** is an observation `o` such that observing it guarantees a specific prior observation `o'` occurred at some earlier timestep. Formally: if O_t = o, there exists t' < t and o' ≠ o such that O_{t'} = o'.

Key properties:
- **Artifactual environment** (Definition 2): any environment where such artifacts exist (Ω_ξ ≠ ∅)
- **Lemma 1**: Restates artifact existence as a conditional probability: ℙ(O_{t'} = o' | O_t = o) = 1
- The folded-page "Page Keeping" example elegantly illustrates: Alice folds a corner → seeing a fold guarantees she was reading earlier

### 2. Artifact Reduction Theorem (Theorem 1) — The Central Result

> *"Let ξ be an artifactual environment, and H a history with m > 1 observations and at least one artifact. There exists a reduced sequence H' with m−1 observations such that I(O_{t+1}; H) = I(O_{t+1}; H')."*

**Translation**: Artifacts allow you to compress history without losing predictive information. Any history containing an artifact can be reduced by at least one observation while preserving full mutual information with the next observation. Multiple artifacts enable further reduction (Corollary 1).

**Why this matters**: This proves that environmental structure can substitute for internal state representation. The compression is information-theoretically lossless — the reduced history predicts equally well.

### 3. Externalized Memory as Capacity Reduction (Definition 3)

An agent **externalizes memory** when achieving performance P requires capacity C' in an artifact-free environment but only C < C' in an artifactual environment. The residual C' − C is the **amount of externalized memory**.

Methodology: Compare bounded agents (same design, varying capacity) across matched environments that differ only in artifact availability. Statistical testing at α = 0.05 with 30 seeds per condition.

### 4. Empirical Validation — Three Experiments

**Experiment 1: Shortest Path Artifact**
- 13×13 grid, 8×8 binary images, allocentric 24×24 composite observations
- Linear Q-learning and DQN agents across multiple capacity levels
- **Result**: With shortest path visible, C=16 (Linear-Q) outperforms C'=64 without path → **48 weights externalized**
- Effect is stark in low-capacity regime: without path, linear agents with <256 weights cannot reach goal at all; with path, they reliably succeed
- DQN shows near-uniform performance boost across network sizes (3×16, 3×32)

**Experiment 2: Other Fixed Artifacts**
- Tested Random, Suboptimal, Misleading, and Landmark artifacts
- All show externalization to varying degrees
- Random path still helps (rules out "just following the path" hypothesis)
- Landmarks (non-behavioral, geometric structures) also show externalization
- **Key insight**: Even non-behavioral environmental structure serves as memory

**Experiment 3: Dynamic Path (Agent-Generated)**
- Agent's own movement creates a fading trail — a self-generated artifact
- Non-stationary environment, restricted to linear Q-learning
- Externalization significant at C=256, weaker at C=400
- **Validates**: Agents can inadvertently create their own environmental memory

### 5. Conceptual Grounding in Situated Cognition

The paper satisfies Michaelian (2012) / Sims & Kiverstein (2022) desiderata for external memory:
1. **Survival-relevant**: Artifact observation consistently increases total reward
2. **Susceptible to change**: Dynamic artifacts (fading trails) are mutable; even fixed artifacts produce the effect, suggesting reading > writing for navigation
3. **Selection**: Credit assignment through learning gradually biases toward goal-relevant artifact observation

---

## Connections to Our Research

### DD-750 (Observability Tax / Reasoning Externalization Gap) — DIRECT VALIDATION
DD-750 established that "thinking ≠ saying" — agents reason internally but suppress externalization. This paper provides the **mathematical complement**: the environment itself can carry the information that internal representation would otherwise need to hold. Together:
- DD-750 shows externalization can be forced (at a cost — the observability tax)
- DD-755 shows externalization can be **environmental** — artifacts in the workspace serve the same functional role as internal memory
- **Synthesis**: Our structured gates are themselves artifacts in the agent's observation stream. When a gate checkpoint document persists in the workspace, it reduces the internal capacity needed for subsequent reasoning — exactly as Theorem 1 predicts.

### H-107 (Difficulty Threshold Moderates Overhead Harm)
The capacity reduction effect is **most pronounced in low-capacity regimes** — exactly H-107's domain. When tasks are hard (low baseline pass rate), agents have limited capacity headroom. Environmental artifacts provide the most benefit precisely there, because they substitute for internal capacity the agent lacks. This aligns with H-107's threshold prediction: below the difficulty threshold, any additional cognitive support (including environmental artifacts) helps; above it, the agent has headroom and doesn't need the help.

The paper's finding that externalization isn't significant at very high capacities parallels H-107's prediction that overhead is neutral for easy tasks.

### KE-161 (Guard Architecture — Permanent Linter Paradigm)
**Critical architectural insight**: Guard outputs that persist in the workspace (e.g., gate checkpoint files, review comments) function as **artifacts** in the DD-755 sense. They encode information about past interactions (prior review, flagged issues) and reduce the internal capacity needed for the next agent turn.

However, DD-754's warning about echo-chamber amplification applies: if guard artifacts are always present, they may create a "path dependency" effect analogous to the Suboptimal or Misleading path artifacts in Experiment 2 — some artifacts help less than others, and some may mislead. Guard artifact design should optimize for information content, not just presence.

### KE-146 (Reasoning Externalization Gap)
The paper demonstrates the flip side of KE-146: while forcing agents to externalize reasoning may impose an observability tax (DD-750), **providing** externalized reasoning artifacts in the environment reduces the need for internal reasoning capacity. This suggests a design principle:
- Don't force the agent to externalize (high tax)
- Instead, provide environmental artifacts that the agent can observe (low cost, high benefit)
- "Write once, read many" — the artifact's value comes from reading, not writing

### EXP-151 (Difficulty Bucket Experiments)
The Easy bucket ceiling effect may correspond to the high-capacity regime where externalization provides minimal benefit. The Hard bucket floor effect may correspond to cases where artifacts alone are insufficient — the agent still needs minimum internal capacity to process artifact observations. The **Medium bucket** is where externalization effects are most relevant — consistent with both DD-755 and H-107.

---

## Novel Theoretical Insights

### 1. Unintentional Externalization
The most surprising finding: agents externalize memory **without any explicit mechanism to do so**. The spatial path artifact emerges naturally from the agent's behavior and is exploited through standard learning. This has profound implications for multi-agent systems where one agent's workspace artifacts may inadvertently serve as cognitive scaffolding for another.

### 2. Reading > Writing for Memory
Fixed artifacts (read-only) produce externalization effects nearly as strong as dynamic (read-write) artifacts. This challenges the encode-store-retrieve model of memory — in navigation contexts, the ability to **read** environmental information is more fundamental than the ability to **write** it. 

For our gate architecture: gate checkpoints don't need to be dynamically updated by the guarded agent — read-only artifacts from a prior review pass may be sufficient.

### 3. Artifact Quality Matters
Not all artifacts are equally useful:
- **Optimal path** > **Suboptimal path** > **Random path** ≈ **Landmarks** > **Misleading path**
- Artifact signal quality maps to externalization magnitude
- This implies guard artifact design should maximize information content and goal-relevance

### 4. Capacity-Dependent Effect Size
Externalization benefit is inversely related to internal capacity. Maximum benefit at minimum capacity; diminishing returns as capacity grows. This is a formal version of "help helps those who need it most."

---

## Limitations & Open Questions

1. **Grid-world only**: All experiments use 13×13 navigation. Transfer to language/coding agent domains is theoretical, not empirical
2. **Linear/DQN only**: Modern transformer-based agents may have different capacity-externalization dynamics
3. **Single-agent**: No multi-agent artifact interaction studied. What happens when Agent A's artifacts become Agent B's environmental memory?
4. **Artifact definition requires certainty**: Definition 1 requires ℙ = 1 (observing o guarantees prior o'). Real-world artifacts are probabilistic — a workspace file *usually* indicates prior work, but could be a hallucination
5. **No adversarial artifacts**: What if an adversary plants misleading artifacts? The Misleading Path experiment hints at this but doesn't explore adversarial settings

---

## Actionable Implications

1. **Gate checkpoint persistence**: Ensure gate review artifacts persist in the workspace across agent turns — they are functionally equivalent to the shortest-path artifact in reducing subsequent reasoning capacity requirements
2. **Workspace-as-memory design pattern**: Structure multi-agent workspaces so that prior work products serve as informative artifacts for subsequent agents
3. **Artifact quality monitoring**: Not all workspace artifacts help equally — monitor which persistent files actually improve downstream agent performance (analogous to optimal vs. misleading path comparison)
4. **Low-capacity optimization**: When operating under token/context budget constraints, environmental artifacts provide the highest marginal benefit — prioritize artifact availability in resource-constrained settings

---

## Tags
externalization, environmental-memory, artifacts, bounded-agents, capacity-reduction, situated-cognition, information-theory, artifact-reduction-theorem, observability, guard-architecture
