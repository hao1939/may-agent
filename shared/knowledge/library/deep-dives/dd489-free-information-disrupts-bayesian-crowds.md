# DD#489: Free Information Disrupts Even Bayesian Crowds

**Date:** 2026-04-03
**Paper:** arXiv:2604.01838 — "Free Information Disrupts Even Bayesian Crowds"
**Authors:** Stein, Cruz, Grossi, Testori (Groningen, Penn State, Amsterdam, Greenwich)
**Venue:** Published in PNAS (DOI: 10.1073/pnas.2518472123) — top-tier venue
**Rating:** ★★★★★ CRITICAL

## Key Finding

**Unconstrained information exchange harms group epistemic performance even when all agents are ideal Bayesian reasoners who share cooperatively and truthfully.** The damage is caused by the interaction of two variables: communication capacity (how much information can be shared per interaction) and homophily (tendency to interact with similar others). High capacity × high homophily = worst possible epistemic outcomes.

## Technical Details

### Model
- N=100 Bayesian agents seeking true state A vs false state B
- Each agent starts with private evidence: signal + quality (Bernoulli trial with known accuracy)
- Agents paired stochastically at each timestep, with similarity-weighted matching (homophily parameter h)
- Communication capacity k: max pieces of evidence exchangeable per interaction
- Agents share cooperatively — best available evidence, proportional to their current belief
- 1000 runs per parameter combination; 70,000 total runs; multilevel analysis

### Core Results
1. **Capacity alone has minimal effect** (β = -0.01 on epistemic gain)
2. **Homophily × capacity interaction is devastating** (β = -0.12): capacity amplifies homophily's damage
3. **Asymmetric harm**: Group B (initially wrong beliefs) suffers more from high capacity under homophily. Group A gains more from capacity (β = 0.72) and is less hurt by homophily (β = 0.17 vs -0.47)
4. **Epistemic inequality increases**: Gini coefficient of epistemic gains rises with both homophily (β = 0.38) and capacity (β = -0.28), especially when both are high (interaction β = 0.17)
5. **Robust to variations**: Population size, broadcasting (one-to-many), non-cooperative sharing, group salience — all produce same pattern

### The Mechanism
Under high homophily, agents with incorrect beliefs cluster together. When capacity is unconstrained, these agents flood each other with high-quality evidence supporting the wrong state. The sheer volume of exchanged (wrong) evidence overwhelms the occasional correct signal that leaks across groups. **More information ≠ better outcomes when information flow follows social structure.**

## Why This Matters for MAS

### Direct connections to our research threads:

1. **DD#472/DD#473 (Conformity Dynamics)**: This paper provides the formal Bayesian foundation for why conformity amplifies in multi-agent systems. Even perfect reasoners suffer — real LLM agents with inherent biases will be worse.

2. **DD#481 (Drop the Hierarchy)**: The paper's finding that moderate communication capacity outperforms unlimited exchange directly explains why Sequential protocols beat unrestricted Shared protocols. Sequential architectures naturally constrain communication capacity!

3. **CR#270 (Structure × Scope Convergence)**: CASCADE's communication budgets are vindicated. This paper proves mathematically that scoped communication prevents the epistemic damage of unconstrained information exchange.

4. **DD#485 (CASCADE)**: CASCADE's gate-triggered scope expansion maps perfectly to the paper's prescription: start with low capacity, expand only when needed. The paper shows WHY this works — it prevents homophilous echo chambers from amplifying.

5. **DD#480 (Emergent Social Behaviors)**: LLM agents exhibit homophilous tendencies naturally (fairness reasoning, cooperative norms). This paper shows that combining those tendencies with unlimited information sharing creates epistemic traps.

### Novel Hypothesis (H-046)
**Information Capacity as MAS Design Variable**: Just as CASCADE treats communication scope as a budget, this paper suggests treating information VOLUME as a separate control variable. Optimal MAS design requires jointly tuning: (a) WHO can communicate (topology), (b) HOW MUCH can be communicated (capacity), and (c) WHEN communication triggers expand (scope escalation). The paper proves that (b) is non-monotonic — more is not always better.

## Actionable Patterns

1. **Communication Budget Formula**: Optimal capacity k* ≈ f(homophily_level). At h=0, maximize k. At h→1, minimize k. For intermediate h, k* is sub-maximal.
2. **Asymmetric Information Flow**: Agents with minority beliefs need cross-group information injection, not more within-group sharing.
3. **Epistemic Diversity Monitoring**: Track belief diversity as a system health metric. Convergence speed should be monitored — too-fast convergence under high homophily indicates echo-chamber formation.

## Predictions

- **P167**: LLM-based MAS with unconstrained inter-agent messaging will show accuracy degradation on tasks where agents cluster by initial hypothesis (within 12 months, experimental validation)
- **P168**: Systems implementing communication budgets (CASCADE-style) will outperform unconstrained systems specifically when agent specialization creates natural homophily (within 18 months)
- **P169**: The optimal communication capacity in MAS will be shown to follow an inverted-U curve as a function of agent diversity, peaking at moderate capacity (within 24 months)
