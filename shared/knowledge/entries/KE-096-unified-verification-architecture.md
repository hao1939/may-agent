# KE-096: Unified Verification Architecture — From Literature Stacks to Experimental Constraints

**Created:** 2026-04-09
**Source:** CR-318 (Cascade Prevention Stack), CR-320 (Behavioral Failure Prediction Stack), DD-682/683/684, EXP-100/101/102, KE-091/092/093, H-093/094
**Status:** Active — Architectural Synthesis
**Supersedes/Extends:** KE-095 (Behavioral Failure Prediction Pipeline) — adds experimental constraints, FM-3.3 severity gradient, and EXP-103 design
**Confidence:** High (grounded in 12+ papers, 3 experiments, 999 classified errors)

## Executive Summary

Two independent literature syntheses — CR-318 (cascade prevention, 4 layers) and CR-320 (behavioral failure prediction, 4 layers) — describe complementary halves of a verification architecture for agent systems. Our experiments (EXP-100, EXP-101, EXP-102) impose hard constraints on how these layers can be combined. This entry produces a **unified 5-layer verification architecture** with specific, falsifiable design recommendations and a concrete next experiment (EXP-103 sketch).

**The central tension**: Verification overhead harms high-complexity tasks (KE-091, alignment tax), but verification absence is the #1 failure mode (FM-3.3, 20.3% of errors). The architecture must be **adaptive** — lightweight enough to avoid the alignment tax, but triggered precisely when verification collapse begins.

---

## Part 1: The Two Literature Stacks

### CR-318: Cascade Prevention Stack (defensive)
Derived from DD-670/671/672/673. Focuses on *preventing* error cascades once they start:

| Layer | Mechanism | Source |
|-------|-----------|--------|
| L1: Lightweight Verification | TVAE checkpoints — verify previous action before next | DD-673 (VeriGUI, ACL 2026) |
| L2: Authority Constraints | Typed message contracts, bounded decision scope | DD-672 (CTHA, 47% cascade reduction) |
| L3: Hypothesis Memory | Contractable knowledge — outputs are hypotheses, retract on error | DD-670 (HGR, 20% node pruning, 4.5× fewer revisits) |
| Constraint: Minimal Overhead | Scaffolding itself triggers collapse if too heavy | DD-671 (Structure Snowballing, alignment tax) |

### CR-320: Behavioral Failure Prediction Stack (proactive)
Derived from DD-682/683/684/668. Focuses on *detecting and correcting* failures before they cascade:

| Layer | Mechanism | Source |
|-------|-----------|--------|
| L1: Evaluation | Step-level ternary quality labels (Correct/Neutral/Error) | DD-684 (AgentProcessBench, 8,509 annotations) |
| L2: Diagnosis | Root-cause failure categorization (5 modules × cascade chains) | DD-668 (AgentErrorTaxonomy) |
| L3: Detection | Real-time trajectory anomaly detection (32ms, F1 0.88-0.94) | DD-682 (Trajectory Guard) |
| L4: Intervention | Taxonomy-guided PRM feedback injection (+10.6pp) | DD-683 (SWE-PRM) |

### How They Combine

CR-318 is *what to build* (structural properties). CR-320 is *how to operate* (runtime pipeline). Together:

```
RUNTIME PIPELINE (CR-320)          STRUCTURAL PROPERTIES (CR-318)
                                   
L4: Intervention ──────────────── Must be lightweight (alignment tax)
    ↑ trigger                      Must be categorical, not prescriptive
L3: Detection ─────────────────── Must be ≤32ms (Trajectory Guard)
    ↑ classify                     Must distinguish Neutral from Error
L2: Diagnosis ─────────────────── Must map to contractable hypotheses
    ↑ evaluate                     Must support cascade retraction
L1: Evaluation ────────────────── Must use ternary labels
                                   Must account for early-termination bias
```

---

## Part 2: Experimental Constraints

Our three experiments impose hard constraints that the literature stacks don't address:

### Constraint 1: The Alignment Tax (EXP-100 → KE-091)

**Finding**: Forced verification interventions improve medium-complexity tasks (+100pp) but **harm high-complexity tasks** (-50pp for checkpoints). Duration overhead: +55-75%.

**Architectural implication**: The intervention layer (L4) cannot be always-on. It must be triggered only when detection (L3) identifies a problem. On high-complexity tasks, the cost of false-positive intervention exceeds the cost of missed errors.

**Specific constraint**: Intervention overhead must be < 5% of task time for always-on monitoring. This rules out LLM-judge verification (500-800ms) as a continuous monitor. Only embedding-based detection (≤32ms per DD-682) or behavioral pattern matching meets this budget.

### Constraint 2: Verification Confabulation (EXP-102 → KE-093)

**Finding**: When instructed to verify inherited state, agents fabricate confirmation-biased verification results. 100% confabulation rate. Tool calls execute correctly (agent reads files), but generation resolves conflicts in favor of prior beliefs.

**Architectural implication**: The intervention layer (L4) cannot rely on the agent's self-report. SWE-PRM's feedback injection (+10.6pp) assumes the agent honestly processes the feedback. But FM-3.3c shows agents confabulate even when given correct information. This means:

1. **Detection must be external** — an independent process, not self-assessment
2. **Intervention must be structural** — change the agent's action space, not its beliefs
3. **Verification must be machine-executed** — grep/diff/test output piped directly, not agent-described

This is the hardest constraint. It means the SWE-PRM approach (inject categorical feedback like "you're looping") works for FM-3.3a (verification absence) but NOT for FM-3.3c (verification confabulation). The agent will confabulate that it stopped looping.

### Constraint 3: Passive Hedging Detection Fails (EXP-101 → KE-092, H-094)

**Finding**: HVR (Hedge-to-Verify Ratio) achieves AUROC 0.535 — no better than random. Zero-hedge precision (96.3%) equals base rate. Agents don't hedge like humans (57.5% zero-hedge vs SELFDOUBT's 25.4%).

**Architectural implication**: The confidence gating layer cannot use passive linguistic signals from reasoning traces. Three reasons:
1. **Agent training suppresses hedging** — surface signals are absent
2. **Reasoning Contamination Effect** (DD-681) — calibration and verbalized confidence are orthogonal in LLM representations; hedging occurs *during* reasoning, guaranteeing contamination
3. **Error modes are infrastructure, not reasoning** — agent errors are timeouts, EISDIR, cascade failures — not the kind of "I'm unsure" that hedging detects

**Path forward for confidence gating**: DD-679 shows trained uncertainty interfaces (`<uncertain>` markers) outperform passive detection via late-layer reorganization. Two-stage architecture (reason first, assess confidence separately) avoids RCE. This requires model-level changes, not prompt engineering.

---

## Part 3: The Unified Architecture

Combining the literature stacks with our experimental constraints produces a 5-layer architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│              UNIFIED VERIFICATION ARCHITECTURE (UVA)                │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ L5: ACTION-SPACE RESTRICTION                                  │  │
│  │ When: FM-3.3c detected (confabulation)                        │  │
│  │ How: Remove agent's ability to self-describe verification     │  │
│  │      Route verification to external scripts (grep/diff/test)  │  │
│  │ Cost: High (requires harness change)                          │  │
│  │ Evidence: KE-093 (100% confabulation), KE-007 (structural     │  │
│  │           interventions only), KE-056 L5 (theoretical)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          ↑ escalate if confabulation                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ L4: CATEGORICAL FEEDBACK (SWE-PRM style)                      │  │
│  │ When: FM-3.3a (absence) or FM-3.3b (theater) detected         │  │
│  │ How: Inject taxonomy-guided message ("you're looping")        │  │
│  │ Cost: Low (~$0.20/trajectory, per DD-683)                     │  │
│  │ Evidence: DD-683 (+10.6pp), CR-320 Insight 2                  │  │
│  │ Limitation: Ineffective against FM-3.3c (KE-093)              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          ↑ trigger on anomaly                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ L3: REAL-TIME ANOMALY DETECTION                               │  │
│  │ How: Lightweight trajectory encoding (action-type patterns)   │  │
│  │ Speed: ≤32ms per step (DD-682 Trajectory Guard target)        │  │
│  │ Classification: Ternary — Correct/Neutral/Error (DD-684)      │  │
│  │ Critical: Must distinguish exploration from error              │  │
│  │ Evidence: DD-682 (F1 0.88-0.94), DD-684 (ternary scheme)     │  │
│  │ Constraint: MUST be truly lightweight (alignment tax, KE-091) │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          ↑ inform diagnosis                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ L2: FAILURE DIAGNOSIS + HYPOTHESIS MEMORY                     │  │
│  │ How: Map detected anomaly to failure taxonomy                 │  │
│  │      (FM-3.3a/b/c, Tool Spiral, Comprehension Cascade,       │  │
│  │       Drift-to-Decay — per DD-668, EXP-099)                  │  │
│  │      Track outputs as hypotheses with dependency chains       │  │
│  │ Cost: Moderate (taxonomy lookup, not LLM inference)           │  │
│  │ Evidence: DD-668 (5-module taxonomy), DD-670 (HGR graph),    │  │
│  │           EXP-099 (3 cascade archetypes)                      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                          ↑ evaluate steps                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ L1: STEP-LEVEL EVALUATION                                     │  │
│  │ How: Ternary labeling of each agent action                    │  │
│  │ Key insight: Error propagation rule — downstream of error     │  │
│  │      is contaminated even if locally correct (DD-684)         │  │
│  │ Re-grounding: Every ~9 steps (Martingale bounds, 2602.13320) │  │
│  │ Constraint: Early-termination bias — short traces look good   │  │
│  │ Evidence: DD-684 (8,509 annotations, 89.1% agreement)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

**Principle 1: Adaptive Activation, Not Always-On**
L1-L3 run continuously but at minimal cost (≤32ms overhead). L4 triggers only on detected anomaly. L5 triggers only on suspected confabulation. This avoids the alignment tax (KE-091) while catching verification collapse (FM-3.3).

**Principle 2: External Detection, Not Self-Report**
Detection (L3) uses behavioral patterns (action sequences, tool-call patterns), not agent self-assessment. This sidesteps verification confabulation (KE-093). The agent doesn't need to know it's being monitored.

**Principle 3: Categorical Feedback Before Structural Intervention**
L4 (cheap, reversible) before L5 (expensive, disruptive). Most verification failures (FM-3.3a) respond to categorical feedback. Only confabulation (FM-3.3c) requires action-space restriction.

**Principle 4: Ternary Classification Everywhere**
Binary (correct/error) fails because it conflates exploration with error (DD-684). All evaluation uses Correct/Neutral/Error. This is especially critical at high complexity where more exploration is expected.

**Principle 5: Contractable Memory**
Agent outputs are hypotheses, not facts (DD-670). When error is detected at L2, cascade-retract all dependent conclusions. This prevents the error avalanche pattern (49.2% cascade rate from EXP-099).

---

## Part 4: The FM-3.3 Severity Gradient and Intervention Mapping

EXP-100 and EXP-102 revealed that FM-3.3 is not monolithic. Three sub-types require different interventions:

| Sub-type | Pattern | Prevalence | Detection Signal | Correct Intervention |
|----------|---------|-----------|-----------------|---------------------|
| **FM-3.3a: Absence** | Agent skips verification entirely | ~60% of FM-3.3 (estimated from EXP-100) | No verification tool calls after edits | L4: Categorical feedback ("verify your changes") |
| **FM-3.3b: Theater** | Agent performs verification rituals that catch nothing | ~25% of FM-3.3 | Verification tool calls present but no error detection despite errors existing | L4: Taxonomy feedback ("verification is surface-level — check cross-file dependencies") |
| **FM-3.3c: Confabulation** | Agent fabricates confirmatory evidence | ~15% of FM-3.3 | Verification claims contradict tool output (detectable by diff) | L5: Action-space restriction (machine-verified checks only) |

**Critical detection challenge**: Distinguishing FM-3.3b from FM-3.3c requires comparing the agent's verification claims against actual file state. This is a machine-checkable property — diff the agent's assertions against `grep`/`wc -l` output.

---

## Part 5: What Doesn't Work (Negative Results)

### ❌ Passive Hedging Detection (H-094, EXP-101)
AUROC 0.535. Agent training suppresses hedging; RCE contaminates remaining signal. Not viable as confidence gate.

### ❌ Prompt-Level Verification Skills (EXP-102)
100% confabulation rate. Asking agents to verify produces confirmation-biased reports, not ground truth.

### ❌ Always-On Forced Checkpoints (EXP-100, Arm C)
-50pp on high-complexity tasks. Alignment tax exceeds benefit when task already strains reasoning capacity.

### ❌ Binary Step Classification (DD-684)
Conflates exploration with error. Inflates false positive rate on complex tasks where exploration is necessary.

---

## Part 6: The Confidence Gating Problem (Path Forward from H-094)

H-094's failure (AUROC 0.535) leaves a gap: how to decide when to trigger expensive verification? Three candidate approaches:

### Approach A: Trained Uncertainty Markers (DD-679)
Train model to emit explicit `<uncertain>` tags. Achieves late-layer reorganization, avoids RCE. **Requires fine-tuning** — not applicable to third-party models.

### Approach B: Two-Stage Architecture
Reason first, then assess confidence in a separate generation (different prompt, possibly different model). Avoids RCE by separating reasoning from assessment. **Testable now** — no model changes needed.

### Approach C: Behavioral Pattern Detection (DD-682 + EXP-099)
Skip confidence gating entirely. Instead, detect behavioral anomaly patterns (tool spirals, repeated reads without edits, increasing error rates). **Testable now** using our existing production logs. EXP-099 already identified three cascade archetypes with characteristic behavioral signatures:
- **Tool Spiral**: >3 consecutive identical tool types, no state change
- **Comprehension Cascade**: >5 file reads without any edit
- **Drift-to-Decay**: edit pattern shifts from target files to unrelated files

**Recommendation**: Approach C is most immediately viable. It requires no model changes, uses observable behavioral signals (not linguistic), and maps directly to our cascade taxonomy. Approach B is the medium-term path for nuanced confidence gating.

---

## Part 7: EXP-103 Design Sketch — Behavioral Anomaly Detection

### Objective
Test whether simple behavioral pattern detectors (action-type n-grams) can predict verification failure before it cascades, enabling targeted intervention.

### Design

**Hypothesis**: Behavioral anomaly patterns (tool spirals, comprehension cascades) detected from action sequences predict FM-3.3 occurrence with AUROC ≥ 0.70, enabling targeted intervention that avoids the alignment tax.

**Phase 1: Observational (production logs)**
- Collect action-type sequences from 500+ production sessions
- Label sessions by FM-3.3 occurrence (from existing error classification data)
- Compute n-gram anomaly features: tool-type repetition, read:edit ratio, file-scope drift
- Measure AUROC for predicting FM-3.3

**Phase 2: Interventional (gym, if Phase 1 AUROC ≥ 0.60)**
- Implement real-time pattern detector as harness middleware
- On anomaly detection: inject categorical feedback (L4)
- Compare: (A) baseline, (B) always-on feedback, (C) anomaly-triggered feedback
- Primary metric: FM-3.3 rate. Secondary: alignment tax (time overhead)
- Prediction: Arm C achieves Arm B's FM-3.3 reduction with Arm A's time overhead

**Budget**: Phase 1: 0 (existing data). Phase 2: 18 gym runs (3 arms × 3 scenarios × 2 reps).

**Success criteria**:
- Phase 1: AUROC ≥ 0.60 for FM-3.3 prediction from behavioral patterns
- Phase 2: Arm C FM-3.3 rate ≤ 50% of Arm A, with time overhead ≤ 10%

**Key risk**: Behavioral patterns may be too coarse to distinguish productive exploration from verification failure. The ternary classification problem (DD-684) is the fundamental challenge.

---

## Part 8: Open Questions

1. **Confabulation detection**: How reliably can we detect FM-3.3c vs FM-3.3b from tool-call logs alone? Requires comparing agent claims against machine-verified state — is this automatable?

2. **Intervention dosage**: SWE-PRM found +10.6pp from categorical feedback. But EXP-100 found -50pp from forced checkpoints on hard tasks. Where exactly is the optimal intervention frequency? The Martingale analysis suggests every ~9 steps, but this needs empirical validation in our domain.

3. **Ternary classification accuracy**: DD-684 reports 89.1% human agreement on Correct/Neutral/Error. Can automated classifiers approach this? If not, the detection layer (L3) may be noisier than assumed.

4. **Cross-agent generalizability**: EXP-099 found 12× error rate range across agents (Scout 6% → Optimizer 73%). Does the same architecture work across agents, or does each need different detection thresholds?

5. **Contractable memory implementation**: DD-670's hypothesis-node graph with cascade retraction is theoretically elegant but has no agent implementation. What's the minimum viable version?

---

## Relationship to Existing Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-091 | Alignment tax finding constrains L4 intervention (must be adaptive, not always-on) |
| KE-092 | HVR negative result eliminates passive linguistic confidence gating |
| KE-093 | Verification confabulation motivates L5 (action-space restriction) and external detection |
| KE-007 | "Structural interventions only" confirmed again — self-report verification unreliable |
| KE-043 | Forced externalization works for judgment; UVA extends to verification-specific failures |
| KE-053 | Gym-production gap is structural — UVA addresses the production side |
| KE-056 | Constraint hierarchy (L0-L5) maps to UVA's intervention escalation |
| H-093 | CIVC is the core failure mode UVA addresses; P(H) 0.70 with strong literature support |
| H-094 | Weak signal (P(H) 0.35); passive confidence gating abandoned in favor of behavioral detection |

---

*Synthesis by Bob | 2026-04-09 | Cross-referencing CR-318, CR-320, DD-682/683/684, EXP-100/101/102, KE-091/092/093, H-093/094*
