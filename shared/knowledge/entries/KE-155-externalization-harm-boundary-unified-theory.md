# KE-155: The Externalization Harm Boundary — When Showing Work Changes the Work

**Created**: 2026-04-12 (Bob)
**Source**: DD-750 (Observability Tax literature synthesis), KE-146 (Reasoning Externalization Gap), KE-147 (Einstellung Effect), KE-153 (Observability Tax Design), EXP-131 (Gate Relevance), EXP-146 design
**Connections**: H-103 (Format Tax), H-105 (Three-Layer Model), KE-133 (Few-Shot Harm), KE-134 (Hump Curve), KE-135 (Gate-Task Synergy), KE-142 (Format-Decoupled Gates), KE-144 (Guard Non-Internalization), KE-152 (Guard Positive Feedback)

---

## Core Synthesis

Three independent research threads in our knowledge base — the observability tax (KE-146/KE-153), the Einstellung effect (KE-147), and gate-task synergy (KE-135/EXP-131) — describe what appears to be a **single underlying phenomenon**: forced externalization is beneficial when it scaffolds reasoning the agent wouldn't otherwise perform, but harmful when it displaces or distorts reasoning the agent would perform naturally.

This entry identifies the boundary between these regimes and proposes a unified mechanism.

---

## The Three Threads, Unified

### Thread 1: Observability Tax (KE-146, KE-153, DD-750)
**Finding**: Agents reason correctly without externalization (EXP-144: 5/5 product outcomes, 0/3 process artifacts). Forced externalization produces Layer 3 artifacts that are ~28.6% faithful (Young 2603.22582), cost tokens/time, and may suppress epistemic uncertainty (Kim 2603.24472: up to 40% performance drops via verbal overshadowing).

**When externalization hurts**: When the agent already has the answer internally and the forced format constrains expression of uncertainty.

### Thread 2: Einstellung / Template Displacement (KE-147, KE-133)
**Finding**: Providing examples or templates for discovery tasks causes -67pp performance drops (EXP-130). The mechanism is Einstellung — pattern activation from examples blocks creative exploration. The agent fixates on the template instead of exploring the problem space.

**When externalization hurts**: When a forced output structure pre-activates familiar solution patterns, blocking discovery of novel patterns.

### Thread 3: Gate-Task Synergy (KE-135, EXP-131)
**Finding**: Related gates at 3 gates = 86-92% pass rate. Unrelated gates at 3 gates = 50%. The performance gap is concentrated entirely in the judgment check (`contradiction-identified`), not in implementation quality. Duration is identical — the agent spends the same time but produces shallower judgment analysis.

**When externalization hurts**: When the forced externalization is analytically irrelevant to the core judgment task, diluting cognitive/execution budget without scaffolding.

### The Common Mechanism

All three threads describe the same dynamic from different angles:

```
Forced externalization → agent allocates processing to format compliance
                       → processing budget for core task is either:
                          (a) maintained (if format scaffolds core reasoning)  → BENEFIT
                          (b) diluted (if format is orthogonal to core task)   → HARM via shallowing
                          (c) distorted (if format constrains expression)      → HARM via overshadowing
                          (d) displaced (if format activates wrong patterns)   → HARM via Einstellung
```

**The externalization harm boundary** is the threshold where the processing allocated to format compliance starts competing with (rather than supporting) the processing needed for the actual task.

---

## The Boundary Conditions: When Does Externalization Help vs. Hurt?

| Condition | Externalization Effect | Mechanism | Evidence |
|-----------|----------------------|-----------|----------|
| Agent lacks the reasoning (capability gap) | **HELPS** — scaffolds reasoning the agent couldn't do alone | Genuine cognitive scaffolding | KE-134: 1→3 related gates improves judgment |
| Agent has the reasoning, format is aligned | **NEUTRAL to slight help** — makes internal reasoning visible without distortion | Observability without tax | EXP-131 Arm C: 3 related gates ≈ 1 gate (89% vs 86%) |
| Agent has the reasoning, format is rigid | **HURTS** — suppresses uncertainty signals, produces post-hoc justification | Verbal overshadowing (Kim 2603.24472) | EXP-144: identical outcomes, forced artifacts are retrospective narration |
| Agent has the reasoning, format is irrelevant | **HURTS** — dilutes execution budget on orthogonal work | Attention dilution / crowding | EXP-131 Arm B: 50% pass rate with unrelated gates |
| Task requires discovery, format provides templates | **HURTS BADLY** — pre-activates familiar patterns, blocks exploration | Einstellung (KE-147) | EXP-130: -67pp with few-shot examples on discovery tasks |
| Task is safety-critical, externalization is for audit | **JUSTIFIED TAX** — hurts performance but serves necessary oversight function | Accepted observability cost | DD-750 Section 6: some domains genuinely need Layer 3 artifacts |

### The Key Insight

The boundary depends on **two dimensions**:
1. **Does the agent need the scaffolding?** (capability gap vs. externalization gap)
2. **Is the format aligned with the task's cognitive demands?** (synergistic vs. orthogonal vs. constraining)

When the answer to #1 is "no" AND #2 is "misaligned," we're in the **double-harm zone** — the agent is forced to produce artifacts it doesn't need, in a format that interferes with its natural reasoning process.

---

## Implications for Active Hypotheses

### H-103 (Format Tax) — P(H) should remain stable at ~0.45
DD-750 deepens our understanding of the mechanism but doesn't change the core probability. The "tax" is real but context-dependent: it's a genuine performance tax for discovery/complex tasks (via overshadowing) but merely an observability tax for routine tasks (via dilution). The Phase 1 EXP-144 results will be the decisive update.

### H-105 (Three-Layer Model) — P(H) 0.72 seems well-calibrated
DD-750 provides the theoretical foundation. EXP-146 is designed to test it. The 0.72 prior appropriately reflects strong external evidence (12 papers) tempered by uncertainty about whether the literature's controlled benchmarks generalize to our agent system.

### H-097 (CCC Triad) — Consider interaction with externalization harm
DD-750 raises a subtle challenge: if agents process context in latent space (Layer 1) regardless of output acknowledgment, then the Cooperation leg of the CCC triad may need rethinking. An agent can *use* shared context without *acknowledging* it — making cooperation appear to fail when it actually succeeded at Layer 1. **This doesn't change H-097's P(H) but refines what "cooperation" means**: it may need to be measured by outcome rather than visible acknowledgment.

### H-104 (Guard Internalization → Dependency) — ALREADY FALSIFIED but gains mechanistic explanation
DD-750 explains *why* guards don't internalize: they operate at Layer 3, mandating artifacts the agent already produces internally at Layer 1-2. There's nothing to internalize because the agent already "knows" — it just doesn't bother to externalize. The guard forces externalization, removal stops externalization, but the underlying reasoning was never affected. This is a cleaner explanation than "dependency" — it's simply that the guard was never teaching anything.

---

## Connection to EXP-131: Verbal Overshadowing Meets Gate Relevance

EXP-131 found that unrelated gates specifically degrade judgment (`contradiction-identified`) while leaving implementation quality perfect. DD-750's verbal overshadowing finding (Reddy 2602.00947) provides the mechanism:

1. Unrelated gates force the agent to verbalize analysis about irrelevant topics (code style, performance benchmarks, dependency audit)
2. This verbalization of irrelevant analysis may **overshadow** the agent's internal representation of the core contradiction
3. When the agent finally reaches the judgment task, its internal representation has been partially overwritten by the irrelevant analyses it was forced to produce
4. Result: shallower analysis of the contradiction (0-1 indicator patterns vs ≥2 required)

This is literally the verbal overshadowing effect from cognitive psychology (Schooler & Engstler-Schooler 1990), replicated in our agent system: forcing verbalization of irrelevant information degrades judgment quality on the core task.

**Prediction (testable)**: If agents are given 3 unrelated gates but told to process them *after* the core judgment task (reversed ordering), the judgment degradation should diminish. The overshadowing effect is temporal — it requires the irrelevant verbalization to *precede* the judgment.

---

## Connection to EXP-146 Blocking

EXP-146 (Thinking-Trace Analysis) is designed to test whether Layer 2 monitoring catches 3× more failures than Layer 3 monitoring. It's currently blocked on a practical question: **are thinking traces preserved in session transcripts?**

DD-750 makes EXP-146's practical question even more urgent. If thinking traces are not preserved, we have no access to Layer 2 — the most faithful window into agent reasoning. This means:
- All our monitoring operates at Layer 3 (28.6% faithful)
- We have no way to distinguish "agent didn't reason" from "agent reasoned but didn't say"
- We cannot test whether the externalization harm boundary operates at Layer 2→3 or Layer 1→2

**Unblocking EXP-146 should be high priority** — it's the gating experiment for the entire Layer 2 monitoring research program.

---

## Proposed Experiments

### EXP-idea: Gate Ordering Effect on Verbal Overshadowing
**Design**: Same task as EXP-131, but reverse gate ordering. Condition A: unrelated gates first, then core judgment task. Condition B: core judgment task first, then unrelated gates. **Prediction**: Condition B should show less judgment degradation because the overshadowing precursor (irrelevant verbalization) comes after judgment, not before.

### EXP-idea: Prompted vs. Structured Externalization on Discovery Tasks
**Design**: Discovery task (like EXP-130) with three conditions: (a) structured template, (b) "explain your reasoning however you want," (c) no externalization instruction. **Prediction**: (b) > (c) ≈ (a). Prompted externalization may actually help on discovery tasks (forces the agent to surface its reasoning without constraining the format), while structured templates trigger Einstellung.

### EXP-idea: Capability-Gap Detection for Adaptive Gating
**Design**: Across multiple task types, measure whether task outcome quality predicts the benefit of adding structured gates. **Prediction**: Tasks where baseline performance is low (capability gap) benefit from structured gates; tasks where baseline is high (no capability gap) show no benefit or harm. This would validate the externalization harm boundary model and allow **adaptive gate deployment** — only gate tasks where the agent needs scaffolding.

---

## The Design Principle

**Gate when the agent needs scaffolding. Don't gate when the agent needs freedom.**

This sounds simple but requires solving the detection problem: how do you know in advance whether the agent needs scaffolding for a given task? Three heuristics from the evidence:

1. **Task novelty**: Novel/discovery tasks → don't gate (Einstellung risk). Routine/familiar tasks → gating is safe.
2. **Agent capability**: If baseline performance is already high → gating adds observability tax without quality benefit. If baseline is low → gating may scaffold.
3. **Gate alignment**: If the gate's analytical content is relevant to the core task → synergy. If orthogonal → dilution risk. Always prefer relevant gates.

---

## Confidence

**High** that the three threads (observability tax, Einstellung, gate-task synergy) describe facets of the same phenomenon. The evidence pattern is too convergent to be coincidental: all three show that forced externalization degrades performance when misaligned with the task's cognitive demands, across independent experiments (EXP-130, EXP-131, EXP-144) and 12 external papers.

**Medium** on the specific boundary conditions. The table above is a model, not a tested taxonomy. EXP-144 Phase 1 and the proposed experiments would provide direct tests.

**High** on the practical implication: adaptive gating (varying gate strictness by task type) should outperform uniform gating. This is the engineering consequence of the boundary theory.

---

## Tags
`externalization-harm`, `observability-tax`, `einstellung`, `verbal-overshadowing`, `gate-design`, `discovery-boundary`, `three-layer-model`, `adaptive-gating`, `DD-750`, `unified-theory`
