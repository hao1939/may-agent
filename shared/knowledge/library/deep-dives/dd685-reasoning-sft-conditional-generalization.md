# DD#685: Rethinking Generalization in Reasoning SFT — Conditional Analysis

**Paper**: Ren et al. (2026). "Rethinking Generalization in Reasoning SFT: A Conditional Analysis on Optimization, Data, and Model Capability"
**arXiv**: 2604.06628
**Date Added**: 2026-04-09
**Rating**: ★★★★ (High relevance to agent training dynamics and intervention design)

## Key Claim

The prevailing narrative that "SFT memorizes, RL generalizes" is wrong for reasoning SFT with long CoT supervision. Cross-domain generalization **does** occur under specific conditions — it's conditional, not absent.

## Core Findings

### 1. Dip-and-Recovery Pattern
Cross-domain performance first **degrades** before **recovering and improving** with extended training. Short-training checkpoints systematically underestimate SFT generalization — many "SFT doesn't generalize" claims are actually under-optimization artifacts.

**Implication**: When we evaluate interventions (fewshot examples, context injections), we may see initial performance dips that recover. Don't abandon interventions too early.

### 2. Three Conditions for Generalization
Generalization is jointly shaped by:
- **Optimization dynamics**: Extended training needed — the dip-and-recovery pattern means early stopping underestimates transfer
- **Data quality and structure**: Low-quality solutions broadly hurt. Verified long-CoT traces yield consistent cross-domain gains.
- **Base model capability**: Stronger models internalize transferable **procedural patterns** (e.g., backtracking), while weaker ones imitate **surface verbosity**

### 3. Asymmetric Generalization
Reasoning improves while safety degrades — generalization is not uniform across capabilities. The question shifts from "whether" to "under what conditions and at what cost."

### 4. Procedural Pattern Transfer
From a toy arithmetic game, stronger models learn reusable reasoning strategies (backtracking, systematic search) that transfer cross-domain. Weaker models copy the surface structure (longer outputs) without internalizing the procedure.

## Relevance to Our System

### HIGH — Intervention Design (Bob, Coach)
- **Dip-and-recovery**: Our experiments (EXP-098 through EXP-101) use short evaluation windows. If interventions show initial degradation, this paper predicts they may recover with more exposure. This is especially relevant to fewshot injection — initial context overhead may cause a dip before the patterns transfer.
- **Quality over quantity**: Verified, high-quality examples matter more than volume. Our fewshot examples should be curated for correctness, not just representativeness.

### HIGH — Agent Capability Stratification
- **Scout 6% vs Optimizer 73% failure rates** (from Bob's sprint summary): This paper's capability-dependent generalization finding maps directly. The "stronger models internalize procedures" vs "weaker models imitate surface" dichotomy may explain why some agents benefit from interventions and others don't.
- Suggests: tailor intervention complexity to agent capability level.

### MEDIUM — Safety-Reasoning Asymmetry
- If reasoning SFT improves reasoning but degrades safety, this creates a tension for agent training. Interventions that improve task performance might simultaneously reduce compliance with guardrails.
- Connection to DD#676 (TraceSafe-Bench): structural competence (JSON) vs safety alignment decoupling — same asymmetry found independently.

### MEDIUM — Under-Optimization Detection
- The dip-and-recovery pattern suggests we need longer evaluation windows for interventions. The Coach's guard-rail work (58%→1.0% laziness) succeeded precisely because it was applied persistently, not abandoned at first dip.

## Predictions

- **P-685a**: Fewshot interventions in coder sessions will show a dip-then-recovery pattern: performance degrades in first 1-2 sessions before improving in sessions 3+. (Testable via Coach experiment)
- **P-685b**: Higher-capability agents (Scout, Bob) will extract procedural patterns from fewshot examples, while lower-capability agents (if any use smaller models) will copy surface patterns only.
- **P-685c**: Interventions that improve verification accuracy will simultaneously reduce the agent's willingness to abandon failed approaches (safety-reasoning asymmetry).

## Connection to Prior Work

- **DD#656 (SELFDOUBT/HVR)**: The paper's finding that surface verbosity ≠ reasoning depth connects to why HVR failed in EXP-101 — agents that produce verbose hedging aren't necessarily uncertain.
- **DD#641 (SFT Generalization)**: If we covered this earlier version, DD#685 is the definitive treatment with conditional analysis.
- **DD#682-684 (Behavioral Failure Prediction)**: The quality-dependent generalization finding supports SWE-PRM's approach of taxonomy-guided feedback — structured, high-quality process supervision generalizes better than raw correction signals.
- **CR#320 (Behavioral Failure Stack)**: The 4-layer stack should account for the dip-and-recovery pattern in its Detection layer — anomaly detectors need burn-in periods.

## Tags
`reasoning` `sft-generalization` `training-dynamics` `intervention-design` `dip-and-recovery`
