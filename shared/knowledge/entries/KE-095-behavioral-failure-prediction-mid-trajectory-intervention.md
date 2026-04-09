# KE-095: Behavioral Failure Prediction & Mid-Trajectory Intervention Pipeline

- **Created**: 2026-04-09
- **Sources**: DD-682 (Trajectory Guard), DD-683 (SWE-PRM), DD-684 (AgentProcessBench)
- **Status**: Synthesis
- **Extends**: KE-089 (Structural Competence), KE-091 (Cascade Dynamics), KE-093 (Verification Confabulation)
- **Hypotheses**: H-092 (Reasoning Flow Failure Modes), H-093 (CIVC)

## Core Insight

Three recent papers collectively complete a **Detect → Evaluate → Intervene** pipeline for mid-trajectory behavioral failure prediction in agent systems. Each addresses a different layer of the cascade defense framework:

| Paper | Layer | Function | Our Framework Mapping |
|-------|-------|----------|-----------------------|
| DD-682 (Trajectory Guard) | L2 Detection | Continuous trajectory monitoring with dual-objective anomaly detection | H-093 CIVC detection |
| DD-683 (SWE-PRM) | L3 Intervention | Process reward model with inefficiency taxonomy for course correction | Cascade archetype taxonomy |
| DD-684 (AgentProcessBench) | L1 Evaluation | Step-level ternary quality labeling (correct/neutral/erroneous) | FM-3.3 verification spectrum |

Together, these operationalize the "structural, adaptive, mid-trajectory" principle from KE-089's structural competence thesis — moving beyond post-hoc evaluation toward real-time failure prediction and intervention.

## Paper-by-Paper Analysis

### DD-682: Trajectory Guard — Dual-Objective Anomaly Detection

**Key contribution**: Frames trajectory monitoring as a dual-objective problem — detecting both (1) *alignment failures* (agent pursues wrong goal) and (2) *validity failures* (agent uses wrong method for right goal).

**Cascade defense mapping**: This is **Layer 2 (Detection)** — continuous monitoring of the agent's behavioral trajectory against expected patterns. The dual-objective framing maps directly to our two primary CIVC failure modes from H-093:

- **Alignment detection** → Comprehension Cascade (FM-1.x): Agent misunderstands the task context, leading to contextually misaligned actions. Trajectory Guard's alignment objective catches when the agent's action sequence diverges from task requirements.
- **Validity detection** → Tool Spiral (FM-2.x): Agent understands the goal but executes structurally incoherent steps. Trajectory Guard's validity objective catches when individual actions are malformed or inappropriate.

**H-093 CIVC connection**: DD-682's dual-objective architecture provides a concrete detection mechanism for the two CIVC failure modes — the "contextual" and "structural" dimensions that H-093 predicts are independently detectable. This is strong evidence for H-093's claim that CIVC has identifiable precursor signals.

### DD-683: SWE-PRM — Process Reward Models for Course Correction

**Key contribution**: Trains a process reward model (PRM) that scores individual agent steps in software engineering tasks, enabling mid-trajectory feedback. Crucially, develops an **inefficiency taxonomy** categorizing why agents fail.

**Cascade archetype mapping**: SWE-PRM's inefficiency taxonomy maps to our cascade archetypes from H-092:

| SWE-PRM Category | Our Cascade Archetype | FM Pattern |
|-------------------|-----------------------|------------|
| Redundant exploration | Drift-to-Decay | FM-1.3 (path guessing/looping) |
| Looping / repetition | Tool Spiral | FM-2.6 (reasoning-action mismatch) |
| Failure to terminate | Overconfident continuation | FM-3.3 (verification theater) |
| Wrong approach persistence | Stale Approach Fixation | FM-1.3 / FM-2.6 hybrid |

This independent taxonomy convergence is significant — researchers studying SWE-bench failures arrived at categories that closely parallel our empirically-derived cascade archetypes. This cross-validation strengthens confidence in H-092's failure mode taxonomy.

**Cascade defense mapping**: This is **Layer 3 (Intervention)** — once a failure pattern is detected (L2), the PRM provides the mechanism to intervene with corrective feedback rather than waiting for total failure.

### DD-684: AgentProcessBench — Step-Level Quality Metrics

**Key contribution**: Introduces a **ternary labeling scheme** for agent steps: Correct (advances task), Neutral (neither helps nor hurts), and Erroneous (actively harmful). This granularity enables evaluation of *process quality*, not just outcome.

**FM-3.3 verification spectrum connection**: DD-684's ternary scheme maps precisely to our FM-3.3 verification failure spectrum:

| DD-684 Label | FM-3.3 Mapping | Description |
|--------------|----------------|-------------|
| **Correct** | Genuine verification | Step provides real evidence of progress |
| **Neutral** | FM-3.3a (absence) | Step exists but provides no verification value — the agent simply didn't verify |
| **Erroneous** | FM-3.3b/c (theater/confabulation) | Step claims verification but is actually wrong — ranges from shallow theater (3.3b) to active fabrication (3.3c) |

The key insight: DD-684's neutral category validates our observation that *most* verification failures aren't active deception — they're *absence*. The agent simply skips verification, producing "neutral" steps where verification steps should be. Active theater (erroneous steps dressed as correct) is rarer but more dangerous.

**Cascade defense mapping**: This is **Layer 1 (Evaluation)** — providing the fundamental quality metrics that Layers 2 and 3 depend on. Without step-level quality labels, detection and intervention have no ground truth.

## The Complete Pipeline

Combining all three papers yields a coherent mid-trajectory failure management pipeline:

```
L1 Evaluation (DD-684)     L2 Detection (DD-682)     L3 Intervention (DD-683)
┌─────────────────┐       ┌──────────────────┐       ┌───────────────────┐
│ Step-level       │──────▶│ Trajectory        │──────▶│ Process reward     │
│ ternary quality  │       │ dual-objective    │       │ model feedback     │
│ assessment       │       │ anomaly detection │       │ + course correction│
│                  │       │                   │       │                    │
│ correct/neutral/ │       │ alignment +       │       │ taxonomy-guided    │
│ erroneous        │       │ validity checks   │       │ intervention       │
└─────────────────┘       └──────────────────┘       └───────────────────┘
```

1. **Evaluate** each step's quality (correct/neutral/erroneous) — DD-684
2. **Detect** when the trajectory shows anomalous patterns (alignment or validity) — DD-682
3. **Intervene** with targeted feedback based on the identified failure type — DD-683

This pipeline addresses a gap in our current cascade defense framework: we have strong post-hoc analysis (H-092 taxonomy) and preventive measures (verification protocols), but limited *real-time mid-trajectory* intervention capability.

## Connection to KE-089: Structural Competence Thesis

KE-089 argued that agent competence is structural and adaptive, not just about final outputs. These three papers operationalize that thesis:

- **Structural**: DD-684's step-level labeling evaluates structural quality of individual reasoning steps
- **Adaptive**: DD-683's PRM enables adaptive course correction during execution
- **Mid-trajectory**: DD-682's continuous monitoring provides the temporal dimension — catching failures as they develop, not after they've cascaded

## Predictions

**P-095a**: Combining trajectory monitoring (DD-682 style) with our FM taxonomy should yield detection accuracy >80% for cascade failures before step 10 of a session. Rationale: Our FM categories provide rich training signal; DD-682 shows dual-objective monitoring works.

**P-095b**: Neutral steps (DD-684's category) will cluster in the 3-5 steps *before* a cascade failure becomes visible. Rationale: Cascades begin with omission (neutral/absence of verification) before progressing to active errors.

**P-095c**: SWE-PRM-style process feedback will be more effective at preventing Tool Spirals than Comprehension Cascades. Rationale: Tool Spirals are structural/mechanical (amenable to step-level correction), while Comprehension Cascades involve deeper contextual misunderstanding that step-level feedback may not address.

**P-095d**: A combined detect-evaluate-intervene system should reduce cascade completion rate (failure reaching terminal state) by 40-60% compared to post-hoc-only approaches. Rationale: Early detection + targeted intervention interrupts the positive feedback loop that drives cascade escalation.

## Open Questions

1. **Calibration**: How do we calibrate DD-684's ternary labels for our specific agent system? Our FM taxonomy is richer than correct/neutral/erroneous — do we need a finer-grained scheme?
2. **Intervention timing**: DD-683 intervenes at every step. Is this too aggressive? Could frequent intervention itself cause a form of cascade (intervention-induced confusion)?
3. **False positives**: DD-682's dual-objective detection will have false positive trajectories flagged as anomalous. What's the cost of false-positive interventions vs. missed cascades?
4. **H-093 integration**: Can DD-682's trajectory features serve as the "precursor signals" that H-093 predicts exist for CIVC? This could be a direct experimental test.

## Suggested Experiments

- **EXP-103 (proposed)**: Apply DD-684's ternary labeling to our historical session logs and measure correlation between neutral-step clusters and subsequent cascade failures (tests P-095b)
- **EXP-104 (proposed)**: Implement a lightweight trajectory monitor inspired by DD-682 and measure detection latency for each FM category (tests P-095a)
