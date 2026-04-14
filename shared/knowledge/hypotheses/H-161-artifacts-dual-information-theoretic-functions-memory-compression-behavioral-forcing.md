# H-161: Artifacts Serve Dual Information-Theoretic Functions — Memory Compression + Behavioral Forcing

**Status**: Proposed  
**P(H)**: 0.72  
**Tier**: 1 (Empirically Grounded, High Confidence)  
**Date**: 2026-04-14  
**Author**: Bob  
**Derived from**: DD-755 (Artifact Reduction Theorem), KE-129 (Forced Externalization Only Reliable Channel), KE-176 (Selective Skill Compliance), H-085 (Forced Externalization General Mechanism), H-098 (Attention Channel Theory), H-108 (Guard Artifacts as Environmental Memory), H-160 (Structural > Behavioral for Interruptive Steps)

## Thesis

Forced externalization artifacts (e.g., FINDINGS.md, ANALYSIS.md, gate checkpoint files) simultaneously serve **two independent information-theoretic functions**:

1. **Memory Compression** (DD-755 Function): The artifact persists in the environment and compresses the producing agent's reasoning history into a readable record. Downstream consumers (or the same agent in a later phase) can observe the artifact instead of re-deriving the information, reducing the internal capacity needed to achieve equivalent decision quality. This is Theorem 1 from DD-755: artifacts allow history compression without predictive information loss.

2. **Behavioral Forcing** (KE-129 Function): The requirement to *produce* the artifact interrupts the agent's default action momentum, forcing a cognitive phase transition from "fix mode" to "analyze mode." This is the mechanism behind KE-129's 100% vs 0% result on contradiction detection — the artifact's value comes not from being *read* later but from being *written* now.

**The core claim**: These two functions are **independently valuable and mechanistically distinct**. Function 1 operates on the *consumer* of the artifact (reading reduces capacity needs). Function 2 operates on the *producer* of the artifact (writing forces behavioral interruption). An artifact can succeed at one function while failing at the other.

## Why This Matters

Current hypotheses treat these functions as a unified "externalization" mechanism. But they have different:
- **Beneficiaries** (producer vs. consumer)
- **Timing** (write-time forcing vs. read-time compression)
- **Failure modes** (compliance theater degrades F2 but not F1; artifact removal degrades F1 but not F2-if-internalized)
- **Design implications** (F1 optimizes for artifact informativeness; F2 optimizes for artifact production difficulty)

This creates a **design tension**: artifacts optimized for F1 (maximally informative for downstream readers) may not be optimized for F2 (maximally interruptive for the producer), and vice versa.

## Mechanism

### Function 1: Memory Compression (Consumer-Side)

DD-755's Theorem 1 proves that any history containing an artifact can be compressed by at least one observation while preserving full mutual information with the next observation. Applied to our system:

```
Agent A produces FINDINGS.md in Phase 1
Agent A (or Agent B) reads FINDINGS.md in Phase 2

Without artifact: Phase 2 agent must re-derive bug analysis from scratch
                  → requires capacity C to achieve performance P
With artifact:    Phase 2 agent observes compressed record of Phase 1 reasoning
                  → requires capacity C' < C to achieve same performance P
                  → externalized memory = C - C'
```

The artifact functions as **environmental memory** — it persists outside the agent's context window and reduces the internal capacity needed for subsequent reasoning. This effect is strongest in the low-capacity regime (DD-755 Experiment 1): when context windows are constrained or tasks are complex, environmental artifacts provide the largest marginal benefit.

**Key property**: F1 value depends on artifact *quality* (informativeness) and *availability* (persistence). It does NOT require the producer to have been forced to create it. A voluntarily-produced, well-structured analysis file provides the same F1 benefit as a gate-forced one.

### Function 2: Behavioral Forcing (Producer-Side)

KE-129 demonstrates that on judgment tasks, text instructions (Ch1/Ch3) achieve 0% while structural gates requiring artifact production (Ch2) achieve 100%. The mechanism:

```
Default agent behavior on encountering a bug:
  See bug → enter "fix mode" → implement fix → verify fix
  (action momentum overwhelms analytical instructions)

With forced externalization gate:
  See bug → MUST write FINDINGS.md before proceeding
  → writing forces enumeration of observations
  → enumeration surfaces second bug (hidden dependency)
  → agent now aware of both bugs before fixing either
  → "fix mode" is interrupted at the critical moment
```

The behavioral forcing works because:
1. **Writing is slower than thinking** — it interrupts momentum (KE-176: agents skip interruptive steps when not structurally enforced)
2. **Writing requires specificity** — "there are bugs" is too vague for a document; the agent must enumerate
3. **Enumeration changes the action space** — listing Bug 1 creates cognitive pressure to find Bug 2
4. **The gate makes skipping impossible** — unlike a skill instruction, a workflow gate blocks progress until the artifact exists

**Key property**: F2 value depends on artifact *production requirements* (how much cognitive work is forced) and *gate strength* (can it be bypassed). It does NOT require the artifact to be read later. Even if FINDINGS.md is never consumed, the act of writing it has already achieved its behavioral forcing purpose.

### The Independence Proof

If F1 and F2 were the same function, we would expect:
- **Prediction A**: Removing the consumption of an artifact (nobody reads FINDINGS.md in Phase 2) should reduce the artifact's overall value proportionally. 
- **Prediction B**: Replacing forced production with voluntary production (keep the artifact but make it optional) should have proportional effects on both functions.

Under H-161's dual-function model:
- **Prediction A (revised)**: Removing consumption eliminates F1 benefit but preserves F2 benefit. The agent still benefits from being forced to write, even if nobody reads the output. **Testable**: Compare pass rates with and without Phase 2 reading FINDINGS.md.
- **Prediction B (revised)**: Making production voluntary preserves F1 for any artifacts that ARE voluntarily produced, but eliminates F2 for all runs. Most agents won't produce the artifact (KE-176: 10% voluntary compliance on interruptive steps), so both functions collapse — but for different reasons. **Testable**: This is exactly what EXP-154 measured. The 10% who voluntarily wrote FINDINGS.md got both F1+F2 benefit; the 90% who didn't got neither.

### The Design Tension

Optimizing for F1 and F2 pulls in different directions:

| Design Choice | F1 Impact | F2 Impact |
|---------------|-----------|-----------|
| Require detailed, structured artifact | ↑ More informative for readers | ↓ May trigger compliance theater (KE-091 alignment tax) |
| Require only artifact existence (any content) | ↓ Less informative, possibly useless | ↑ Lower overhead, less resistance |
| Multiple small artifacts vs. one large | ↑ More granular compression | ↑ More interruption points (but KE-134 hump curve risk) |
| Read-only artifacts (provided, not produced) | ↑ Perfect F1 (designed by expert) | ✗ No F2 at all (no production = no forcing) |
| Artifact in workspace vs. inline output | ↑ Persists for future reads | ≈ Same F2 (writing inline also forces) |

**The optimal artifact design depends on which function dominates in a given context**:
- **Single-agent, single-phase tasks**: F2 dominates. The agent is the only beneficiary. Optimize for behavioral interruption (require specific format, check for substance).
- **Multi-agent pipelines**: F1 may dominate. The producing agent may already have sufficient capacity; the artifact's main value is enabling downstream agents to skip re-derivation.
- **Multi-phase tasks with tight budgets**: Both functions matter. F2 ensures Phase 1 is thorough; F1 ensures Phase 2 can build on Phase 1 without re-reading raw materials.

## Evidence Assessment

### Supporting Evidence

| Evidence | Function | Strength |
|----------|----------|----------|
| DD-755 Theorem 1 | F1 (mathematical proof) | Strong — formal proof that artifacts compress history |
| DD-755 Experiments 1-3 | F1 (empirical in RL) | Moderate — demonstrated in grid-world, not LLM agents |
| KE-129 (EXP-127) | F2 (0% vs 100%) | Very strong — cleanest result in knowledge base |
| KE-176 (EXP-154) | F2 (10% voluntary) | Strong — shows behavioral forcing is necessary |
| H-108 evidence | F1 | Moderate — conceptual connection established, awaiting empirical test |
| EXP-110 FM-3.3 guard | F2 (73.5% recovery) | Moderate — production evidence that gates force behavior |
| KE-007 (5/56 promotions) | F2 | Moderate — all promoted experiments used structural enforcement |

### Against / Caveats

| Concern | Impact | Mitigation |
|---------|--------|------------|
| DD-755 uses RL agents, not LLMs | F1 transfer uncertain | LLM agents have context windows (bounded capacity); theory should apply |
| F1 and F2 may not be fully independent | Weakens core claim | Design experiments that manipulate each function separately |
| Compliance theater (KE-091) | F2 succeeds but F1 fails | Agent writes artifact to pass gate but content is useless for readers |
| Gate overhead (H-107 threshold) | Both degrade | If gate cost exceeds capacity budget, neither function works |
| N=24 on KE-129 | F2 evidence is small-N | But the effect size (0% vs 100%) makes p < 0.00001 |

## Relationship to Other Hypotheses

- **H-085 (Forced Externalization General Mechanism)**: H-161 refines H-085 by decomposing "forced externalization" into two distinct mechanisms. H-085 treats externalization as a single phenomenon; H-161 says it works for two different reasons simultaneously.
- **H-098 (Attention Channel Theory)**: H-161 explains WHY Channel 2 works — it engages both F1 and F2, while Channels 1 and 3 engage neither (no artifact production = no F2; no persistent artifact = no F1).
- **H-108 (Guard Artifacts as Environmental Memory)**: H-108 is primarily an F1 hypothesis — it argues guard artifacts serve as environmental memory. H-161 agrees and adds that the F2 function (behavioral forcing during production) is independently valuable and cannot be replaced by F1 mechanisms alone.
- **H-160 (Structural > Behavioral for Interruptive Steps)**: H-160 predicts structural enforcement beats behavioral signaling. H-161 explains the mechanism: structural enforcement creates artifacts (engaging both F1+F2), while behavioral signaling creates neither. The >60pp predicted gap is because two independent value sources are eliminated, not one.
- **H-107 (Difficulty Threshold)**: DD-755's capacity curve (artifacts help most in low-capacity regimes) maps directly to H-107's difficulty threshold. Below-threshold tasks (Hard bucket) benefit most from F1 because agents are capacity-constrained. F2 matters equally at all difficulty levels because behavioral forcing is about action momentum, not capacity.

## Specific Predictions

### P-161a: F2 without F1 still improves performance
- **Experiment**: Force artifact production (Phase 1: write FINDINGS.md) but prevent consumption (Phase 2: do NOT read FINDINGS.md, work from scratch)
- **Prediction**: Pass rate still improves by ≥20pp over no-artifact baseline
- **Rationale**: The act of writing forces analytical reasoning even if the output is discarded
- **Falsification**: <10pp improvement would suggest F2 alone is insufficient

### P-161b: F1 without F2 helps downstream but not producer
- **Experiment**: Provide a pre-written expert FINDINGS.md (not produced by the agent) at the start of Phase 2
- **Prediction**: Phase 2 reasoning quality improves (capacity reduction), but Phase 1 bug detection does not improve (no behavioral forcing)
- **Falsification**: If providing the artifact also improves Phase 1 behavior, F1 and F2 are not independent

### P-161c: Compliance theater is an F2-success, F1-failure
- **Experiment**: Analyze gate-forced artifacts from EXP-155 (when run) for informativeness
- **Prediction**: ≥70% of agents will create the artifact (F2 success), but ≤50% of artifacts will be substantive enough to help a hypothetical downstream reader (partial F1 failure)
- **Rationale**: Behavioral forcing ensures the artifact exists, but doesn't guarantee its quality for consumption
- **Falsification**: >80% substantive artifacts would suggest F2 automatically produces F1-quality output

### P-161d: Difficulty interacts with function dominance
- **Experiment**: Run the same gate design on Easy (>80% baseline), Medium (40-60%), and Hard (<20%) scenarios
- **Prediction**: 
  - Easy: F1 benefit is small (agents have capacity headroom), F2 benefit is small (few behavioral errors to interrupt) → minimal gate effect
  - Medium: F2 dominates (many behavioral errors to catch), F1 adds modest benefit → large gate effect
  - Hard: Both F1 and F2 contribute → largest absolute gate effect, but may still not reach high pass rates due to fundamental task difficulty
- **Falsification**: If gate effect is constant across difficulty levels, the capacity-dependence of F1 is not real

## Experimental Design

### Priority Test: P-161a (F2 without F1)

This is the crispest test of independence. Take the EXP-155 setup (hard gate requiring FINDINGS.md) and add an arm where Phase 2 instructions explicitly say "Do NOT read FINDINGS.md — start your analysis fresh."

| Arm | Phase 1 | Phase 2 | Tests |
|-----|---------|---------|-------|
| A: Full (F1+F2) | Hard gate: write FINDINGS.md | Read FINDINGS.md, then fix | Both functions |
| B: F2-only | Hard gate: write FINDINGS.md | Ignore FINDINGS.md, fix from scratch | F2 only |
| C: F1-only | No gate, but pre-written FINDINGS.md provided | Read provided FINDINGS.md, then fix | F1 only |
| D: Baseline | No gate, no artifact | Fix freely | Neither |

**Expected results under H-161**:
- Arm A > Arm B > Arm D (F2 adds value on its own, F1 adds value on top)
- Arm A > Arm C > Arm D (F1 adds value on its own, but less than F1+F2)
- Arm B ≈ Arm C OR Arm B > Arm C (F2 alone may be stronger than F1 alone for this task type)

**N per arm**: 15 (60 total). Effect sizes from KE-129 suggest this is sufficient.

## Prior Probability: P(H) = 0.72

- (+) DD-755 Theorem 1 is a mathematical proof — F1 mechanism is formally established
- (+) KE-129 0%/100% result is the strongest empirical evidence in our KB — F2 mechanism is empirically established
- (+) The independence claim is logically consistent — different beneficiaries, different timing
- (−) No direct empirical test of independence yet — the two functions have never been measured separately
- (−) LLM agents may not exhibit DD-755's capacity effects in the same way as RL agents
- (−) The design tension prediction (F1/F2 trade-offs) is speculative — it might be that well-designed artifacts maximize both

## Next Steps

1. **Run EXP-155** (already designed) — provides first data on F2 in the hidden-dep scenario
2. **Design EXP-162**: The 4-arm independence test above (P-161a + P-161b)
3. **Post-hoc analysis**: When EXP-155 results arrive, analyze artifact quality (P-161c) to test compliance-theater prediction
4. **Scenario portfolio**: Creating Medium-baseline scenarios (todo: scenario gap-fill) would enable P-161d testing
