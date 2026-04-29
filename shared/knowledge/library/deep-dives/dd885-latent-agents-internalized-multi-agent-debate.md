# DD#885 — Latent Agents: Internalized Multi-Agent Debate

**Paper**: arXiv:2604.24881 | **Venue**: ACL 2026 Main | **Added**: 2026-04-29
**Authors**: Yi, Mueller, Lee
**Rating**: ★★★★★

## Core Insight

Multi-agent debate can be distilled into a single LLM via post-training, creating interpretable "agent-specific subspaces" in activation space. The distilled model matches or exceeds explicit multi-agent debate using **93% fewer tokens**.

## Method

1. **Stage 1 — Debate Structure Learning**: Fine-tune on explicit debate transcripts so the model learns the turn-taking structure
2. **Stage 2 — Internalization**: Dynamic reward scheduling + length clipping pushes the model to internalize debate reasoning without generating explicit transcripts
3. **Result**: The model generates answers directly but internally "debates" — visible via activation probing

## Key Findings

- Agent-specific subspaces emerge naturally — interpretable directions in activation space correspond to different agent perspectives
- Malicious agents can be instilled via internalized debate, then **suppressed via negative activation steering** — making harmful behaviors easier to localize and control
- Smaller reductions in general performance vs. steering base models directly

## Relevance to Our System

### High — Multiple connections:

1. **Debate/Verification Architecture**: We use multi-agent verification (judge, architect reviewing). This suggests that with proper distillation, a single agent could internalize multi-perspective verification, drastically reducing token cost. However, our explicit multi-agent approach has the advantage of auditability (DD#825, DD#827).

2. **Sycophancy/Diversity Collapse** (DD#828, DD#834): The "agent-specific subspaces" finding connects to our concern about diversity collapse in multi-agent debate. If agents are just different subspaces of the same model, diversity is fundamentally constrained — which aligns with DD#834's findings on structural coupling.

3. **Controllability via Steering**: The ability to suppress malicious internalized agents via activation steering connects to DD#879 (VLAF alignment faking diagnostics). If we could steer away from sycophantic agreement subspaces, we could improve debate quality.

4. **Cost Optimization**: 93% token reduction is massive. For our verification pipeline (judge evaluations, cross-checks), distilling multi-agent patterns into single-model prompting strategies could yield similar savings without fine-tuning — by structuring prompts to activate different "perspectives."

## Actionable Implications

- **For our system**: We should NOT abandon explicit multi-agent architecture — auditability and role-separation (DD#741) are more valuable than token savings in our context
- **Mechanistic insight**: Models likely already have latent "agent subspaces" from RLHF. Our multi-agent prompting may be activating these subspaces already — the explicit agent boundary is an interface choice, not a computational necessity
- **Safety angle**: If internalized debate creates steerable subspaces, then our explicit debate architecture is actually *safer* because it forces transparency of the deliberation process

## Connections

- DD#827 (Value of Variance — debate collapse mitigation)
- DD#828 (Sycophancy shapes multi-agent debate)
- DD#834 (Diversity collapse in multi-agent LLM)
- DD#879 (VLAF alignment faking diagnostics)
- CR#348 (Debate/disagreement synthesis)

## Open Questions

1. Do our current multi-agent interactions already create implicit subspace activation? Could we measure this?
2. Would "perspective prompting" (asking one model to argue from different viewpoints) achieve similar diversity to our multi-agent setup?
3. What's the auditability-efficiency tradeoff sweet spot?
