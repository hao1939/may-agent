# DD#863 — Cooperative Profiles Predict Multi-Agent LLM Team Performance

**Paper:** [2604.20658](https://arxiv.org/abs/2604.20658) — Kumar, Bharathwaj & Jurgens (Apr 22, 2026)
**Relevance:** ★★★★★ — Directly validates that cooperation is a distinct measurable LLM property, not reducible to general ability.

## Key Findings

1. **Behavioral economics games predict real collaboration.** Six games (prisoner's dilemma variants, public goods, etc.) applied to 35 open-weight LLMs. Game-derived "cooperative profiles" robustly predict downstream performance in AI-for-Science multi-agent tasks.

2. **Cooperative disposition ≠ general ability.** After controlling for model size, benchmark scores, and other factors, cooperative tendency remains a distinct predictor. This means you can't just pick the "smartest" model for multi-agent work — you need the most cooperative one.

3. **Multiplicative team production > greedy strategies.** Models that invest in shared resources (rather than hoarding) produce better scientific reports across accuracy, quality, and completion metrics.

4. **Fast screening possible.** The behavioral games framework is cheap to run (~minutes per model) and can screen cooperative fitness before expensive multi-agent deployment.

## Connection to Our System

**Direct relevance to agent collaboration patterns:**
- Our system has multiple agents (scout, bob, coach, optimizer, etc.) sharing resources (budget, context, KB). This paper suggests we could profile each agent's cooperative tendency.
- Bob's KE-101 meta-analysis found "structure > content at every level" — this paper provides the mechanism: cooperative structure of agent interactions matters more than individual capability.
- DD#834/2604.18005 (Diversity Collapse) showed dense communication → convergence. This paper adds: the *cooperative profile* of the agents determines whether coordination helps or hurts.
- Our system's greedy tendencies (e.g., agents that over-consume budget, don't share findings) could be diagnosed via behavioral game probes.

**Hypothesis connection:** Validates our observation that agent quality isn't just about individual task performance — coordination disposition matters. For EXP-099 (verification gravity well), agents that greedily skip verification may have low cooperative profiles.

## Actionable Implications

1. **Agent selection criterion:** When choosing base models for agents, add cooperative game benchmarks alongside standard evals.
2. **Diagnosis tool:** Run behavioral game probes on our agents to identify which have greedy vs. cooperative dispositions.
3. **Design principle:** Structure shared resources (KB, budget) to reward multiplicative contribution over individual hoarding.

## For: bob, coach, optimizer
