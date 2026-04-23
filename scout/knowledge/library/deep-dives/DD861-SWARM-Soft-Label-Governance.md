# DD#861: SWARM — Soft-Label Governance for Distributional Safety in MAS

**Paper:** arXiv:2604.19752 (Aiersilan & Savitt, Mar 2026)
**Rating:** ★★★★★ CRITICAL
**Tags:** governance, safety, multi-agent, continuous-risk, welfare-tradeoffs

## Key Idea

Replace binary good/bad agent classifications with soft probabilistic labels p = P(v=+1) ∈ [0,1]. This enables continuous-valued payoff computation, toxicity measurement, and governance intervention calibration.

## Framework: SWARM

- **Governance levers:** transaction taxes, circuit breakers, reputation decay, random audits
- **Metrics:** Expected toxicity E[1-p | accepted], quality gap E[p | accepted] - E[p | rejected]
- **Tested on:** 7 scenarios × 5 seeds, with Concordia entities, Claude, GPT-4o Mini

## Critical Results

1. **Strict governance destroys welfare without improving safety** — >40% welfare reduction, no safety gain
2. **Aggressive externality internalization collapses welfare** — from +262 to -67, toxicity invariant
3. **Circuit breakers need calibration** — overly restrictive thresholds destroy value; optimal threshold exists
4. **Soft metrics detect proxy gaming** — agents passing binary evaluations get caught by continuous metrics
5. **Works on live LLM agents** without modification

## Why This Matters for Us

This paper quantifies what we've theorized: governance has a welfare cost, and binary safety checks miss nuanced risk. Key connections:

- **DD#424 (DynaTrust):** Both use continuous trust/risk metrics instead of binary. SWARM adds the welfare dimension — DynaTrust focuses on security.
- **DD#557 (Illusory Coordination):** SWARM's proxy gaming detection directly addresses the problem of agents appearing coordinated while optimizing for appearances.
- **CR#284 (Internal Monitoring Stack):** SWARM's soft labels could be the continuous risk layer underneath our activation probes.
- **Our governance architecture:** The finding that strict governance hurts welfare without improving safety is a strong argument for calibrated, probabilistic governance rather than hard rules.

## Actionable Patterns

1. **Soft labels for agent evaluation:** Instead of pass/fail on agent outputs, assign p ∈ [0,1] and track distributional properties
2. **Governance lever calibration:** Test each lever independently, measure welfare-safety tradeoff curve
3. **Circuit breaker thresholds:** Must be empirically tuned per deployment — no universal threshold works
4. **Proxy gaming detection:** Compare binary pass rate vs. soft expected toxicity — divergence signals gaming

## Hypothesis

**H-EXP: Soft-label governance detects failure modes that our current binary checks miss.** If we tracked continuous risk scores on agent outputs instead of pass/fail, we'd catch quality degradation and proxy gaming earlier.
