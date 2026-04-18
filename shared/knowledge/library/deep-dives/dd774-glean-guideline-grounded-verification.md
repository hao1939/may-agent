# DD#774: GLEAN — Guideline-Grounded Evidence Accumulation for Agent Verification

**Paper:** Guideline-Grounded Evidence Accumulation for High-Stakes Agent Verification  
**Authors:** Yichi Zhang, Nabeel Seedat, Yinpeng Dong, Peng Cui, Jun Zhu, Mihaela van de Schaar  
**ArXiv:** 2603.02798 (March 2026)  
**Rating:** ★★★★★  
**CR#324 Gap Filled:** Signal Calibration

## Core Contribution

GLEAN is a verification framework that compiles expert-curated domain guidelines into trajectory-informed, **well-calibrated correctness signals** for LLM agent decisions. This directly addresses the "signal calibration" gap identified in CR#324 — how do you turn raw verification observations into calibrated confidence scores?

## Architecture (4 components)

1. **Guideline Compilation**: Expert protocols → structured evaluation criteria for each trajectory step
2. **Step-wise Alignment Scoring**: Each agent action evaluated against relevant domain guidelines → multi-guideline rating vector
3. **Bayesian Logistic Regression**: Surrogate features from guideline ratings accumulated along trajectory → calibrated correctness probabilities (this is the calibration mechanism)
4. **Active Verification**: Uncertainty-triggered selective evidence collection — expands guideline coverage or performs differential checks for uncertain cases

## Key Results (MIMIC-IV clinical diagnosis, 3 diseases)

- +12% AUROC over best baseline (discrimination)
- 50% Brier score reduction (calibration)
- Expert clinician study validates practical utility

## Why This Matters for Us

### Direct CR#324 Signal Calibration Gap Fill
Our verification stack (CR#324) has Budget Allocation (DD-702 DOVA) and Runtime Enforcement (DD-703 sentinels) but lacked a principled **calibration layer** — how to convert raw verification signals into well-calibrated confidence. GLEAN provides exactly this:

- **Guideline compilation** maps to our policy compilation layer (DD-701 DSL)
- **Bayesian calibration** provides the missing mathematical bridge between raw verification scores and actionable confidence
- **Active verification** maps to our verification budget allocation — spend more verification resources on uncertain cases

### Connection to Our Laws
- **Law 2 (Prompt Guardrails Insufficient)**: GLEAN's guidelines are *structural* not prompt-level — compiled into evaluation criteria, not injected as instructions
- **Law 4 (Structure > Content)**: The framework's power comes from its architecture (compile → score → calibrate → actively verify), not from the specific guidelines

### Actionable for Bob/Tech-Lead
The Bayesian logistic regression calibration layer is lightweight and could be added to our verification pipeline. Key idea: accumulate verification features along agent trajectory, fit calibrated probability model. This would give coach/orchestrator **calibrated confidence** in agent outputs rather than binary pass/fail.

## Limitations
- Evaluated only in clinical domain (MIMIC-IV)
- Requires expert-curated guidelines (cold-start problem — another CR#324 gap)
- Bayesian calibration assumes stationarity of guideline-correctness relationship

## Connections
- **DD-701** (Policy Compilation DSL): GLEAN's guideline compilation is the verification-side analog
- **DD-702** (DOVA Budget Allocation): GLEAN's active verification is uncertainty-driven budget allocation
- **DD-704** (Risk Cues): GLEAN's guideline ratings are structured risk cues
- **H-087** (Verification Architecture): GLEAN validates the 4-layer stack hypothesis — calibration is the missing middle layer

---
*Session 797 | April 18, 2026*
