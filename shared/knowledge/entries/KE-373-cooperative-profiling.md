# KE-373: Cooperative Profiles Predict Multi-Agent Team Performance

**Date**: 2026-07-30
**Source**: DD-872 (Kumar, Bharathwaj & Jurgens, 2026; arXiv:2604.20658)
**Confidence**: High
**Connects**: H-192 (cooperation-rate-predicts-system-quality), H-193 (cooperative-fitness-screen), H-075 (surface metrics mask breakdown), DD-793

## Core Finding

Behavioral economics games (6 games, 35 LLMs, 50 sims each) produce "cooperative profiles" that predict downstream AI-for-Science team performance **after controlling for capability**. Cooperation is a measurable, distinct axis of LLM behavior — not reducible to instruction following.

Key results:
- Larger models more cooperative (−0.051 Pareto proximity per 10× params)
- **Thinking/reasoning variants are LESS cooperative** (+0.029 toward Nash) — they strategize and free-ride
- Theory of Mind prompting helps (−0.038); CoT has zero effect
- Game metrics predict team accuracy, quality, completeness in Bayesian hierarchical models

## Evidence

- 7,310 simulations across 1,462 conditions (4 team tasks × varying budgets/visibility)
- Weakest-Link effort → accuracy (coordination transfers)
- Public Goods contribution → quality (pro-social investment transfers)
- Associations hold after IFEval controls — cooperation ≠ capability
- Game profiling cost: ~$5-10 per model vs thousands for full team evaluation

## Mechanism / Why

Cooperation is a behavioral disposition baked into training data and RLHF. Reasoning models develop strategic behavior (game-theoretic optimization) that makes them individually smarter but worse team players. This mirrors human findings in behavioral economics.

## Implications

### 1. Our single-model architecture sidesteps inter-model cooperation problems
All our agents are Claude — same cooperative profile. The intra-model cooperation variance comes from prompting/role, not model selection. DD-872's framework matters more if we add diverse models.

### 2. Validates H-193 (cooperative fitness screening)
The 6-game battery IS the cheap cooperative fitness screen H-193 proposed. If we ever evaluate alternative models, this is the screening protocol.

### 3. Strengthens H-075 (surface metrics mask breakdown)
DD-872 shows that capability metrics (IFEval) don't capture cooperation quality. Our experiment-completion metric (0.96) could mask degrading inter-agent cooperation, consistent with H-075. EXP-206 audit becomes more urgent.

### 4. Thinking models trade cooperation for strategy
This has implications for model selection: if we switch to a "reasoning" model variant, we may get better individual performance but worse multi-agent coordination. Monitor for this.

## Actionable

- If evaluating new models: run the 6-game cooperative profiling battery (~$5-10) before deployment
- Prioritize EXP-206 (H-075 coordination audit) — DD-872 provides theoretical grounding that our green metrics may hide cooperation decay
- Add DD-872 as evidence to H-192 and H-193 entries

## Open Questions

- Does intra-model cooperation vary by role/prompt? (We have one model in many roles)
- Would our system benefit from a periodic "cooperation health check" between agents?
