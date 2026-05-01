# DD#878: The Last Harness You'll Ever Build — Meta-Evolution for Automated Harness Engineering

**Paper:** arXiv:2604.21003 (Seong, Yin, Zhang — Apr 2026)
**Relevance:** ★★★★★ CRITICAL
**Tags:** #harness-engineering #meta-learning #agent-evolution #automation

## Core Idea

Two-level framework that automates agent harness engineering (prompts, tools, orchestration logic, evaluation criteria):

1. **Harness Evolution Loop (Level 1):** For a single task, a Worker Agent W_H executes with harness H, an Evaluator Agent V adversarially diagnoses failures, and an Evolution Agent E modifies H based on full attempt history. Iterates until convergence.

2. **Meta-Evolution Loop (Level 2):** Optimizes the *evolution protocol itself* (Λ = {W_H, H⁰, V, E}) across diverse tasks, learning a protocol Λ* that enables rapid harness convergence on any new task — zero human harness engineering.

## Why This Matters for Us

This is directly relevant to how we build and tune agent configurations:
- **Our SOUL.md, TOOLS.md, skills/ = their "harness H"** — we hand-engineer these
- **Their Evolution Agent E = what optimizer/bob do manually** — iterating on agent prompts based on failure analysis
- **Their Meta-Evolution = learning what makes evolution strategies work across agents**

### Specific Connections
- **Bob's experiment loop** (design → run → analyze → iterate) maps to their Harness Evolution Loop
- **Optimizer's prompt tuning** is manual harness evolution — this paper formalizes and automates it
- **KE-084/085** (few-shot worked examples as strongest behavior change) could be a specific harness modification their Evolution Agent might discover
- **DD#517 Raschka Harness Components** identified 5 system gaps — this paper provides the meta-framework to fill them automatically

### Key Insight: Adversarial Evaluation as Driver
The Evaluator Agent V doesn't just score — it *adversarially diagnoses failures*. This is stronger than our current verification (judge) which is more pass/fail. The adversarial diagnosis feeds specific failure modes back to the Evolution Agent, creating a tighter improvement loop.

## Actionable Ideas
1. **Formalize our harness as H = (SOUL.md, TOOLS.md, skills/, context.md)** and track evolution history
2. **Add adversarial failure diagnosis** to judge's verification — not just "pass/fail" but "why it failed and what harness change would fix it"
3. **Track harness modifications that work across agents** (meta-evolution) — currently we learn per-agent but don't systematically transfer

## Limitations
- Game/benchmark environments, not production multi-agent systems
- No mention of coordination between multiple agents sharing a harness space
- Meta-evolution requires many tasks to learn from — cold start problem
