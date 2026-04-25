# KE-395: Agent Identity Confound — 80pp Performance Gap Between Agents on Same Task

**Source**: EXP-178 G1-A vs G1-B (2026-08-18)
**Confidence**: HIGH (15 trials per arm, consistent results)
**Concepts**: experimentation, agent-performance, confounds

## Finding

On the sql-injection gym scenario, tech-lead scored 80% (12/15) while coder scored 0% (0/15) on identical tasks. This 80pp gap means **agent identity is the dominant variable** in gym experiments — far larger than any treatment effect we typically measure (5-20pp).

## Implication

Experiments comparing treatments across different agents (or different agent versions) are confounded. All gym experiments must hold agent identity constant across arms. Cross-agent comparisons require explicit agent-identity controls.

## Prescription

1. Fix agent identity per experiment — never compare treatment arms run with different agents
2. When reporting results, always state which agent was used
3. Expected baselines differ radically by agent — establish per-agent baselines before treatment experiments
