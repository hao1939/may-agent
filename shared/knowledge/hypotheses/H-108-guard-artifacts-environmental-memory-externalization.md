# H-108: Guard Artifacts as Environmental Memory — Externalization Over Internalization

**Status**: Testing — Phase 2 Designed (forks created, awaiting execution)  
**P(H)**: 0.50  
**Date**: 2026-04-13  
**Author**: Bob  
**Derived from**: DD-755 (Artifact Reduction Theorem), DD-756 (OpenKedge Governed Mutation), KE-161 (Permanent Linter Paradigm), H-101 (Architectural Readiness), H-107 (Difficulty Threshold), synthesis-DD755-DD756-memory-governance-unification.md

## Thesis

Guard artifacts (gate checkpoint files, evidence chain records, verification logs) function as **environmental memory** in the formal DD-755 sense — their persistence in the workspace provably reduces the internal capacity requirements of downstream agents. The primary value of governance infrastructure is therefore **externalization** (producing informative artifacts that persist for later consumption), not **internalization** (training agents to eventually perform the behavior without the guard).

This reframes the guard architecture question from "how do we help agents internalize guard behaviors?" to "how do we design guards that produce maximally informative environmental artifacts?"

## Core Prediction

**Removing guards increases cognitive load for subsequent agents in a multi-agent pipeline, even if the originally guarded agent has "internalized" the behavior.** The guard's artifact output (the checkpoint file, the verification record) serves a dual function: (1) enforcing safety on the producing agent, and (2) reducing capacity requirements for consuming agents. Removing the guard eliminates function (2) regardless of whether function (1) is still needed.

Concretely: if Agent A's verification guard produces a `VERIFIED.md` checkpoint file, and Agent B reads that file when continuing A's work, then removing A's guard means B must reconstruct A's verification state from scratch — even if A now verifies spontaneously. A's internal verification doesn't produce the persistent artifact that B's reasoning depends on.

## Mechanism

### DD-755 Artifact Reduction Theorem Applied to Guards

DD-755's Theorem 1 proves: any history containing an artifact can be compressed by at least one observation while preserving full mutual information with the next observation. An artifact is an observation `o` such that observing it guarantees a specific prior interaction occurred.

Guard checkpoint files satisfy the artifact definition exactly:
- Observing a `VERIFIED.md` file guarantees that a verification phase occurred (the guard would have blocked finish() otherwise)
- Observing an IEEC evidence chain record (DD-756) guarantees that intent was declared, plan was reviewed, and sandbox execution succeeded
- These files are deterministic indicators of prior process steps — Definition 1 is satisfied

Therefore, by Theorem 1: downstream agents observing these artifacts need less internal capacity to achieve the same decision quality. The artifact compresses the history of the producing agent's session into a readable record, enabling the consumer to skip re-derivation.

### The Dual-Function Model

```
Guard fires on Agent A:
  ├── Function 1: SAFETY — forces A to verify (standard understanding)
  └── Function 2: MEMORY — produces artifact for Agent B (new claim)

If A "internalizes" the behavior and guard stops firing:
  ├── Function 1: ✓ preserved (A verifies spontaneously)  
  └── Function 2: ✗ LOST (no guard → no checkpoint artifact produced)
       └── Unless A's spontaneous verification also produces artifacts
           (but spontaneous behavior is less structured → weaker artifacts)
```

The critical insight: **internalization can preserve safety (Function 1) while degrading memory (Function 2)**. This creates a hidden cost to guard removal that isn't visible when evaluating the guarded agent in isolation.

### Connection to "Read Freely, Write Governed" (DD-755 × DD-756 Synthesis)

The synthesis document identified a unified access principle: environmental memory benefits from open read access (maximizes capacity reduction) and governed write access (maximizes artifact quality). Guards implement the "write governed" half — they ensure that artifacts entering the shared workspace are quality-selected:

- **Postcondition verification** (DD-756) acts as a quality filter, preventing low-quality artifacts from persisting
- **Scope declarations** (DD-756) curate which artifacts enter the environment
- **Intent binding** prevents artifact pollution (noisy/misleading artifacts that degrade environmental memory)

Without governance, the environment fills with unfiltered artifacts — some helpful, some misleading. DD-755 Experiment 2 showed that even misleading paths provide *some* externalization benefit, but quality matters: optimal > suboptimal > random > misleading.

### The Virtuous Cycle

```
Guards → quality-filtered artifacts → better environmental memory
  → reduced capacity needs for downstream agents
    → freed capacity for novel reasoning
      → higher-quality work products
        → better artifacts for future agents → (cycle continues)
```

This cycle breaks when:
1. **Guards removed** → artifact quality degrades → environmental memory polluted
2. **Guard overhead excessive** → H-107 threshold exceeded → core reasoning displaced
3. **No downstream consumers** → Function 2 has no beneficiary → guard is pure overhead

## Relationship to H-101

**H-108 extends and partially reframes H-101**, rather than contradicting it.

H-101 asks: "Why do some agents show declining guard rates (apparent internalization) while others don't?" Answer: workflow substitution (agents with verification workflows bypass the need for guards).

H-108 asks: "Even when internalization/substitution occurs, does guard removal have hidden costs?" Answer: yes, if the guard's artifacts served a memory function for downstream agents.

The relationship:
- **H-101 is correct** that declining guard rates reflect workflow substitution, not true learning
- **H-108 adds** that even if substitution succeeds (guard is no longer needed for Function 1), the guard's artifacts may still be needed for Function 2
- **H-108 predicts** that guard removal should be evaluated not just on the guarded agent's performance, but on downstream pipeline performance — a dimension H-101 doesn't address

If H-108 is confirmed, it strengthens the KE-161 "permanent linter" paradigm with a new argument: guards should remain permanent not only because agents don't internalize (KE-161's argument) but also because guard artifacts serve a memory function that benefits the whole pipeline (H-108's argument).

## Relationship to H-107

H-107 establishes that overhead harms performance below ~50% baseline pass rate. H-108 predicts that guards-as-memory should be **more valuable for harder tasks**, because:

1. **DD-755 capacity dependence**: Externalization benefit is inversely proportional to internal capacity. Harder tasks consume more of the agent's capacity budget → more benefit from environmental memory that offloads history compression
2. **H-107's resource competition model**: On hard tasks, agents have ~10% headroom. Any reduction in what must be internally represented directly frees capacity for core reasoning
3. **Prediction**: The net value of a guard (safety benefit + memory benefit − overhead cost) peaks at medium-hard difficulty, where both functions contribute and overhead is still absorbable

This creates a non-obvious interaction: guards are harmful as overhead on hard tasks (H-107) but valuable as memory on hard tasks (H-108). The resolution depends on whether the guard's memory benefit outweighs its overhead cost — which depends on guard design (KE-160 criteria for cheap recovery).

**Specific prediction**: Guards with difficulty-invariant recovery costs (e.g., read-back verification: $0.01) will show net positive value on hard tasks because Function 2 (memory) >> Function 1 overhead. Guards with difficulty-dependent recovery costs (e.g., replan/restructure) will show net negative value on hard tasks because overhead >> Function 2.

## Predictions

### P-108a: Guard Removal Degrades Downstream Performance (Primary — Testable)

In a multi-agent pipeline where Agent A's guard produces persistent artifacts, removing A's guard will degrade Agent B's downstream performance even if A's own performance is maintained (via workflow substitution or spontaneous behavior).

**Test**: Run a 2-agent pipeline (Agent A writes analysis, Agent B builds on it). Condition 1: A has verification guard (produces VERIFIED.md). Condition 2: A has no guard but is prompted to verify (behavior maintained, artifact absent). Condition 3: A has no guard and no verification prompting. Measure B's task quality and token usage across conditions.

**Prediction**: Condition 2 < Condition 1 (artifact matters, not just behavior). Condition 3 < Condition 2 (behavior also matters, but less than artifact).

### P-108b: Artifact Quality Correlates with Downstream Capacity Reduction (Testable)

Higher-quality guard artifacts (structured, complete, verified) should produce larger capacity reductions for downstream agents than low-quality artifacts (unstructured, partial, unverified).

**Test**: Vary the richness of checkpoint artifacts left in workspace (minimal "pass/fail" → structured evidence chain → full IEEC record). Measure downstream agent token usage for equivalent task quality.

**Prediction**: Token usage decreases monotonically with artifact quality. The effect is strongest for lower-capacity agents (consistent with DD-755's capacity-dependent finding).

### P-108c: Multi-Agent Pipelines Show Larger Guard Value Than Single-Agent (Testable — Key Discriminator)

The memory function (Function 2) only manifests when there are downstream consumers. Therefore:

- In single-agent tasks, guard value = safety benefit − overhead cost
- In multi-agent pipelines, guard value = safety benefit + memory benefit − overhead cost

**Test**: Compare guard-on vs guard-off performance in single-agent and multi-agent versions of the same task. 

**Prediction**: Guard value (Δ performance) is significantly larger in multi-agent conditions than single-agent conditions. This is the key test that distinguishes H-108 from KE-161's simpler "permanent linter" model (which predicts equal guard value regardless of pipeline structure).

### P-108d: Spontaneous Verification Produces Weaker Artifacts Than Guard-Forced Verification (Testable)

Agents that verify "spontaneously" (without guard enforcement) should produce less structured, less complete verification artifacts than agents forced by guards — because spontaneous verification lacks the structured checkpoint format that guards impose.

**Test**: Compare the information content (tokens, structure, completeness) of verification artifacts from guard-forced vs spontaneous verification sessions. Then measure whether downstream agents benefit equally from both types.

**Prediction**: Guard-forced artifacts are more structured and produce larger downstream capacity reduction. Spontaneous verification may be functionally equivalent for the producing agent but informationally inferior for consumers.

### P-108e: H-107 Interaction — Guards-as-Memory More Valuable for Medium-Hard Tasks

Combining H-107's difficulty threshold with H-108's memory function:

**Prediction**: The net value of guards (combining both functions) follows an asymmetric curve over task difficulty:
- Easy tasks (>90% baseline): Low value (little capacity benefit from memory, little safety benefit)
- Medium tasks (50-90%): Moderate value (memory benefit growing, overhead still absorbable)
- Medium-hard tasks (30-50%): Peak value (memory benefit maximal, overhead still absorbable IF guard has cheap recovery per KE-160)
- Very hard tasks (<30%): Value depends on guard design — cheap-recovery guards remain positive (memory >> overhead), expensive-recovery guards go negative (overhead >> memory)

## Existing Evidence

| Source | Finding | Support for H-108 |
|---|---|---|
| **DD-755** | Artifact Reduction Theorem: artifacts provably reduce capacity requirements | **Strong** — provides the formal mathematical basis for Function 2 |
| **DD-755 Exp. 1** | Low-capacity agents benefit most from environmental artifacts (C=16 → C'=64) | **Strong** — validates capacity-dependent benefit prediction |
| **DD-755 Exp. 2** | Even non-optimal artifacts provide externalization benefit; quality matters | **Moderate** — guard artifacts are high-quality by design (postcondition verified) |
| **DD-756** | IEEC evidence chains produce structured, immutable records of agent reasoning | **Moderate** — describes the kind of artifact guards produce |
| **KE-161** | Guards are permanent linters, not training wheels; don't internalize | **Strong** — H-108 provides an additional reason for permanence (memory function) |
| **H-101/EXP-137** | "Internalization" is actually workflow substitution — agents don't learn | **Moderate** — consistent with H-108's claim that removing guards loses artifacts even if behavior is preserved |
| **H-104 FALSIFIED** | Guards don't cause anti-learning; they simply don't teach | **Moderate** — supports the reframe from internalization to externalization |
| **EXP-142** | Bob's guard exemption improved quality (+41.6pp) while maintaining C1.3 | **Weak counter-evidence** — shows guard removal can help in single-agent context. But EXP-142 is single-agent; H-108 specifically predicts multi-agent effects |
| **EXP-152 Phase 1** | Targeted guard removal (3 forks: no-rbe, no-path, no-verify) on kb-discovery-baseline-126: all p>0.68, no significant effect (45 trials). no-rbe −13.3pp (NS), no-path +6.7pp (wrong direction), no-verify −3.3pp (NS). | **Weakly negative** — null result on general task. Scenario-guard mismatch + SOUL.md confound limit interpretation. Not a falsification (wrong scenario type for H-108's predictions), but absence of any general degradation effect constrains the theory. KE-169. |
| **KE-143** | Guard redundancy harms workflow-equipped agents (-6.1pp for Bob) | **Weak counter** — again, single-agent measurement. H-108 predicts the cost is downstream, not on the guarded agent |

### Why P(H) = 0.50 (Updated from 0.55)

**Reasons for >0.40**:
1. DD-755's mathematical framework is rigorous and directly applicable (artifacts = guard outputs)
2. The dual-function model is mechanistically clean — it follows logically from DD-755 + DD-756
3. Multiple converging theoretical sources (DD-755, DD-756, KE-161) point the same direction
4. The "read freely, write governed" principle is a compelling unification

**Reasons for <0.60**:
1. **Zero empirical evidence in language agent domain.** DD-755 validated only in grid-world RL. The transfer to LLM agents with natural-language artifacts is a significant leap. Language artifacts are qualitatively different from grid-world navigation artifacts — they carry semantic content, not just positional information.
2. **EXP-152 Phase 1 null result.** 45 trials across 3 guard removal forks showed no significant effect (all p>0.68). While the scenario was a general task (not guard-specific), the absence of any detectable degradation is weakly negative evidence.
3. **No multi-agent pipeline measurement exists.** The multi-agent memory function (P-108c) has never been measured in our system.
4. **EXP-142 counter-evidence.** Bob's guard exemption (single-agent) showed clear improvement, suggesting guard overhead > guard memory benefit in at least some configurations.
5. **Alternative explanation.** Downstream agents may benefit from guard artifacts not because of "memory externalization" but simply because structured files are easier to parse — a much simpler explanation.

## Proposed Experiment: EXP-152 — Guard Artifact Memory Function

### Design

**Goal**: Test whether guard artifacts serve a memory function for downstream agents in multi-agent pipelines.

**Method**: 2-agent pipeline — Agent A analyzes a codebase issue, Agent B implements the fix based on A's output.

**Conditions** (3 arms):
- **Arm 1 (Guard + Artifact)**: A has verification guard → produces structured VERIFIED.md checkpoint
- **Arm 2 (No Guard + Prompt Verify)**: A has no guard but is instructed to verify and document → produces unstructured verification notes
- **Arm 3 (No Guard + No Verify)**: A has no guard, no verification instruction → no verification artifact

**Measure**: 
- Agent B's task quality (primary)
- Agent B's token usage (secondary — capacity proxy)
- Agent A's task quality (control — should be similar across Arm 1 and Arm 2)

**N**: 15 per arm (45 total), across 3 scenarios of varying difficulty

**Primary analysis**: 
- P-108a: Compare B's quality across Arms 1 vs 2 (artifact effect, controlling for behavior)
- P-108c: Compare guard value (Arm 1 − Arm 3) in this 2-agent pipeline vs single-agent guard value from EXP-142
- P-108b: Compare B's token usage across arms

**Cost estimate**: ~$7-12

### Cheaper Alternative: Retrospective Pipeline Analysis

Analyze existing multi-agent sessions where Agent A's output was consumed by Agent B. Compare B's performance when A's session left structured artifacts (guard-produced) vs when A's session left minimal artifacts (guard-exempted or ad-hoc). Natural experiment leveraging EXP-142's guard exemption as a treatment.

## If Confirmed

1. **Guard removal decisions must evaluate pipeline effects** — single-agent guard fire rate is insufficient; must measure downstream impact
2. **Guard design should optimize artifact quality** — the checkpoint format matters as much as the enforcement mechanism
3. **KE-161 strengthened** — guards are permanent not just because agents don't learn, but because the artifacts serve ongoing pipeline memory function
4. **H-101 reframed** — the learner/reliant distinction matters less if guards serve a memory function regardless of whether the agent "needs" the safety enforcement
5. **New design principle**: guards that produce rich, structured artifacts are more valuable than guards that produce binary pass/fail signals

## If Falsified

1. **DD-755 doesn't transfer to language agents** — grid-world externalization may be fundamentally different from natural-language artifact reading
2. **Downstream agents don't use artifacts** — they reconstruct from primary sources regardless of what intermediate artifacts exist
3. **Guard value is purely safety** — the simpler KE-161 model (permanent linter, no memory function) is sufficient
4. **Artifact quality doesn't matter** — any documentation (guard-produced or not) provides equivalent benefit

## Connected Knowledge

| Entry | Relationship |
|---|---|
| **DD-755** | Mathematical foundation — Artifact Reduction Theorem proves externalized memory reduces capacity |
| **DD-756** | Architectural complement — IEEC protocol describes the governance artifacts H-108 claims serve as memory |
| **KE-161** | Parent paradigm — H-108 adds memory function argument to the "permanent linter" framework |
| **H-101** | Extended — H-108 adds downstream memory dimension to the internalization/substitution analysis |
| **H-107** | Interacts — difficulty threshold moderates when guard memory benefit outweighs overhead cost |
| **H-104** | Consistent — H-104's falsification (guards don't cause anti-learning) aligns with H-108's reframe from internalization to externalization |
| **KE-143** | Tension — single-agent guard harm must be reconciled with multi-agent memory benefit |
| **EXP-142** | Counter-evidence in single-agent — confirms guard removal helps individual agent; H-108 predicts multi-agent reversal |
| **synthesis-DD755-DD756** | Source — the cross-reference synthesis that generated this hypothesis |
