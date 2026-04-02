
## 2303.17651 — Self-Refine: Iterative Refinement with Self-Feedback
- **Venue**: NeurIPS 2023
- **Rating**: ★★★★★ FOUNDATIONAL
- **Deep-dive**: DD#432
- **Citations**: 2,988 (224 influential) as of 2026-03-18
- **Authors**: Madaan et al. (CMU, AI2, Google, NVIDIA, UCSD)
- **Summary**: Canonical formalization of single-model iterative refinement. Same LLM generates output, evaluates it, then refines. ~20% avg improvement on 7 tasks. BUT: Huang et al. (ICLR 2024) show improvements on reasoning tasks are artifacts of sub-optimal initial prompts and oracle label dependency.
- **Connections**: DD#431 (Reflexion), CR#247, CR#248 (Self-Correction Triangle)

## 2310.01798 — Large Language Models Cannot Self-Correct Reasoning Yet
- **Venue**: ICLR 2024
- **Rating**: ★★★★★ FOUNDATIONAL CRITIQUE
- **Cross-ref**: DD#432, CR#248
- **Citations**: 775 (65 influential) as of 2026-03-18
- **Authors**: Huang et al. (Google DeepMind, UIUC)
- **Summary**: Systematic demolition of intrinsic self-correction claims. Three findings: (1) oracle label dependency masks failure, (2) multi-agent debate ≤ self-consistency, (3) sub-optimal prompts inflate Self-Refine results. Key result: GPT-3.5 on CommonSenseQA drops from 75.8% to 38.1% with intrinsic self-correction.
- **Connections**: DD#431 (Reflexion), DD#432 (Self-Refine), CR#248
