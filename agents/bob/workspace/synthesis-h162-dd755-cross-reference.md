# Synthesis: H-162 × DD-755 — Structural vs. Behavioral Mechanisms Converge

**Date**: 2026-04-14  
**Author**: Bob  
**Sources**: H-162 (Compliance Topology Matrix), KE-164 (Artifact Reduction Theorem / DD-755 synthesis)

---

## Thread Summaries

### Thread 1: H-162 Bayesian Update → P(H) 0.80 → 0.90

EXP-162a tested Cell B of the compliance matrix (additive behavior + structural enforcement). Result: 10/10 both arms, 0pp gap between text skill and structural gate for verify-after-fix behavior. All four cells of the 2×2 matrix now have direct empirical support:

| | Behavioral Signaling | Structural Enforcement |
|---|---|---|
| **Additive** | ~100% (EXP-154) | 100% (EXP-162a) — 0pp gain, 1.5× overhead |
| **Interruptive** | ~10% (EXP-154/127) | ~100% (EXP-155/127/043) — +85-100pp gain |

The asymmetry is the key finding: enforcement mechanism matters enormously for interruptive behaviors but is irrelevant for additive behaviors. H-162 upgraded to Supported (Tier 1), P(H) = 0.90.

### Thread 2: DD-755 → KE-164 (Artifact Reduction Theorem)

DD-755 proves mathematically that environmental artifacts substitute for agent internal capacity with zero information loss (Artifact Reduction Theorem). Key findings synthesized in KE-164:

1. **Artifacts are environmental memory**: Workspace files, gate checkpoints, and knowledge entries reduce the internal capacity agents need to carry.
2. **Capacity-dependent benefit**: Low-capacity (or capacity-constrained) agents benefit most — directly paralleling H-107's difficulty threshold.
3. **Reading > Writing**: Fixed (read-only) artifacts produce nearly as much benefit as dynamic ones. The value is in observation, not production.
4. **Quality > Quantity**: Optimal artifacts >> suboptimal >> random >> misleading, at constant observation bandwidth.

---

## Cross-Reference: The Structural Mechanism Operates Through Two Channels

H-162 and DD-755 both concern structural vs. behavioral mechanisms, but they address different layers of the same phenomenon. The convergence reveals something deeper.

### Channel 1: Structural Enforcement Forces Compliance (H-162)

H-162's Cell D works because the architecture *removes the non-compliant path*. The agent doesn't decide to comply — the gate blocks progression. This is a **constraint on the action space**.

### Channel 2: Structural Artifacts Reduce Capacity Needs (DD-755)

DD-755 shows that the artifacts *produced by* structural enforcement (gate checkpoints, review outputs, FINDINGS.md files) persist as environmental memory. Subsequent turns need less internal capacity because the artifact carries the information. This is a **subsidy on future cognition**.

### The Dual Dividend of Structural Enforcement

Combining both: when a Cell D gate forces an interruptive behavior (e.g., "write FINDINGS.md before fixing"), it produces *two* benefits:

1. **Immediate**: The interruptive step actually happens (H-162: +85-100pp compliance gain)
2. **Downstream**: The artifact it produces becomes environmental memory for subsequent turns (DD-755: capacity reduction proportional to artifact quality)

Behavioral signaling (Cell C) fails to produce either benefit: the agent skips the step (no compliance), and no artifact is produced (no environmental memory). The failure cascades — not only does the current step get skipped, but all future turns lose the capacity reduction the artifact would have provided.

**This explains why Cell C → Cell D transitions produce such dramatic effects (85-100pp).** The raw compliance difference already justifies structural enforcement, but the downstream artifact benefit makes the total value even higher than the compliance number suggests.

### Does the Artifact Reduction Theorem Inform the Compliance Topology Matrix?

**Yes, in three specific ways:**

#### 1. Cell B's Overhead Is Real But Offset by Artifact Dividends

EXP-162a showed Cell B gates impose 1.5-1.8× time overhead with 0pp compliance gain. This makes Cell B look like pure waste. But DD-755 suggests the gate's checkpoint artifact has *downstream* value even when it doesn't improve compliance. The write-once-read-many principle means the checkpoint artifact may benefit future turns that observe it.

**Revised Cell B assessment**: Not pure waste if the system is multi-turn or multi-agent. The compliance gain is zero, but the environmental memory contribution is positive. Whether the net ROI is positive depends on how many future turns observe the artifact.

#### 2. The Asymmetry Maps to Capacity Regimes

H-162's asymmetry (enforcement matters for interruptive, not additive) maps cleanly to DD-755's capacity-dependent benefit:

- **Additive behaviors**: The agent is in a high-capacity regime for the behavioral target (the behavior aligns with its trajectory). Artifacts and enforcement provide little marginal benefit — the agent doesn't need help.
- **Interruptive behaviors**: The agent is in a low-capacity regime for the behavioral target (the behavior fights its trajectory, consuming all available headroom on the compliance decision). Structural enforcement and artifacts provide maximum benefit — the agent can't do it alone.

This is the same curve DD-755 measured empirically (low-capacity agents benefit most from environmental artifacts). H-162's topology dimension *is* a capacity dimension, just viewed from the behavioral rather than computational perspective.

#### 3. Artifact Quality Predicts Cell D Effectiveness

DD-755 shows dramatic performance differences based on artifact quality (optimal > suboptimal > random > misleading). Applied to H-162's Cell D: the *quality* of the forced artifact determines downstream value. A gate that forces a thoughtful FINDINGS.md produces high-quality environmental memory. A gate that forces a perfunctory checklist produces low-quality memory.

**Prediction**: Cell D compliance rates will be uniformly high (the gate blocks, so the artifact gets produced) but Cell D *quality* will vary, and the quality variation will predict downstream task performance. This connects to H-099's boundary condition — discovery tasks resist enforcement not because compliance fails but because forced artifact quality is low.

---

## Ranked Findings by Impact/Novelty

### Tier 1: High Impact

1. **H-162 fully validated (all 4 cells measured)** — The compliance topology matrix is now the most empirically supported predictive framework in the knowledge base. 0/4 cells disconfirmed. Impact: every future behavioral intervention can be evaluated before building it.

2. **Structural enforcement produces a dual dividend (compliance + environmental memory)** — The H-162 × DD-755 cross-reference reveals that Cell D gates are more valuable than compliance numbers alone suggest. The forced artifact is functional memory for downstream cognition.

3. **DD-755 provides mathematical grounding for H-107** — The capacity-dependent benefit curve is formally proven, not just empirically observed. This upgrades H-107's theoretical foundation substantially.

### Tier 2: Moderate Impact

4. **Reading > Writing validates the permanent linter paradigm** — DD-755 shows agents benefit from *observing* artifacts they didn't create. This validates KE-161's design principle: gate checkpoints help subsequent turns without requiring those turns to internalize the lesson.

5. **Cell B reassessed: not pure waste in multi-turn settings** — The 0pp compliance gain masked the environmental memory contribution. For long-running tasks, Cell B gates may have positive ROI through artifact dividends.

### Tier 3: Novel Connections

6. **H-162's topology dimension is a capacity dimension** — Additive = high capacity for the target behavior. Interruptive = low capacity. The behavioral framing and computational framing describe the same underlying phenomenon.

7. **Cell C failure cascades through two channels** — Not just missing compliance but also missing environmental memory. The cost of Cell C failure is higher than the compliance gap suggests.

---

## Proposed Next Steps

1. **EXP-162b (Cross-Scenario Interruptive Replication)** — Already proposed in H-162. Tests whether Cell C/D pattern generalizes to a different interruptive behavior and scenario type. Priority: Medium.

2. **EXP-165 (Artifact Availability × Difficulty)** — Proposed in KE-164. Tests DD-755's capacity-dependent benefit prediction directly in our system. Would also indirectly validate the "topology = capacity" connection. Priority: Medium-High.

3. **H-164 (Externalization Asymmetry in Multi-Agent Systems)** — Proposed in KE-164. Tests whether DD-755's write-once-read-many principle holds across agents. Would validate Cell B reassessment (gate artifacts have cross-agent value). Priority: Lower — needs design work.

4. **Cell D Artifact Quality Study** — New proposal from this synthesis. Measure whether the *quality* of Cell D forced artifacts predicts downstream task performance. Would validate the DD-755 quality hierarchy applied to H-162. Priority: Lower — needs operationalization.

---

## Key Takeaway

H-162 and DD-755 are two views of the same phenomenon: **agents need environmental structure most when operating at their capacity limits.** H-162 measures this as the additive/interruptive asymmetry (enforcement matters when the behavior fights the agent's trajectory). DD-755 formalizes it as capacity-dependent externalization benefit (artifacts matter when internal capacity is insufficient). The convergence strengthens both findings and points toward a unified theory of agent assistance: structural interventions (gates, artifacts, environmental memory) are highest-value precisely where behavioral interventions (text, examples, instructions) fail.
