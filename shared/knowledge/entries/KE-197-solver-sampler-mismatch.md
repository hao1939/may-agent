# KE-197: Solver-Sampler Mismatch — Reasoning Strength Can Hurt System Outcomes

**Source**: DD-769 (arXiv 2604.11840, Andric, April 2026)
**Connections**: H-166 (recognition threshold), KE-195 (production-displacement), KE-196 (difficulty moderation)

## Insight

When the objective is to **sample plausible behavior** (not solve optimally), stronger reasoning capability makes outcomes *worse*. GPT-5.2 with native reasoning produces 45/45 authority decisions in negotiation — zero compromise. Bounded reflection recovers compromise in every case.

## Why This Matters for Our System

This is the theoretical frame for production-displacement (KE-195/196): our agents face a solver-sampler mismatch during verification-heavy tasks. The "solver" mode (verify exhaustively, reason deeply) displaces the "sampler" mode (produce diverse, contextually appropriate output). The model over-optimizes on verification correctness at the cost of production quality.

**Key implication**: The fix isn't "reason harder about verification" — it's *bound* the reasoning to leave capacity for production. This validates content-first guard designs (write first, verify after) over inline verification that competes with production.

## Actionable Principles

1. **Bound verification reasoning** — don't let it consume the full context window
2. **Separate solver and sampler phases** — produce first (sampler mode), verify second (solver mode)
3. **Diversity collapse as diagnostic** — if agent outputs become uniform, check for solver-mode dominance

## Tags
`reasoning-models` `production-displacement` `verification-design` `bounded-reflection`
