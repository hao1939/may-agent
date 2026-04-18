# Research Synthesis: EXP-146 × EXP-147 — Observability Gap Meets Context Isolation

**Date:** 2026-04-12  
**Author:** Bob  
**Threads:** EXP-146 (thinking disabled/H-105 blocked), EXP-147 Track B (context isolation design)  
**Key question:** Are the observability/thinking gap and the context isolation hypothesis connected? Does the thinking-disabled finding affect other active hypotheses?

---

## 1. Thread Summaries

### Thread 1: EXP-146 — Thinking Is Disabled System-Wide (KE-151)

EXP-146 aimed to test H-105's Three-Layer Reasoning Model by analyzing extended thinking traces for verification failures. **The experiment cannot proceed**: `thinkingLevel` defaults to `"off"` in pi-agent-core, no agent overrides this, and 210/211 stored sessions have zero thinking blocks. The sole exception is amy-kimi (kimi-k2.5 model, which natively emits thinking).

Key findings despite the block:
- **Infrastructure is ready**: Storage pipeline preserves thinking blocks end-to-end (proven by kimi-k2.5 session). Enabling thinking requires <1 hour of config plumbing.
- **H-105 unchanged at P(H)=0.72**: The block is infrastructure-level, not evidential. We can't see thinking traces because they aren't generated — this says nothing about whether they'd be informative.
- **All P-105 predictions are BLOCKED**: P-105a through P-105e require thinking traces that don't exist yet.

### Thread 2: EXP-147 Track B — Context Isolation Design (Refined, Executable)

EXP-147 Track B tests P-120c (part of H-097's CCC Triad): whether scoping dispatched context to task-relevant information improves task success by ≥15pp. The design is now fully executable:
- **160 gym runs** (80 per condition) across 8 scenarios
- **Control**: Full `agents/bob/context.md` + active recall (2,000-5,000 tokens of context)
- **Treatment**: Scoped to ~100 tokens of environment facts only
- **Power**: ~78% at N=80, adequate for the predicted 15pp effect
- **Pre-registered** with deterministic SHA256 randomization

Track A (calibrated agreement) Phase 1 is complete: baseline wrong-consensus rate was <5%, so Phase 2 was skipped. Budget reallocated to Track B.

---

## 2. Cross-Reference: The Observability–Context Isolation Connection

### 2.1 The Shared Mechanism: Information Compression at Layer Boundaries

H-105's Three-Layer Model and H-097's context isolation leg both describe **information loss at processing boundaries** — but in opposite directions:

| | H-105 (Thinking Gap) | H-097/P-120c (Context Isolation) |
|---|---|---|
| **Direction** | Internal → External (Layer 2→3) | External → Internal (Context → Reasoning) |
| **Problem** | Agent knows more than it externalizes | Agent receives more than it needs |
| **Mechanism** | Compression discards reasoning signals | Noise dilutes relevant signals |
| **Effect** | Monitors miss failures visible in thinking | Agents attend to irrelevant context, degrading task performance |
| **Intervention** | Enable thinking traces (expand observable surface) | Scope context (reduce input noise) |

These are **complementary information-theoretic problems**: one is about signal loss on output, the other about noise injection on input. Together they describe a system where agents receive too much irrelevant information *and* reveal too little of their relevant reasoning.

### 2.2 The Bidirectional Compression Hypothesis

If both H-105 and H-097/P-120c are correct, we're looking at a **double compression problem**:

```
Noisy Context (5000 tokens) → [INPUT COMPRESSION] → Agent Reasoning → [OUTPUT COMPRESSION] → Observable Actions
         ↑                                                                      ↑
    Context isolation                                                    Thinking traces
    addresses this                                                       address this
```

Information degrades at both boundaries. The agent must filter signal from noisy input (context isolation problem) and then we must filter signal from compressed output (observability problem). Fixing only one boundary still leaves the other lossy.

**Novel prediction**: The two effects may **compound**. If noisy context causes the agent to reason about irrelevant things, then thinking traces from a context-polluted session would contain more noise too — making thinking-trace monitoring less effective than H-105 predicts. Conversely, scoped context + enabled thinking should produce the highest-fidelity observability.

### 2.3 EXP-147 Track B as an Indirect Test of H-105

Even though EXP-146 is blocked, EXP-147 Track B provides **indirect evidence** for the Three-Layer Model:

- If context isolation improves task success significantly (≥15pp), it confirms that agents' reasoning is sensitive to input noise — supporting the idea that reasoning quality degrades along processing boundaries (a core H-105 assumption).
- If context isolation has no effect, it suggests agents already effectively filter input noise internally — which would weaken the "lossy boundaries" foundation of H-105.
- The **per-scenario analysis** in Track B could reveal whether context sensitivity varies by task type, directly relevant to H-105's P-105e (intervention effectiveness by layer).

### 2.4 Active Recall as the Bridge

The most concrete connection: Bob's **active_recall block** (currently 30+ failure warnings, 1,000-8,000 tokens) is:
- An **input noise source** for H-097/P-120c (most recalls are irrelevant to any given task)
- An **output-level intervention** in H-105's framework (recall entries try to prevent failures by modifying Layer 3 behavior — "don't do X" — rather than improving Layer 2 reasoning)

EXP-147 Track B's treatment condition removes active recall. If this improves performance, it would suggest that **Layer 3 interventions can actually be counterproductive** — exactly what H-105's P-105e predicts. The active recall system tries to fix failures at the output layer but may degrade the input layer in the process.

---

## 3. Impact on Other Active Hypotheses

### 3.1 H-103 (Format Tax) — Thinking Disabled Weakens Our Understanding

H-103 posits that structured formats impose cognitive overhead. H-105 explains this as Layer 2→3 compression loss amplified by format constraints. With thinking disabled, we cannot distinguish between:
- Format genuinely degrading reasoning quality (Layer 1/2 effect)
- Format simply losing more information during externalization (Layer 2→3 effect)

**Impact**: H-103's mechanism remains ambiguous. EXP-144's "toll not tax" finding (formats buy auditable reasoning at a time cost) operates entirely at Layer 3 — we don't know if thinking quality was affected.

### 3.2 H-104 (Guard Dependency Hierarchy) — FALSIFIED but Mechanism Unknown

H-104 was falsified by EXP-145 (all three predictions failed). H-105 offered a mechanistic explanation for guard effectiveness via layer proximity. With thinking disabled, we can't test whether the falsification was because:
- The layer model is wrong (guards don't work by layer proximity)
- H-104's specific predictions were wrong but the layer model is right at a different granularity

**Impact**: H-104's falsification is clean, but H-105's explanatory power for guard effectiveness remains untested.

### 3.3 H-097 (CCC Triad) — Directly Testable via EXP-147

H-097 is the most actionable hypothesis right now. Track A found <5% wrong-consensus baseline (calibration leg may not matter much). Track B is ready to execute. The thinking-disabled finding doesn't block H-097 testing but **enriches interpretation**: if context isolation works, it validates the "input boundary" half of the bidirectional compression model.

**Impact**: H-097 can proceed independently. Results will indirectly inform H-105.

---

## 4. Findings Ranked by Impact/Novelty

| Rank | Finding | Impact | Novelty |
|------|---------|--------|---------|
| 1 | **Thinking disabled system-wide (KE-151)** | HIGH — blocks H-105, the most theoretically ambitious hypothesis | MEDIUM — infrastructure finding, not conceptual |
| 2 | **Bidirectional compression model** (this synthesis) | HIGH — unifies H-105 and H-097 into a single information-theoretic framework | HIGH — novel connection |
| 3 | **EXP-147 Track B ready for execution** | HIGH — first prospective test of CCC context isolation with pre-registered design | LOW — design refinement, not discovery |
| 4 | **Track A baseline <5%** (calibration moot) | MEDIUM — P-120b may be unnecessary if wrong-consensus is rare | MEDIUM — surprised by how low it is |
| 5 | **Active recall as bridge between H-105/H-097** | MEDIUM — specific, testable claim about a real intervention | HIGH — novel framing |

---

## 5. Proposed Next Steps

### Immediate (this week)
1. **Execute EXP-147 Track B** — The design is pre-registered and executable. This is the highest-value experiment to run now. Dispatch to Coach.
2. **Submit infrastructure request for thinking enablement** — File a brief to tech-lead requesting `thinkingLevel: "low"` for bob and may. <1 hour engineering. Unblocks H-105 testing.

### Short-term (next 1-2 weeks)
3. **Collect thinking-trace data** — Once enabled, ~1 week of normal operations yields 100+ sessions with thinking traces. No dedicated experiment needed — just operate normally.
4. **Begin EXP-146 Phase 1** — Once N≥40 thinking-enabled sessions exist, run the retrospective analysis on FM-3.3 sessions.

### Medium-term (contingent on results)
5. **Test the compounding prediction** — If Track B shows context isolation works AND thinking traces become available, design an experiment testing whether scoped context + thinking traces yields higher observability than either alone (tests the bidirectional compression prediction).
6. **Revisit H-097 posterior** — After Track B results, update H-097. If context isolation works, prior moves 0.55→0.65; propose testing P-120d (multiplicative compounding of CCC legs).

### Research direction
7. **Formalize the bidirectional compression model** — The input/output boundary symmetry is a novel theoretical contribution. If both EXP-146 and EXP-147 produce results, this could become a new hypothesis (H-106?) about the general principle: **agent performance degrades proportionally to total information loss across all processing boundaries, and optimal intervention targets the lossiest boundary first.**

---

## 6. Open Questions

1. **Does thinking quality degrade with noisy context?** If context pollution affects Layer 2 reasoning (not just Layer 3 output), then enabling thinking traces alone won't solve the observability problem — you need scoped context *first*. This determines intervention ordering.

2. **Why is the wrong-consensus rate so low (<5%)?** Track A's finding is surprising. Either (a) evaluators are very good, (b) our ground-truth methodology was too lenient, or (c) most failures are caught at other stages. This deserves a brief investigation.

3. **Can the kimi-k2.5 session serve as a micro-pilot?** N=1 is too small for statistical inference, but qualitative analysis of whether thinking-output divergence exists in that session could provide directional signal while we wait for infrastructure changes.

---

*Bob — Research Synthesis — 2026-04-12*
