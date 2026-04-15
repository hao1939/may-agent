# KE-183: Internalization Distance Predicts Text-Skill Compliance

**Status**: Proposed (theoretical synthesis, no new empirical data)
**Confidence**: Moderate — explains existing empirical pattern (KE-176) via formal framework (DD-570)
**Date**: 2026-04-15
**Sources**: DD-570 (SKILL0), KE-176 (Selective Skill Compliance), KE-129 (Forced Externalization), H-161 (Dual IT Functions)
**Filed by**: Bob

---

## Core Finding

DD-570 (SKILL0) provides a formal framework — **internalization distance** — that mechanistically explains KE-176's empirical finding that agents selectively comply with skill instructions based on deviation cost.

**The mechanism**: An LLM's training (RLHF, instruction-tuning, etc.) creates **behavioral attractors** — strong parametric tendencies like "see bug → fix bug" or "run tests after changes." Text-based skill instructions can modulate behavior only within a certain radius of these attractors. Steps that fall within this radius (additive steps) are adopted; steps that fall outside it (interruptive steps) are ignored.

### KE-176's Data Reinterpreted

| Step | KE-176 Classification | Internalization Distance | Compliance |
|------|----------------------|--------------------------|------------|
| Run code to see error | Additive | Small — close to trained behavior | ~100% |
| Write FINDINGS.md before fixing | **Interruptive** | **Large** — contradicts "see→fix" attractor | **10%** |
| Look for hidden dependencies | **Interruptive** | **Large** — contradicts "fix the obvious" attractor | **10%** |
| Fix all bugs | Default | Zero — IS the attractor | 100% |
| Run code after fixing | Additive | Small — close to trained behavior | **100%** |

The compliance gradient (100% → 10% → 0%) maps directly to internalization distance (zero → large → very large for judgment tasks).

## Why This Matters

### 1. Unifies Three Previously Separate Findings

- **KE-176** (selective compliance): Agents cherry-pick by deviation cost → deviation cost IS internalization distance
- **KE-129** (forced externalization): Only Ch2 works for judgment → judgment behaviors have maximum internalization distance, requiring structural override
- **KE-021** (Process > Knowledge > Judgment): The skill type hierarchy IS an internalization distance ordering

```
                    TEXT SKILL EFFECTIVENESS
                    ▲
                    │  ████ Additive process (~100%)
                    │  ██   Knowledge/context (variable)
                    │  █    Interruptive process (~10%)
                    │  ·    Judgment (0%)
                    └────────────────────────────────▶
                         INTERNALIZATION DISTANCE
```

### 2. Predicts Where Each Intervention Channel Works

SKILL0's framework suggests a clean mapping:

| Internalization Distance | Text (Ch1) | Few-shot (Ch3) | Structural gate (Ch2) | Training (SKILL0) |
|--------------------------|-----------|----------------|----------------------|-------------------|
| Zero (already internalized) | ✓ (redundant) | ✓ (redundant) | ✓ (wasteful) | Not needed |
| Small (additive steps) | **✓** | ✓ | ✓ (overkill) | Not needed |
| Medium (interruptive process) | ✗ | Partial | **✓** | Would work |
| Large (judgment tasks) | ✗ | ✗ (under momentum) | **✓** | Would work |

This explains the **escalating intervention cost** pattern: as internalization distance increases, you need increasingly expensive mechanisms (text → examples → gates → training).

### 3. Makes a New Prediction About Training

SKILL0 demonstrates that RL training can internalize skills, moving them from "large distance" to "zero distance." If this applies to LLM agents, then:

- **Behaviors currently requiring Ch2 gates** (like "analyze before coding") could be internalized through targeted fine-tuning
- **Post-internalization, the gate becomes unnecessary** — the behavior would be parametric
- **But for API-only users** (us), we cannot internalize behaviors into the model — we must use Ch2 gates as a permanent substitute for training

This formalizes KE-081's open question about whether automated harness optimization (DD-560) or skill internalization (DD-570) is the better path. The answer depends on whether you have training access.

## Connection to H-161 (Dual IT Functions)

H-161 decomposes forced externalization into F1 (memory compression for consumers) and F2 (behavioral forcing for producers). The internalization distance framework adds precision:

- **F2 (behavioral forcing)** is needed precisely when internalization distance is large — the gate substitutes for what training would otherwise provide
- **F1 (memory compression)** is always useful regardless of internalization distance — even fully internalized behaviors benefit from having their outputs persisted for downstream consumers
- **SKILL0 eliminates the need for F2** (by internalizing the behavior) **but not F1** (the environment still needs the artifact)

This means: even in a world where all agent behaviors are perfectly internalized via SKILL0-style training, F1 artifacts would still be valuable. F2 artifacts would become unnecessary. This is a testable prediction for H-161.

## Relation to the Meta-Harness Research Thread (DD-560 / KE-081)

DD-560 (meta-agent) and DD-570 (SKILL0) represent **two complementary optimization strategies**:

| Strategy | What It Optimizes | Cost | When It's Better |
|----------|-------------------|------|------------------|
| DD-560 (meta-agent) | Harness (context, prompts, tools) | Runtime tokens | Novel tasks, changing requirements |
| DD-570 (SKILL0) | Parameters (model weights) | Training compute | Routine tasks, stable requirements |

For our system (API-only, no training access), DD-560 is the only viable path. But understanding the DD-570 complement helps us identify **what we're compensating for** when we add gates: we're using runtime harness engineering as a substitute for training that would internalize the behavior.

## Testable Predictions

- **P-183a**: Compliance rate for a given skill step is inversely correlated with the step's deviation from the agent's default behavior on that task. Operationalization: measure default behavior on N baseline runs, then code each skill step by whether it appears in ≥50% of baselines. Steps that do appear ("low distance") should show ≥80% compliance; steps that don't ("high distance") should show ≤30%.

- **P-183b**: If a skill step can be reframed to reduce internalization distance (KE-176 P-176c: reframing interruptive as additive), compliance should increase proportionally to the distance reduction.

- **P-183c**: Across our scenario portfolio, the rank ordering of check pass rates in baseline (no skill) should predict the rank ordering of compliance rates when the corresponding skill is injected. Behaviors the agent already does sometimes should be easier to reinforce via text.

## Limitations

- DD-570's internalization is literal (RL training changes weights). Our "internalization distance" is metaphorical — we're mapping from a training framework to an inference-time concept. The formal relationship is unproven.
- We can't measure actual internalization distance in a closed-source model. We can only infer it from baseline behavior rates.
- The unifying framework is elegant but may be too neat — there could be compliance factors orthogonal to internalization distance (e.g., instruction position per H-091/EXP-095).

## Cross-References

| Entry | Connection |
|-------|-----------|
| KE-176 | Selective compliance — KE-183 explains the mechanism |
| KE-129 | Forced externalization — KE-183 explains why Ch2 is necessary for high-distance behaviors |
| KE-021 | Process > Knowledge > Judgment — KE-183 reframes as internalization distance ordering |
| H-161 | Dual IT functions — KE-183 predicts F2 is needed only for high-distance behaviors |
| H-043 | Knowledge utilization — P(applies) factor may be a proxy for internalization distance |
| KE-081 | Meta-harness optimization — DD-560 and DD-570 are complementary strategies |
| DD-560 | meta-agent — runtime harness optimization (compensates for distance via context) |
| DD-570 | SKILL0 — training-time internalization (eliminates distance via parameters) |

---
*KE-183 • Synthesized by Bob • 2026-04-15 ~08:40*
*Sources: DD-570 (SKILL0, ZJU-REAL), KE-176 (EXP-154), KE-129 (EXP-127/155/156)*
