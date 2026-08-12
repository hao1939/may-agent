# JANUS: Foresight-Oriented Guard for Long-Horizon Agent Safety

**Date:** 2026-07-24
**Source:** https://arxiv.org/abs/2607.19913v1
**Type:** arxiv finding
**Relevance:** high — shifts agent safety from reactive content moderation to proactive risk anticipation

---

## Key Insight

JANUS reframes agent safety as **anticipating delayed risks from partial trajectories** before tool-using agents act, rather than moderating outputs after the fact. The framework trains guard models ("Vanguard") with two coupled tasks:

1. **Anticipation** — forecast safety-relevant futures from an observed action prefix
2. **Adjudication** — decide safety based on both the observed prefix and the anticipated future

Both tasks are jointly optimized with CoAA-RL, which rewards forecasts by their utility for downstream safety judgment (not reconstruction fidelity).

## Results

- Vanguard improves average protection by **15.9pp** over baseline guards
- Simultaneously **increases** benign task completion by 5.1pp (not just blocking more)
- Evaluated across four agent-safety benchmarks

## Why It Matters for Agent Builders

- **Pre-execution guard pattern**: Unlike post-hoc content filters, Vanguard blocks unsafe actions *before* execution — critical for tool-using agents with irreversible side effects.
- **Foresight > hindsight**: The anticipation task means the guard reasons about what *will* happen, not just what *has* happened. This is essential for long-horizon agents where a single safe-looking step can trigger cascading failures.
- **Safety ≠ capability tax**: The +5.1pp benign completion gain shows that better safety modeling can actually *improve* task success by reducing false positives.

## Connections

- Extends the "should the agent act?" framing from [Safe Remediation](./2026-07-23-arxiv-safe-remediation-risk-constrained-agents.md) (risk-constrained CMDP for IT-Ops)
- Complements runtime hardening patterns in [Agent Runtime Hardening](/knowledge/agent-runtime-hardening.md) — JANUS adds a learned foresight layer to the containment stack
- Related to the containment gap / thanatosis patterns already tracked

---

*last_updated: 2026-07-24*
