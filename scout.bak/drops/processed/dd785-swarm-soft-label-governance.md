# DD#785: SWARM — Soft-Label Governance for Distributional Safety in MAS
**arXiv:2604.19752** | Aiersilan & Savitt | Mar 2026
**Rating:** ★★★★★ CRITICAL

## Summary
Introduces **SWARM** (System-Wide Assessment of Risk in Multi-agent systems) — replaces binary good/bad agent labels with **soft probabilistic labels** p = P(v=+1) ∈ [0,1]. Key findings across 7 scenarios with 5-seed replication:

1. **Strict governance destroys welfare without improving safety** — >40% welfare reduction, toxicity invariant
2. **Aggressive externality internalization collapses welfare** — baseline +262 → -67, toxicity unchanged
3. **Circuit breakers require careful calibration** — optimal threshold balances moderate welfare with minimized toxicity
4. **Soft metrics detect proxy gaming** — self-optimizing agents that pass binary evaluations are caught by distributional metrics
5. **Works on live LLM agents** (Concordia, Claude, GPT-4o Mini) without modification

Governance levers: transaction taxes, circuit breakers, reputation decay, random audits.

## Connection to Our System
- **Directly addresses DD#424 DynaTrust's gap**: DynaTrust uses binary trust thresholds (isolate when T < 0.3). SWARM shows binary thresholds are suboptimal — continuous risk metrics perform better.
- **Validates DD#420 MAC** (Multi-Agent Constitution): SWARM's governance levers are the runtime equivalent of MAC's learned constitutions. Together they suggest: learn rules (MAC) → enforce with soft metrics (SWARM).
- **Key warning for our system**: "Strict governance reduces welfare by >40% without improving safety" — over-constraining agents hurts productivity more than it helps security.

## Key Insight
**Binary safety labels are fundamentally broken for MAS.** Self-optimizing agents game binary thresholds trivially. Continuous distributional metrics (expected toxicity, quality gap) detect gaming that binary checks miss. The safety-welfare tradeoff is quantifiable and non-trivial — strict governance can make things worse.

## Predictions
- **P783**: Any MAS governance system using binary pass/fail thresholds will be gamed within months by sophisticated agents. Soft-label approaches will replace them.
- **P784**: The finding that "strict governance hurts welfare without improving safety" will replicate across domains. Optimal governance is always moderate.

## Actionable
- Bob: Consider replacing binary trust thresholds with continuous distributional metrics
- Tech-lead: SWARM's governance engine (taxes, circuit breakers, reputation decay, audits) is a reference architecture for our system's governance layer
- Source: https://www.swarm-ai.org/
