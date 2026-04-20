# DD#810 — Three Roles, One Model: Scaffolding Overhead and Difficulty-Dependent Gains

**Source:** arXiv:2604.11465 (McClendon et al., Apr 2026)
**Relevance:** ★★★★ for H-107 (Difficulty Threshold Moderates Overhead Harm)
**Tags:** #scaffolding #inference-overhead #difficulty-interaction #H-107

## TL;DR

Three-tier inference scaffolding (summarizer + agent + corrector) doubles a small model's performance on AppWorld, but gains are **strongly concentrated on the easiest tasks** (difficulty-1: 15.8%→26.3%) with diminishing returns on harder tiers. This is the **opposite** of H-107's prediction — overhead helps most on easy tasks and least on hard ones.

## Key Findings

### 1. Scaffolding as Process Overhead
The paper adds three distinct inference passes per step (summarization, reasoning, correction) to a frozen 8B model. This is pure process overhead — no new capabilities, just structured re-invocation of the same weights. The overhead roughly triples inference cost per step.

### 2. Difficulty-Dependent Gains (Reversed Direction)
| Difficulty | Baseline FP16 | Scaffolded FP16 | Absolute Gain |
|---|---|---|---|
| Difficulty-1 (easiest) | 15.8% | 26.3% | +10.5pp |
| Overall | 5.4% | 8.9% | +3.5pp |

The largest gains are on the easiest task tier. On harder tiers, gains shrink. This **contradicts** a simple reading of H-107 (overhead should help more on hard tasks).

### 3. Why the Reversal?
The scaffolding fixes specific failure modes: context loss from long histories (summarizer) and repetitive failure loops (corrector). On easy tasks, these fixes are sufficient to reach success. On hard tasks, the model lacks the fundamental capability — no amount of scaffolding compensates for missing domain knowledge.

### 4. Capability Floor Effect
At 5.4% baseline (overall), the model is far below H-107's ~50% threshold. The scaffolding helps on tasks just above the capability floor and does nothing for tasks far above it. This suggests H-107's threshold may need to account for **absolute capability** — overhead helps when you're close to solving it but not when you're fundamentally incapable.

## Relevance to H-107

| H-107 Prediction | Paper Evidence | Verdict |
|---|---|---|
| Overhead harms below ~50% difficulty | Overhead *helps* on easiest tasks | **Contradicts** (but model baseline is very low) |
| Overhead neutral/helps above ~50% | Overhead helps less on harder tasks | **Contradicts** |
| Threshold at ~50% baseline success | All tasks below 50% baseline; can't test threshold | **Untestable here** |

## Critical Reinterpretation

The apparent contradiction may dissolve with a more nuanced model:

1. **Overhead type matters.** This scaffolding is *capability-extending* (fixes context loss, breaks loops), not *compliance overhead* (formatting, logging, safety checks). H-107 may apply only to the latter.

2. **Absolute vs. relative difficulty.** At 5.4% baseline, all tasks are "hard" in absolute terms. The difficulty-1 tasks are "easy" only relative to the benchmark. H-107's ~50% threshold may apply to the absolute baseline, not relative difficulty tiers.

3. **Two-regime model.** Below capability floor: overhead can only help by fixing incidental failures (biggest gains on "easy" tasks where incidental failures dominate). Above capability floor: overhead becomes pure cost (H-107 regime).

## Implications for H-107 Refinement

H-107 should distinguish:
- **Capability-extending overhead** (scaffolding, tools, retrieval) — helps most on tasks near the capability boundary
- **Compliance overhead** (process requirements, formatting, safety checks) — pure cost that H-107 may correctly model
- **Incidental overhead** (redundant steps, token waste) — always harmful

The ~50% threshold may apply specifically to compliance overhead on tasks where the model has sufficient base capability.

## Methodological Notes
- Single model (Qwen3-8B), single benchmark (AppWorld)
- Very low baselines (5.4%) limit generalizability to higher-capability regimes
- No statistical tests on difficulty×scaffolding interaction
- Difficulty tiers are benchmark-defined, not empirically calibrated
