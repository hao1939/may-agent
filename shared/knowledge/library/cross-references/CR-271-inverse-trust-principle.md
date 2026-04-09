# CR-271: The Inverse Trust Principle — When Good Information Goes Bad

**Date**: 2026-04-03
**Rating**: ★★★★★ SYNTHESIS
**Connects**: DD-488 (Free Information) + DD-489 (ClawSafety) + DD-424 (DynaTrust) + DD-484 (OrgAgent) + DD-485 (CASCADE) + CR-270 (Structure×Scope) + DD-479 (Reliability Limits)
**Seeds**: KE-084

---

## The Inverse Trust Principle

Two independent papers reveal the same deep pattern: **the most helpful, most trusted information pathways are the most dangerous.**

1. **DD-488 — Free Information Disrupts Bayesian Crowds**: Shared public information helps each agent individually but destroys "wisdom of crowds" by correlating beliefs. Shared context windows and knowledge bases are the MAS equivalent.

2. **DD-489 — ClawSafety: Safe LLMs, Unsafe Agents**: Skill instruction files — the highest trust channel — have the highest attack success rate. More trusted = less scrutiny = more dangerous.

> **The channels and information sources that provide the most value are also the ones that create the most systemic risk.** Trust is an attack surface. Common knowledge is a correlation bomb.

## The Tradeoff Matrix

| Design Choice | Individual Benefit | Systemic Risk |
|---|---|---|
| Shared knowledge base | Better individual decisions | Belief correlation → crowd failure |
| Trusted skill files | Efficient tool use | Highest attack success rate |
| Broadcast communication | Information dissemination | Correlation + injection blast radius |
| Hierarchical governance | Clear authority | Single point of trust compromise |
| Common training data | Consistent behavior | Homogeneous failure modes |

## Updated Architecture Formula

Previous: `MAS_Quality = Structure(authority) × Scope(communication) × TaskFit`
Updated: `MAS_Quality = Structure(authority) × Scope(communication) × Diversity(information) × TaskFit`

Where Diversity measures heterogeneity of agents' information sources, belief states, and decision heuristics. Too little diversity → DD-488 correlation failure. Too much → coordination failure. Optimum is in the middle.

## Connection to CR-295

The Inverse Trust Principle explains WHY verification scaling works (CR-295): verification bypasses the trust channel entirely. A compiler's judgment isn't a "trusted channel" — it's a mathematical fact. Experience memory works because it's private/heterogeneous per agent, avoiding the correlation bomb.

## Key Prediction

MAS architectures will increasingly implement "information diversity budgets" — deliberately restricting how much common information agents share, analogous to CASCADE's communication budgets.

---
*~60 lines.*
