# KE-090: Verbalized Confidence Mechanisms in LLM Agents — Why Passive Hedging Detection Fails

**Date**: 2026-04-09
**Author**: Bob (synthesis)
**Sources**: DD-679 (★★★★★), DD-680 (★★★★½), DD-681 (★★★★½)
**Connects to**: H-094 (HVR confidence gating), EXP-101 (HVR validation), KE-089 (adaptive verification)

---

## Synthesis

Three concurrent papers on verbalized confidence in LLMs converge to explain a specific empirical finding: EXP-101's Hedge-to-Verify Ratio (HVR) showed only weak discriminative signal (AUROC 0.535-0.566, below the 0.60 target) despite high zero-hedge precision (96.3%). The explanation is mechanistic, not methodological — passive hedging detection in reasoning traces faces fundamental limitations.

### Source 1: Trained > Passive Uncertainty Interfaces (DD-679)

Guo et al. (2026) compare two **trainable** uncertainty interfaces:

- **Global interface**: Model verbalizes a calibrated confidence score. Mainly refines how *existing* internal uncertainty is decoded — the model already "knows" its confidence; training surfaces it.
- **Local interface**: Model emits explicit `<uncertain>` markers during reasoning. This is fundamentally different — it induces **late-layer reorganization**, making previously silent failures visible during generation.

**Key insight for H-094**: EXP-101 used *passive* detection of naturally-occurring hedging markers. DD-679 shows that trained markers induce qualitatively different internal processing. Passive detection captures surface-level linguistic patterns; trained markers capture genuine uncertainty signals. The gap between these two approaches explains part of EXP-101's weak AUROC.

### Source 2: Natural Linguistic Confidence is Poorly Calibrated (DD-680)

Tao et al. (2025) introduce Linguistic Confidence (LC) — expressing uncertainty through hedging language ("probably", "might", "I think") rather than numerical scores.

Key findings:
- First large-scale dataset of hedging expressions with human-annotated confidence scores
- Lightweight mapper converts hedges → calibrated confidence scores at near-zero cost
- **Most LLMs underperform in expressing reliable LC out-of-the-box** — natural hedging is poorly calibrated without fine-tuning

**Key insight for H-094**: EXP-101's binary hedge/no-hedge classification discards signal granularity. The mapper approach (hedge → calibrated score) could upgrade methodology. But more importantly, the finding that natural LC is unreliable validates why binary detection yields near-base-rate discrimination — the underlying signal is noisy.

### Source 3: Reasoning Contamination Effect — The Mechanistic Explanation (DD-681)

Miao & Ungar (2026) provide the **mechanistic smoking gun** via interpretability analysis:

- **Calibration** (does the model know it's right?) and **verbalized confidence** (what confidence does it express?) are encoded **linearly but orthogonally** in LLM representations
- The model's internal "knowing" and external "saying" are fundamentally decoupled
- **Reasoning Contamination Effect (RCE)**: When models simultaneously reason AND verbalize confidence, the reasoning process **disrupts the confidence direction**, exacerbating miscalibration
- Two-stage adaptive steering (read internal estimate → steer output) substantially improves alignment

**Key insight for H-094**: Agent traces are *exactly* the setting where RCE is maximal — agents reason through tool calls, error recovery, and planning, all while producing hedging language. The hedging is generated *during* reasoning, so RCE guarantees it will be poorly correlated with actual uncertainty. This is the strongest mechanistic explanation for EXP-101's weak signal.

---

## Unified Model: Why HVR Fails

The three sources form a causal chain:

1. **Natural hedging is unreliable** (DD-680): LLMs don't produce well-calibrated hedging language without training
2. **Reasoning contaminates confidence** (DD-681): Even the weak natural signal is further degraded when hedging occurs during reasoning (which it always does in agent traces)
3. **Passive detection misses the real signal** (DD-679): The internal uncertainty representation exists but requires trained interfaces to surface — passive regex detection captures noise, not signal

Together: **EXP-101's HVR approach was methodologically sound but mechanistically doomed** — it tried to extract calibrated confidence from a channel that is (a) naturally unreliable and (b) actively contaminated by the reasoning it co-occurs with.

---

## Predictions

- **P-090a**: Position-weighted HVR (emphasizing late-trace hedging, after main reasoning is complete) should outperform full-trace HVR, because late-trace hedging is less contaminated by active reasoning
- **P-090b**: Trained `<uncertain>` markers (DD-679 approach) would substantially outperform passive hedging detection for agent confidence estimation
- **P-090c**: A two-stage architecture (reason first → assess confidence separately in a second pass) would avoid RCE and yield usable confidence signals from agent traces
- **P-090d**: The hedging→score mapper (DD-680) applied to agent traces would show poor calibration without agent-specific training data, but would outperform binary hedge/no-hedge classification

---

## Implications for H-094

H-094 (HVR as zero-cost confidence gate) remains at P(H) = 0.50. The literature does NOT disconfirm the hypothesis — it explains the specific failure mode and identifies the path forward:

- The **zero-hedge precision** finding (96.3%) is real and useful: absence of hedging genuinely predicts success
- The **weak AUROC** is now mechanistically explained: hedging presence is contaminated by RCE
- **Path forward**: Two-stage confidence assessment, trained uncertainty markers, or position-weighted analysis — all require architectural changes beyond passive detection

The hypothesis needs refinement: HVR works as a one-sided filter (no hedging → high confidence of success) but fails as a bidirectional discriminator (hedging → uncertain, because hedging is noise).

---

*Updated by Bob | 2026-04-09 | Synthesis of DD-679, DD-680, DD-681*
