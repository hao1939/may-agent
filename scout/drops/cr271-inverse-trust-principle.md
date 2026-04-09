# CR#271: The Inverse Trust Principle — When Good Information Goes Bad

**Date:** 2026-04-03
**Rating:** ★★★★★ SYNTHESIS
**Connects:** DD#488 (Free Information) + DD#489 (ClawSafety) + DD#424 (DynaTrust) + DD#484 (OrgAgent) + DD#485 (CASCADE) + CR#270 (Structure×Scope) + DD#479 (Reliability Limits)

## The Pattern

Two papers from today's batch independently reveal the same deep pattern: **the most helpful, most trusted information pathways are the most dangerous.**

### Paper 1: DD#488 — Free Information Disrupts Bayesian Crowds
Free public information (newspapers, shared signals) is individually helpful — each agent makes better decisions with more info. But the SAME information makes agents' beliefs MORE correlated. This correlation destroys the "wisdom of crowds" effect. The crowd's collective accuracy degrades even as each individual improves.

**Translation for MAS:** Shared context windows, broadcast messages, and common knowledge bases are the MAS equivalent of "free public information." They help each agent but hurt the system.

### Paper 2: DD#489 — ClawSafety: Safe LLMs, Unsafe Agents
Skill instruction files — the HIGHEST trust channel in an agent's deployment stack — have the highest attack success rate. The more trusted the input channel, the more dangerous it is, because the model applies less scrutiny.

**Translation for MAS:** Governance policies, system prompts, and skill definitions are the attack surface of maximum leverage precisely BECAUSE they're maximally trusted.

## The Inverse Trust Principle

Combining both findings yields a new principle:

> **The channels and information sources that provide the most value are also the ones that create the most systemic risk.** Trust is an attack surface. Common knowledge is a correlation bomb. The most helpful input is the most dangerous input.

This is NOT a paradox that can be "resolved" — it's a fundamental tradeoff. Every design decision involves this tension:

| Design Choice | Individual Benefit | Systemic Risk |
|---|---|---|
| Shared knowledge base | Better individual decisions | Belief correlation → crowd failure |
| Trusted skill files | Efficient tool use | Highest attack success rate |
| Broadcast communication | Information dissemination | Correlation + injection blast radius |
| Hierarchical governance | Clear authority | Single point of trust compromise |
| Common training data | Consistent behavior | Homogeneous failure modes |

## Connections to Prior Work

### DD#479 (Reliability Limits)
The "no free lunch" theorem proved multi-agent ≤ centralized Bayes without new exogenous signals. DD#488 STRENGTHENS this: even WITH new exogenous signals (the "free information"), the crowd degrades because agents over-weight common signals relative to private ones.

### CR#270 (Structure × Scope)
The convergent architecture (OrgAgent hierarchy + CASCADE scope budgets) now needs a THIRD dimension: **information diversity**. Structure × Scope × Diversity. Without diversity (ensuring agents maintain heterogeneous private information), the Structure × Scope framework is vulnerable to the correlation attack from DD#488.

### DD#424 (DynaTrust)
DynaTrust's trust evolution is exactly the kind of "trusted channel" that ClawSafety shows is most exploitable. If an adversary compromises DynaTrust's policy definitions (the highest-trust layer), the entire trust infrastructure inverts.

### DD#484 (OrgAgent)
OrgAgent's compliance layer is a trusted checkpoint — but if the compliance agent's instructions are poisoned (the skill-file attack from ClawSafety), it becomes an amplifier of harm rather than a filter.

## The Updated Architecture Formula

Previous: `MAS_Quality = Structure(authority) × Scope(communication) × TaskFit`

Updated: `MAS_Quality = Structure(authority) × Scope(communication) × Diversity(information) × TaskFit`

Where Diversity measures the heterogeneity of agents' information sources, belief states, and decision heuristics. Too little diversity → DD#488 correlation failure. Too much diversity → coordination failure. The optimum is in the middle.

## Predictions

- **P167**: MAS architectures will increasingly implement "information diversity budgets" — deliberately restricting how much common information agents share, analogous to CASCADE's communication budgets
- **P168**: The inverse trust principle will be named and formalized in a security paper within 12 months — applying maximum scrutiny to maximum-trust channels
- **P169**: At least one major MAS deployment failure will be attributed to belief correlation from shared context — the "free information" problem in production

## Hypothesis

**H-048: The Diversity-Correlation Tradeoff**
In any MAS with N agents sharing K common information sources and each holding M private signals, the optimal K/M ratio decreases as N increases. Larger multi-agent systems need LESS shared information per agent, not more, to maintain collective accuracy. This is counter-intuitive because the natural instinct is to share more as systems grow.
