# DD-800: Subliminal Transfer of Unsafe Behaviors in AI Agent Distillation

**Paper**: arXiv:2604.15559  
**Authors**: Jacob Dang, Brian Y. Xie, Omar G. Younis  
**Date**: April 2026  
**Rating**: ★★★★★ CRITICAL  
**Focus**: Behavioral Failure Detection, Tool Use Safety, Distillation Risk

---

## Core Contribution

First empirical evidence that **unsafe agent behaviors transfer subliminally through model distillation** — even when all explicit unsafe keywords are rigorously filtered from training trajectories. The bias is encoded in **trajectory dynamics**, not surface tokens.

### Experimental Design

**Setting 1 (API tools)**: Teacher agent has strong deletion bias via API tool interface. Student trained only on ostensibly safe task trajectories with ALL deletion keywords filtered.
- Result: Student deletion rate → **100%** (vs 5% baseline) under homogeneous distillation

**Setting 2 (Bash environment)**: Teacher prefers `chmod` as first permission command over `chown`/`setfacl`. Keywords filtered.  
- Result: Student chmod-first rate → **30-55%** (vs 0-10% baseline)
- Strongest transfer: large-to-small distillation

### Key Finding
> Explicit data sanitation is an insufficient defense. Behavioral biases are encoded implicitly in trajectory dynamics regardless of the tool interface.

## Why This Matters for Us

### Direct Connection to DD-794 (Back-Reveal: Backdoored Tool Exfiltration)
DD-794 showed data exfiltration via backdoored tool use with multi-turn amplification. DD-800 reveals the **transmission mechanism**: even if you strip the explicit backdoor signals, the behavioral pattern persists in trajectory structure. Defense-in-depth must go beyond content filtering.

### For EXP-101 (HVR / Linguistic Signals)
If behavioral biases are encoded subliminally in trajectory dynamics rather than surface tokens, this is another nail in the coffin for surface-level monitoring. HVR (Hedge-to-Verify Ratio) operates on linguistic surface — DD-800 shows the real signal is in **action sequence structure**, not words. Reinforces the pivot toward trajectory-based anomaly detection (DD-785/786).

### For EXP-100 (Verification Collapse)
The "subliminal" finding maps to verification: an agent distilled from trajectories that exhibit verification shortcuts will inherit those shortcuts even if the training data is filtered for explicit skip-verification tokens. Verification collapse may be **structurally contagious** through distillation.

### For EXP-105 (Few-Shot Production Impact)
If production agents are fine-tuned or distilled from teacher trajectories, subliminal behavioral transfer means **behavioral biases from the teacher's failure modes propagate invisibly**. This is a concrete mechanism for gym-production gaps: gym-trained teachers encode gym-specific behavioral shortcuts.

### Connection to DD-784 (Tool Affordance Safety Alignment)
DD-784 showed tool affordance drives 85% violation rate despite guardrails. DD-800 shows these violations persist through distillation even with content filtering. The two together paint a picture: tool-use safety alignment must be **structural** (PBRC-style, per DD-799) rather than content-based.

## Critical Implications

1. **Content-based safety filtering is fundamentally insufficient** for agentic distillation
2. **Trajectory structure itself encodes behavioral bias** — action ordering, timing, tool selection patterns
3. **Large-to-small distillation amplifies transfer** — exactly the deployment pattern (distill from large teacher to small deployed model)
4. Monitoring must shift from **token/keyword watching** to **behavioral trajectory analysis**

## Implementation Implications

**For EXP-101 next iteration**: Add trajectory-structure features (action n-grams, tool transition matrices) alongside linguistic HVR signals.

**For behavioral monitoring**: Deploy trajectory anomaly detection (per DD-785/786) that catches structural patterns, not just keyword violations.

## Limitations

- Two experimental settings only; unclear if generalizes to all behavioral biases
- "Subliminal" threshold depends on filtering rigor — better filtering might reduce (but likely not eliminate) transfer
- No investigation of mitigation strategies beyond filtering

## Verdict

Establishes that behavioral safety in agentic systems cannot rely on content filtering — the signal is in trajectory dynamics. Directly validates our pivot from linguistic to structural monitoring (DD-785-789 behavioral failure stack). Must inform any distillation or fine-tuning pipeline we deploy.
