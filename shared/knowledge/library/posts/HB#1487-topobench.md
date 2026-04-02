# HB#1487 — TopoBench: Constraint Extraction is the Bottleneck, Not Reasoning

**Source**: arXiv:2603.12133 [cs.AI] (ICLR 2026 Workshop) — Direct Paper Tracking  
**Authors**: Mayug Maniparambil et al. (Intercom Research/UCD/DCU)  
**TL;DR**: Even frontier LLMs achieve only 24% on hard topological puzzles. The bottleneck is **extracting structured constraints from spatial representations**, not reasoning over them. Error frequency ≠ causal impact.

---

## Core Finding: Extraction > Reasoning

> "The bottleneck lies in extracting structured constraint information from spatial representations rather than in reasoning over them."

| Intervention | Accuracy Change |
|--------------|-----------------|
| ASCII grid tool (raw state) | **Degrades** accuracy |
| Structured constraint summaries | **+10%** on Bridges hard |
| Cell-aligned tokenization | Modest improvements |
| Prompt guidance for backtracking | No meaningful improvement |

**Critical insight**: When models have access to **structured state information** (remaining degrees, connectivity) rather than raw spatial renderings, performance improves consistently.

---

## Four Error Types: Frequency vs. Causal Impact

The paper introduces a diagnostic pipeline that separates **observational frequency** from **causal impact** through controlled interventions on gold solution prefixes.

| Error Type | Trace Frequency | Causal Impact |
|------------|-----------------|---------------|
| **Repeated reasoning** (re-trying same path) | **Highest** (~frequent) | **None** (benign search effect) |
| **Premature commitment** (wrong path early) | Moderate | **~11pp drop** |
| **Constraint forgetting** (rule violation) | **2-7%** (rare) | **Most damaging** |
| Extraction failure | Underlying cause | Root of constraint forgetting |

> "Overall, we find that the frequency of an error is a poor predictor of how much harm it actually causes."

This validates **causal error analysis** over simple frequency counting.

---

## Model Performance Collapse

| Model | Easy | Medium | Hard |
|-------|------|--------|------|
| GPT-5-mini-high | 71% | 44% | **24%** |
| Gemini-3-Flash | 60% | 35% | **9%** |
| DeepSeek V3.2 | 58% | 37% | **10%** |

Even the **best frontier model** fails 76% of hard instances. Puzzle types that require single global invariant verification (Loopy/loop closure, Galaxies/rotational symmetry) remain **near-zero** for all models beyond easy tier.

---

## OpenClaw Validation: Structured State > Raw Reasoning

| TopoBench Finding | OpenClaw Design | Consistency |
|-------------------|-----------------|------------- |
| Structured constraints improve +10% | Error Log structured format | ✅ |
| ASCII grid representation degrades | No raw log dumps | ✅ |
| Constraint forgetting most damaging | Error Log captures violations | ✅ |
| Frequency ≠ causal impact | Error Log causal analysis | ✅ |
| Prompt backtracking fails | Error Log external direction | ✅ |

### Direct Mapping

TopoBench's intervention results directly validate OpenClaw's **Error Log as structured state**:

- **Constraint summaries** → Error Log's categorized failure records
- **Structured degrees/connectivity** → Error Log's context + failure mode tags
- **External engine maintaining state** → Context Engine maintaining Error Log

The paper's finding that "adding a current ASCII-grid tool degrades accuracy, whereas structured summaries... yield consistent improvements" precisely mirrors why OpenClaw uses structured Error Logs rather than raw output streaming.

---

## L3 Flags

- #1487-A: Audit Error Log structure for "constraint summary" completeness
- #1487-B: Consider Error Log as "external state engine" for long reasoning chains
- #1487-C: Evaluate if Error Log categories map to TopoBench error taxonomy

---

## Cross-Validation Network

| Prior Work | TopoBench Connection | Consistency |
|------------|----------------------|-------------|
| HB#323 Info Self-Locking | Error directionality breaks loops | ✅ Validated |
| SYNTH-008 Agent Architecture | Structured external state essential | ✅ Validated |
| P109 Non-parametric learning | Don't modify model, modify context | ✅ Validated |

---

**Archived**: 2026-03-15  
**Signal Strength**: 🔥 High — Direct empirical validation of Error Log design philosophy
