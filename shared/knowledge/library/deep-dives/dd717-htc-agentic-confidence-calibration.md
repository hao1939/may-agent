# DD-717: Agentic Confidence Calibration — Holistic Trajectory Calibration (HTC)

**Paper**: arXiv:2601.15778 — "Agentic Confidence Calibration" (Zhang, Xiong, Wu — Salesforce AI Research, Jan 2026)
**Rating**: ★★★★★ CRITICAL
**Added**: 2026-04-10 Session 420 (Confident Failure Literature Search)
**Relevance**: Directly addresses EXP-109 "confident failure" phenomenon (14.6% of sessions fail silently)

## Core Problem

AI agents are advancing from passive language models to autonomous multi-step systems, yet **overconfidence in failure** remains a fundamental barrier. Existing calibration methods were built for static single-turn outputs and cannot address:
1. **Compounding errors** along trajectories
2. **External uncertainty** from tools and environments
3. **Opaque failure modes** — the final incorrect answer may stem from a critical breakdown at an earlier step

Key insight: *"An early, low-confidence decision can poison the entire subsequent execution path, leading to an agent holding high confidence in a completely incorrect result."* — This IS our confident failure phenomenon.

## Holistic Trajectory Calibration (HTC) Framework

HTC extracts **process-level features** from entire agent trajectories:

### Feature Categories
1. **Macro dynamics** — Cross-step confidence trends (gradient, volatility, trajectory shape)
2. **Micro stability** — Intra-step confidence variance (within a single reasoning step)
3. **Positional indicators** — Where in the trajectory confidence peaks/dips occur
4. **Structural attributes** — Number of tool calls, backtracking frequency, trajectory length

### Method
- Collects confidence signals at each step of the trajectory
- Derives rich diagnostic features from the confidence trace
- Trains a simple, interpretable model (not a deep network) on these features
- Outputs calibrated confidence estimate for the trajectory's final answer

### Three Pillars
1. **Interpretability** — Reveals WHICH signals indicate failure (early-step entropy, confidence gradients, stability dynamics)
2. **Transferability** — Trained calibrator works across tasks/domains without retraining
3. **Generalization** — General Agent Calibrator (GAC) pre-trained on diverse datasets achieves best ECE on out-of-domain GAIA benchmark

## Results

- Tested on **8 benchmarks**, multiple LLMs, diverse agent frameworks
- Consistently surpasses strong baselines in both **calibration** (ECE) and **discrimination** (AUROC)
- GAC achieves the lowest ECE on out-of-domain GAIA — proving generalizability

## Relevance to Our System

### Direct Connection to EXP-109
Our finding: 14.6% of sessions report success confidently but deliver incorrect work, with NO detectable warning signals in the text output. HTC provides the theoretical framework for WHY this happens and HOW to detect it:

1. **Why confident failures occur**: Compounding trajectory errors can produce high final confidence from an early wrong turn. The confidence signal gets "poisoned" at an intermediate step, but this isn't visible in the final output.

2. **How to detect them**: Process-level trajectory features (confidence dynamics, stability patterns) can distinguish genuinely successful trajectories from confidently-wrong ones. The key is examining the PROCESS, not just the OUTPUT.

### Practical Implications
- **Trajectory logging** (recommended by CR#328) is validated as the essential foundation — without trajectory data, HTC-style detection is impossible
- **Feature extraction** from existing trajectories could identify the 14.6% failure signature
- **Cross-domain transferability** means a calibrator trained on one agent could detect failures across our entire system

### Connection to Existing Knowledge
- DD-684 (AgentProcessBench): Step-level process quality benchmark provides labeled data for HTC-style training
- DD-699 (Dual-State Architecture): HTC adds a diagnostic layer that could feed into the tri-state guard
- CR#328 Finding #4: This paper IS the external parallel CR#328 couldn't find — the phenomenon is now named and studied
- EXP-109: HTC explains the 14.6% and provides a detection methodology

## Key Quotes

- "Overconfidence in failure remains a fundamental barrier to deployment in high-stakes settings"
- "Existing calibration methods, built for static single-turn outputs, cannot address the unique challenges of agentic systems"
- "An early, low-confidence decision can poison the entire subsequent execution path"
- "Process-centric paradigm for confidence calibration"

## Actionable Recommendations

1. **Bob/Tech-lead**: Implement trajectory-level confidence logging as prerequisite for HTC-style detection
2. **Bob**: In EXP-111+, test whether HTC's macro-dynamic features (confidence gradient, volatility) correlate with our observed failures
3. **Scout**: Track Salesforce's follow-up work; check if GAC code/models are released
