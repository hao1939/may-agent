# Cross-Reference: MIT ORCA Online Calibration → Dynamic Topology Optimization

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Source**: HB-250403-mit-orca-online-calibration.md (arXiv:2604.01170)
**Connects to**: H-048 (Dynamic Topology Optimization), H-051 (Abstention Rate as R-Estimator), R-Estimation Heuristic

---

## The Connection

MIT ORCA solves the problem of "when should a reasoning model stop thinking?" by building lightweight online calibration probes that assess confidence during inference. The probe watches the model's hidden states and makes step-by-step decisions about whether the answer is already reliable enough.

**This is the same structural problem as runtime R-estimation in our system**: when should the system switch from exploration mode (low-structure, high autonomy) to execution mode (high-structure, prescribed steps)?

## Mapping ORCA → Decision Topology

| ORCA Concept | Decision Topology Equivalent | Notes |
|---|---|---|
| "When to stop reasoning" | "When does R shift from low to high" | Both: detecting the moment computation becomes eliminable |
| Lightweight calibration probe | R-estimation heuristic | Both: lightweight meta-decision layer that doesn't change the main process |
| Online updating (per-sample) | Dynamic R(t) tracking (H-048) | Both: the assessment changes DURING execution, not just before |
| Conformal risk guarantee | Asymmetric default threshold (H-044) | Both: formal bounds on the cost of wrong decisions |
| Hidden states contain sufficient signal | Observable signals predict R | ORCA's key finding: the model's own behavior predicts when to stop. H-051 predicts: confidence/abstention patterns predict R. |

## Key Insights

### 1. The Signal Is Already There

ORCA's most surprising finding: the simplest probe (no-QK version, minimal parameters) performs BEST. The hidden states already encode enough information — you don't need a complex classifier.

**For us**: This suggests that runtime R-estimation doesn't need sophisticated machinery. Simple heuristics (confidence level, tool diversity, action repetition patterns) may already contain the signal. Our 3-question R-estimation heuristic (`r-estimation-heuristic.md`) may be close to sufficient — the question is whether we can make it dynamic (assess during the session, not just before).

### 2. Online Calibration > Static Classification

ORCA explicitly shows that static thresholds degrade under distribution shift. The probe must update its calibration during inference to handle tasks that differ from training distribution.

**For us**: This validates H-048's core claim that R varies WITHIN a single task across phases. A static pre-task R estimate (our current approach) will always be wrong for tasks that transition between exploration and execution. ORCA's architecture — lightweight meta-layer that updates step-by-step — is exactly what dynamic topology optimization needs.

### 3. Risk-Bounded Decisions

ORCA uses conformal prediction to set the stopping threshold with a formal guarantee: "the probability of stopping too early (causing error) is bounded by α." This is the statistical version of H-044's asymmetric default.

**For us**: We know over-structuring costs 2.4× more than under-structuring (H-044). ORCA shows how to formalize this: set the threshold for "add structure" conservatively (high confidence required), and the threshold for "remove structure" aggressively (low confidence sufficient). The asymmetry in our system (33pp vs 14pp penalty) maps to a calibration asymmetry in the probe.

### 4. The Calibration-Generalization Tradeoff

ORCA trains on math/logic benchmarks but generalizes to GPQA (science) and AIME (competition math). The key: meta-learning learns a good INITIALIZATION for the probe, which then adapts online to new domains.

**For us**: If we build an R-estimator, we should train it on our gym scenario data (where R is known from EXP-011 and EXP-016) but design it to adapt online to production tasks. The 20 calibration points from EXP-016 could serve as the initialization set.

## What This Is NOT

This is **not** a proposal to implement ORCA or to build a neural probe. ORCA operates at the model inference level (monitoring hidden states during token generation), which is below our harness-level access. We work at the harness level — we see tool calls, file reads, outputs, but not hidden states.

What we CAN extract from ORCA:
- **Design principle**: Runtime calibration > static classification for structure decisions
- **Architecture pattern**: Lightweight meta-layer that watches observable signals and adjusts constraints
- **Confidence**: Simple signals outperform complex ones for this task
- **Risk framing**: Asymmetric thresholds based on directional cost of errors

## Practical Application

### Observable Signals for Harness-Level R-Estimation

Since we can't see hidden states, what CAN we observe?

| Signal | High-R indicator | Low-R indicator |
|---|---|---|
| **Tool call diversity** | Repeated same tools (read, edit, run) | Many different tools, searching behavior |
| **Action reversals** | Few/none (linear progress) | Many (try, fail, try different) |
| **Output confidence** | Declarative statements, direct action | Hedging, "let me check", "might be" |
| **Time between actions** | Short, regular intervals | Long pauses, variable timing |
| **Scope changes** | None — staying on task | Expanding/contracting scope |
| **File access pattern** | Focused on few files | Browsing many files |

These are harness-observable analogs to ORCA's hidden-state probes. EXP-016's data on 20 scenarios could calibrate initial thresholds.

### Proposed Architecture

```
Task arrives → Static R estimate (3-question heuristic) → Select initial architecture
  During execution:
    → Monitor observable signals (tool diversity, reversals, confidence)
    → Update R(t) estimate per phase
    → IF R(t) crosses threshold UP → tighten structure (add phase boundary)
    → IF R(t) crosses threshold DOWN → loosen structure (remove constraints)
    → Apply asymmetric thresholds (require 80% confidence to add structure, 40% to remove)
```

This is the harness-level equivalent of ORCA's online calibration. It implements H-048's dynamic topology optimization using observable signals rather than hidden states.

## Status

This is a **design principle extraction**, not a new hypothesis. The core ideas (dynamic R, observable signals, asymmetric thresholds) already exist in H-048, H-051, and H-044. ORCA provides:
1. Empirical validation that lightweight online calibration works (their simplest probe beats complex ones)
2. The conformal prediction framework for formalizing our asymmetric thresholds
3. The meta-learning pattern for initializing calibration from known data

No new hypothesis needed. This refines the implementation path for H-048.

## References

- HB-250403-mit-orca-online-calibration.md (source)
- H-048: Dynamic Topology Optimization
- H-051: Abstention Rate as Runtime R-Estimator
- H-044: Asymmetric Default
- EXP-016: 20-scenario meta-analysis (calibration data)
- r-estimation-heuristic.md: Current static R-estimation tool

---
*Bob (Architect) | 2026-04-02 ~23:30*
