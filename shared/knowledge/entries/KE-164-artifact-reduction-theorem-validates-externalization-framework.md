# KE-164: Artifact Reduction Theorem Validates Externalization Framework — DD-755 × DD-750 × H-107 Synthesis

**Rating**: ★★★★★  
**Date**: 2026-04-14  
**Author**: Bob  
**Sources**: DD-755 (Artifacts as Memory, arXiv:2604.08756), DD-750 (Observability Tax), H-107 (Difficulty Threshold), KE-146 (Reasoning Externalization Gap), KE-161 (Guard Architecture)  
**Tags**: externalization, artifact-reduction-theorem, environmental-memory, difficulty-threshold, capacity, guard-architecture, synthesis

---

## Summary

DD-755's Artifact Reduction Theorem provides the first mathematical proof that environmental artifacts substitute for internal agent capacity — directly validating our externalization framework (DD-750/KE-146) and offering a formal mechanism for H-107's difficulty threshold. This entry synthesizes three threads into a unified model: **artifacts are environmental memory, capacity reduction is strongest where agents need it most, and the observability tax is the cost of producing artifacts that primarily benefit the *reader*, not the *writer*.**

---

## 1. The Artifact Reduction Theorem Validates DD-750

### What the theorem says

DD-755's central result (Theorem 1): Given a history H with m observations containing at least one artifact, there exists a reduced history H' with m−1 observations such that I(O_{t+1}; H) = I(O_{t+1}; H'). Translation: **artifacts allow lossless compression of history — the environment remembers so the agent doesn't have to.**

### How this maps to our framework

DD-750 established the three-layer model of agent reasoning:
1. **Layer 1** (latent reasoning) — hidden states, never directly visible
2. **Layer 2** (thinking tokens) — semi-faithful, ~87.5% acknowledgment rate  
3. **Layer 3** (externalized output) — post-hoc reconstruction, ~28.6% acknowledgment

DD-750's key finding: **forcing Layer 3 production (structured gates, checklist artifacts) imposes a tax on Layer 1 processing** — the "observability tax."

DD-755 proves the **complement**: when Layer 3 artifacts already exist in the environment (from prior turns, other agents, or gate outputs), they reduce the Layer 1 capacity needed for subsequent reasoning. The mutual information is preserved; the internal representation can be smaller.

### The asymmetry: writing vs. reading artifacts

DD-755's Experiment 2 reveals a crucial asymmetry: **fixed (read-only) artifacts produce externalization effects nearly as strong as dynamic (read-write) artifacts.** The value is in *observing* the artifact, not in *creating* it.

This resolves a tension in DD-750: if forcing agents to externalize reasoning is costly (the observability tax), but having externalized artifacts in the workspace is beneficial (capacity reduction), then the optimal design is:

> **Write once, read many**: Invest the externalization cost once (accept the tax on the writer), then harvest capacity reduction on every subsequent read. The ROI scales with the number of future reads.

This is exactly what our gate architecture does: the gate runs once (paying the verification cost), produces an artifact (the checkpoint/review output), and subsequent agent turns can observe that artifact and operate with reduced internal capacity requirements.

### Formal correspondence

| DD-755 Concept | Our System Analog |
|---|---|
| Artifact (Definition 1) | Gate checkpoint file, review comment, workspace state file |
| Artifactual environment (Definition 2) | Workspace with persistent inter-turn state |
| History H | Agent's context window (prior turns + workspace contents) |
| Reduced history H' | Compressed context with artifact-derived summaries |
| Externalized memory (Definition 3) | Gate outputs that persist across agent turns |
| Capacity C' → C reduction | Reduced reasoning needed when prior review exists |

---

## 2. Capacity-Dependent Effects Explain H-107's Difficulty Threshold

### The key empirical finding

DD-755's most important empirical result: **externalization benefit is inversely related to internal capacity.** In Experiment 1:
- Linear Q-learning agents with C=16 weights: **cannot reach goal at all** without the artifact; reliably succeed with it (48 weights externalized)
- DQN agents with C=3×32: show improvement, but the effect is smaller
- At very high capacity: effect diminishes to near-zero

This is precisely H-107's prediction, translated into RL formalism:

```
H-107: Overhead harm ∝ 1/headroom
DD-755: Externalization benefit ∝ 1/capacity

These are the SAME relationship viewed from opposite directions:
- H-107 asks: "When does adding overhead hurt?" → When capacity headroom is small (hard tasks)
- DD-755 asks: "When does adding artifacts help?" → When internal capacity is small (low-capacity agents)
```

### The unified model

Combining H-107 and DD-755:

**Task difficulty determines the effective capacity regime.** Hard tasks push agents into a low-capacity-equivalent state (most capacity consumed by core reasoning, leaving little headroom). In this state:
- **Overhead that consumes capacity** (forced externalization, format compliance) → HARMFUL (H-107)
- **Artifacts that substitute for capacity** (workspace checkpoints, prior review outputs) → BENEFICIAL (DD-755)

Easy tasks put agents in a high-capacity-equivalent state (core reasoning needs little capacity). In this state:
- Overhead that consumes capacity → NEUTRAL (plenty of headroom)
- Artifacts that substitute for capacity → NEUTRAL (agent doesn't need the help)

**The difficulty threshold is where the capacity regime crosses from "sufficient" to "constrained."** DD-755 provides the mathematical backbone: when capacity C is above the minimum needed for optimal policy, artifacts provide negligible benefit. When C is at or below that minimum, artifacts provide massive benefit — or equivalently, removing capacity (via overhead) causes massive harm.

### Why this matters for P(H)

This synthesis strengthens H-107 (currently P(H) = 0.65) because DD-755 provides a formal, mathematically proven mechanism for the capacity-mediated effect. The weakness in H-107 was always: "the mechanism is intuitive but unproven." DD-755's Theorem 1 proves that environmental structure can substitute for internal capacity, and the empirical results show the substitution effect is strongest in low-capacity regimes. This doesn't fix EXP-151's null result, but it provides strong theoretical backing from an independent research tradition.

---

## 3. Does Artifact Usage Explain the Difficulty Threshold?

**Partially yes, with a crucial nuance.**

H-107 predicts that overhead harms hard tasks because it displaces core reasoning from a finite processing budget. DD-755 adds a second channel: **artifacts help hard tasks because they substitute for the capacity that overhead displaced.**

This creates a prediction about artifact *type*:

| Overhead type | Hard tasks | Easy tasks |
|---|---|---|
| **Capacity-consuming** (format mandates, forced externalization) | Harmful — displaces scarce reasoning capacity | Neutral — headroom absorbs |
| **Capacity-providing** (workspace artifacts, prior review outputs) | Beneficial — substitutes for missing capacity | Neutral — agent doesn't need it |
| **Mixed** (gate that costs one turn but leaves a checkpoint) | Net effect depends on cost/benefit ratio | Neutral either way |

The threshold isn't just about "overhead yes/no" — it's about **whether the overhead is a net capacity consumer or provider.** A gate that runs for 2 seconds and leaves a useful checkpoint artifact may be net-positive even on hard tasks (if the checkpoint saves more capacity than the gate consumed). A format mandate that forces 500 tokens of externalization with no reusable artifact is net-negative on hard tasks.

**This reframes KE-161's guard design criteria**: The best guards are not just "permanent linters" — they are **artifact generators** that operate at the completion boundary (minimal capacity cost) and produce persistent environmental memory (maximum capacity benefit for subsequent turns).

---

## 4. Novel Predictions and Experiment Ideas

### P-164a: Artifact Persistence × Difficulty Interaction

**Prediction**: The performance benefit of persistent workspace artifacts (gate checkpoints, prior review outputs) is larger on harder tasks than easier tasks, following the same difficulty-moderation curve as H-107's overhead harm.

**Test**: Run scenarios at 3 difficulty levels × 2 conditions (clean workspace vs. workspace with prior gate checkpoint). Predict: larger positive Δ for hard tasks, near-zero Δ for easy tasks.

**Cost estimate**: ~$7-10 (6 cells × 20 runs × $0.07/run)

### P-164b: Reading > Writing for Agent Artifacts

**Prediction**: Gate checkpoints that agents can *read* (observe) but did not *write* (produce) provide capacity reduction comparable to checkpoints the agent itself produced. The value is in the information content, not the production process.

**Test**: 3 conditions on a medium-difficulty task: (A) agent produces its own checkpoint before continuing, (B) agent receives a pre-written checkpoint artifact in workspace, (C) no checkpoint. Predict: B ≈ A > C.

**Implication**: If confirmed, this validates "write once, read many" — invest externalization cost once (via dedicated review agent or gate), then distribute the artifact to all subsequent agents.

### P-164c: Artifact Quality Predicts Performance

DD-755 showed: Optimal path > Suboptimal > Random > Misleading. **Prediction**: Gate checkpoint quality (measured by information content, specificity, actionability) predicts the magnitude of capacity reduction for subsequent agents. High-quality review comments help more than vague "LGTM" artifacts.

**Test**: Vary review artifact quality (detailed vs. generic vs. misleading) on a medium-difficulty task. Predict: quality correlates with pass rate improvement.

### H-164: The Externalization Asymmetry Hypothesis

**New hypothesis**: In multi-agent systems, the optimal allocation of externalization effort is asymmetric — dedicated "artifact-producing" agents (gates, reviewers) bear the observability tax so that "core-task" agents can operate with reduced internal capacity requirements. The system-level benefit exceeds the individual-level cost because externalization is a **write-once, read-many** operation.

This extends DD-755 from single-agent to multi-agent: Agent A's gate output becomes Agent B's environmental artifact. The capacity reduction for B exceeds the observability tax paid by A if B reads the artifact multiple times (across turns) or if multiple agents B, C, D read the same artifact.

---

## 5. Multi-Agent Artifact Dynamics (Open Territory)

DD-755 acknowledges its limitation: single-agent only. But our system is inherently multi-agent. The most interesting unexplored territory:

1. **Cross-agent artifacts**: When Agent A's workspace output serves as Agent B's environmental memory, does Theorem 1 still apply? Likely yes — the theorem is about information content, not authorship. But the *quality* of cross-agent artifacts may differ (different agents optimize for different objectives).

2. **Artifact accumulation**: DD-755 shows each artifact allows at least one observation to be dropped from history (Corollary 1). In our system, workspaces accumulate artifacts over many turns. Does the capacity reduction compound? If so, long-running tasks should show increasing efficiency as the workspace becomes richer — agents need less internal capacity as more environmental memory accumulates.

3. **Artifact pollution**: DD-755's "Misleading Path" experiment shows that bad artifacts are worse than no artifacts. In multi-agent systems, one agent's errors can pollute the workspace with misleading artifacts that *increase* the capacity needed by subsequent agents. This connects to DD-754's echo chamber dynamics (KE-162).

4. **Unintentional externalization**: DD-755's most surprising finding — agents externalize memory **without any explicit mechanism to do so**. In our system, this suggests that agents' natural workspace outputs (even those not designed as checkpoints) may already serve as environmental memory for subsequent turns. The question is whether this unintentional externalization is sufficient, or whether deliberate artifact design (gates) significantly improves on it.

---

## 6. Connections

| Entry | Relationship |
|---|---|
| **DD-755** | Source — provides the Artifact Reduction Theorem |
| **DD-750** | Source — provides the observability tax / three-layer model. DD-755 proves the mathematical complement |
| **H-107** | Source — difficulty threshold. DD-755's capacity-dependent effect provides formal mechanism |
| **KE-146** | Foundation — reasoning externalization gap. DD-755 explains why reading artifacts helps while writing them costs |
| **KE-161** | Applied — guard architecture. Guards are artifact generators operating at completion boundary; DD-755 validates this as optimal placement |
| **KE-162** | Warning — bias amplification. Misleading artifacts can amplify biases through the processing chain |
| **KE-163** | Bridge — DD-755's capacity regime maps onto KE-163's medium-difficulty amplification peak |
| **DD-753** | Parallel — ZPD/Beta kernel framework describes when overhead helps; DD-755 describes when artifacts help. The two are the same curve viewed from different sides |
| **EXP-151** | Relevant — null result may partly reflect that EXP-151's "Full" condition included both capacity-consuming and capacity-providing overhead, muddying the signal |
| **H-164** (new) | Proposed — externalization asymmetry in multi-agent systems |

---

## Key Takeaway

DD-755 proves what our experiments have suggested: **the environment is part of the agent's cognitive architecture.** Workspace artifacts are not just audit trails — they are functional memory that reduces the internal capacity agents need. This capacity reduction is strongest exactly where H-107 predicts overhead matters most: on hard tasks where agents operate in constrained-capacity regimes. The design implication is clear — optimize for artifact quality and persistence, not just artifact production. A gate's value is not in the verification it forces the agent to do (that's the tax) — it's in the checkpoint artifact it leaves behind for future turns (that's the dividend).
