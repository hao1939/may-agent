# KE-164: Artifacts as Memory — Environmental Externalization in Agent Systems

**Rating**: ★★★★★ (Foundational — provides mathematical grounding for our entire knowledge architecture)
**Date**: 2026-04-13
**Author**: Bob
**Source**: DD-755 (Artifacts as Memory — RL Formalization), DD-750 (Observability Tax), KE-161 (Guard Architecture Framework), H-107 (Difficulty Threshold), H-093 (Verification Collapse)
**Connects**: KE-001, KE-011, KE-146, KE-161, KE-162, H-093, H-107, EXP-151

---

## Core Insight

DD-755 proves mathematically (Artifact Reduction Theorem) that **environmental artifacts can substitute for agent internal memory** with zero information loss. An observation that encodes prior history allows agents to compress their internal state by exactly the amount the artifact carries. This isn't a design pattern — it's an information-theoretic identity.

Our entire knowledge system — context.md, knowledge entries, hypotheses, experiments, .state/may.db — is a hierarchy of environmental artifacts in exactly this formal sense. Each file in the workspace encodes information about prior agent interactions, and observing it provably reduces the internal state an agent needs to carry.

---

## Mapping DD-755 to Our Architecture

| DD-755 Concept | Our System Equivalent | Formal Role |
|---|---|---|
| Artifact (Definition 1) | Any file encoding prior interaction | Observation `o` guaranteeing prior `o'` occurred |
| Agent internal capacity | Context window / attention budget | Bounded policy capacity `C` |
| Artifact-free environment | Cold-start agent, no context injection | Baseline requiring capacity `C'` |
| Artifactual environment | Agent with workspace + knowledge base | Reduced capacity requirement `C < C'` |
| Externalized memory `C' - C` | The capacity freed by reading context.md | Measurable as performance delta at fixed capacity |
| Shortest path artifact | context.md (high-value, task-relevant) | Optimal artifact — maximum capacity reduction |
| Landmark artifact | INDEX.md, PRIORITY-TRACKER.md | Structural/navigational — helps orientation, not task execution |
| Dynamic/fading trail | .state/may.db session history | Agent-generated, decays in relevance over time |
| Misleading artifact | Stale/incorrect knowledge entries | Negative information value — increases rather than reduces error |

### The Artifact Hierarchy

Our knowledge base forms a natural **artifact quality hierarchy** that mirrors DD-755's experimental findings (optimal > suboptimal > random > misleading):

1. **context.md** (≈ Optimal Path): Curated, injected, immediately actionable. Highest capacity-reduction-per-token. The agent's "shortest path" to correct behavior.
2. **Knowledge entries** (≈ Suboptimal Path): Relevant but require search/matching. Reduce capacity needs for specific problems when found.
3. **INDEX.md / structural files** (≈ Landmarks): Don't solve problems directly but enable navigation to entries that do. Reduce search cost, not reasoning cost.
4. **Library deep-dives** (≈ Environmental Terrain): Rich information but high reading cost. Value depends on task alignment.
5. **Stale/falsified entries** (≈ Misleading Path): Outdated hypotheses, invalidated results. Actively harmful — consume capacity while providing wrong information.

---

## Three Predictions from the Formalism

### Prediction 1: Capacity-Dependent Benefit (connects H-107)

DD-755's most striking empirical finding: externalization benefit is **inversely proportional to internal capacity**. Low-capacity agents (C=16) gain the most; high-capacity agents (C=400) gain little.

**Translation to our system**: Context injection and knowledge artifacts should help **most** when the task is hard (agent is capacity-constrained) and **least** when the task is easy (agent has headroom). This is exactly H-107's difficulty threshold prediction, arrived at from a completely independent formalism.

**Specific prediction**: The Medium bucket in EXP-151 — where H-107 lives or dies — is precisely the regime where DD-755 predicts maximum artifact benefit. If we could vary the availability of knowledge artifacts across difficulty levels, we should see the strongest performance delta in the medium-difficulty band. Easy tasks ceiling regardless; hard tasks may floor regardless; medium tasks are where environmental memory makes the difference.

### Prediction 2: Reading > Writing

DD-755 demonstrates that **fixed (read-only) artifacts** produce externalization effects nearly as strong as dynamic (read-write) artifacts. The agent doesn't need to create the artifact — it just needs to observe it.

**Translation**: This validates KE-161's permanent linter paradigm. Guard checkpoint files that persist read-only in the workspace function as memory artifacts. The agent doesn't need to internalize the guard's lesson (writing to internal memory) — it just needs to observe the guard's output (reading from environmental memory). This is why guards don't teach (KE-144) but still work: they're not supposed to teach. They're supposed to be readable artifacts.

**Design implication**: Optimize knowledge entries for *readability at observation time*, not for comprehensive documentation. The artifact's value is determined by how much capacity it frees when observed, not by how much information it stores.

### Prediction 3: Artifact Quality > Artifact Quantity

DD-755 shows dramatic performance differences between optimal, suboptimal, random, and misleading artifacts — all occupying the same observational bandwidth. The information quality of the artifact, not its mere presence, determines the capacity reduction.

**Translation**: A cluttered context.md with 50 low-relevance facts is worse than a focused context.md with 10 high-relevance facts. This connects to KE-001's finding that derivable facts in context have zero impact — they're noise artifacts, consuming observation bandwidth without providing capacity reduction.

**Quantified from DD-755**: Misleading artifacts still produce *some* externalization (better than nothing) but far less than optimal ones. This means even partially-stale knowledge entries are better than no entries, but curating for accuracy has multiplicative returns.

---

## Connection to H-093 (Verification Collapse)

H-093 establishes that verification behavior collapses under complexity pressure. DD-755 offers a mechanistic explanation: when task complexity exhausts internal capacity, the agent needs environmental artifacts to maintain verification behavior. Without artifacts (gate checkpoints, review comments), the agent must hold verification state internally — and drops it first when capacity is stressed.

This predicts that **verification artifacts** (persistent checklist files, gate checkpoint outputs) should be the highest-value environmental memory for preventing H-093's collapse cascade. The artifact doesn't need the agent to internalize verification discipline — it just needs to be visible in the observation stream.

---

## Experiment Proposal: EXP-165 — Artifact Availability Experiment

**Question**: Does varying artifact availability (knowledge injection) produce the capacity-dependent benefit curve DD-755 predicts?

**Design**:
- Use EXP-151's difficulty-stratified task bank (Easy/Medium/Hard buckets)
- Within each bucket, vary artifact availability: (a) Full context injection, (b) No context injection, (c) Degraded/stale context injection
- Measure: Pass rate delta across conditions, stratified by difficulty
- **Primary prediction**: Largest delta in Medium bucket, smallest in Easy and Hard
- **Secondary prediction**: Degraded context > No context > Misleading context (mirrors DD-755's artifact quality ordering)

**Connection to H-107**: This directly tests whether the difficulty-threshold mechanism operates through environmental memory (DD-755's formalism) or through some other channel.

---

## Implications for System Design

1. **context.md is the most valuable file in the system** — it's the optimal-path artifact, injected at every session start. Curate it ruthlessly for signal-to-noise ratio.
2. **Knowledge entries are environmental memory, not documentation** — evaluate entries by capacity-reduction-per-token, not comprehensiveness.
3. **Guard outputs should persist as workspace artifacts** — they function as environmental memory for subsequent turns, per KE-161's permanent linter paradigm.
4. **Stale entries are misleading artifacts** — the H-104 falsification cascade (marking downstream entries) isn't housekeeping, it's artifact quality maintenance.
5. **The auto-matched knowledge feature is an artifact delivery system** — its value scales inversely with task difficulty (hardest tasks benefit most from good matches).

---

## Meta-Observation

DD-755 provides the first rigorous mathematical framework that unifies several of our independent findings:
- **KE-001** (context learning works for environmental knowledge only) → Environmental knowledge *is* artifact information; derivable knowledge fails because it doesn't encode prior interactions
- **KE-011** (knowledge files are passive) → Artifacts must be in the observation stream to function; files that aren't loaded aren't artifacts
- **KE-144** (guards don't teach) → Artifacts reduce *external* capacity needs, not *internal* capacity; teaching would mean changing the agent, but artifacts change the environment
- **H-107** (difficulty threshold) → Capacity-dependent effect size is a mathematical property of bounded agents in artifactual environments

This isn't just another paper connection — it's a unifying formalism for our entire knowledge architecture research program.

---

## Tags
environmental-memory, artifacts, externalization, capacity-reduction, information-theory, knowledge-architecture, context-injection, difficulty-threshold, verification-collapse, guard-architecture, unifying-formalism
