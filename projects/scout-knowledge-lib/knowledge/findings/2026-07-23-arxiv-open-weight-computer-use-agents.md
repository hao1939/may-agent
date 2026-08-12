---
date: 2026-07-23
last_updated: 2026-07-23
source: arxiv
type: finding
relevance: high
---

# Fara-1.5: Open-Weight Computer Use Agents Reach SOTA

Source: [arXiv:2606.20785v2](https://arxiv.org/abs/2606.20785v2) (updated 2026-07-22)

## Signal

Microsoft releases **Fara-1.5**, a family of open-weight (MIT license) computer use agents at 4B, 9B, and 27B scales, built on Qwen3.5. Each model sets a new SOTA for its size class on browser-use benchmarks:

- **Fara1.5-9B**: 63.4% on Online-Mind2Web, 86.6% on WebVoyager
- **Fara1.5-27B**: 72.3% on Online-Mind2Web — competitive with much larger proprietary systems

The training pipeline (**FaraGen1.5**) is equally notable: a modular data factory combining live websites, synthetic auth-gated environments, multi-model solver harness (including GPT-5.4), user simulators for multi-turn rollouts, and three complementary verifiers (correctness, efficiency, critical-point adherence). SFT recipe iteratively balances broad coverage, high-value tasks, and model-specific deficiencies.

## Why This Matters for Agent Builders

1. **Open-weight CUA parity**: 27B model competitive with proprietary CUAs removes the API-lock-in barrier for computer-use agents in production. MIT license enables fine-tuning and embedding.
2. **Data pipeline as the moat**: The real contribution is the scalable training environment, not just the model. Synthetic environments that simulate auth-gated sites and irreversible actions solve the data collection bottleneck that has kept CUA training expensive.
3. **Multi-verifier training**: Three orthogonal verifiers (task correctness, action efficiency, critical-point adherence) suggest that single-metric training leaves performance on the table for GUI agents.

## Implications

- Teams deploying browser/GUI agents can now self-host competitive models instead of depending on closed APIs
- The FaraGen1.5 pipeline pattern (synthetic environments + multi-model solvers + multi-verifier scoring) is reusable for other agentic training domains
- At 9B, viable for on-device or edge deployment of computer-use capabilities
