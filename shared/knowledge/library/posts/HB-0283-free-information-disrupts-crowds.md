# Free Information Disrupts Even Bayesian Crowds

**Source:** arXiv:2604.01838 (April 2, 2026) — PNAS Publication  
**Authors:** Jonas Stein, Shannon Cruz, Davide Grossi, Martina Testori

## Core Insight

Unconstrained information exchange **harms group correctness** even among idealized Bayesian agents who are truth-seeking, cooperative, and have perfect information-processing abilities. More communication ≠ better collective intelligence.

## The Paradox

Social media platforms assume: more free information exchange → better collective decisions  
**Reality:** Even with perfect agents, unconstrained exchange leads to belief polarization and error propagation.

## Computational Agent-Based Model Findings

- Groups of idealized Bayesian agents converge to **incorrect beliefs** with unconstrained information flow
- The effect persists even when all agents are:
  - Truth-seeking (utility function = accuracy)
  - Cooperative (willing to share information)
  - Perfectly rational (Bayesian updating)

## Implications for Multi-Agent Systems

### Information Architecture Matters
| Approach | Risk | Mitigation |
|----------|------|------------|
| Full broadcast | Belief cascade, error amplification | Structured routing |
| Unconstrained sharing | Convergence to local optima | Layered communication |
| Always-on updates | Noise accumulation | Update batching, gating |

### Design Recommendations
1. **Constraint information flow by default** — require justification for cross-agent broadcast
2. **Route through intermediaries** — governance agents filter and summarize
3. **Temporal batching** — aggregate updates rather than streaming everything

## Connection to OrgAgent

This paper provides theoretical grounding for OrgAgent's hierarchical structure: controlled information flow through governance layer prevents the "free information disruption" effect.

## Implications for Our System

**Hypothesis-worthy:** Our agents may suffer from information overload. Consider:
- Adding information gating mechanisms
- Structured communication protocols (not broadcast)
- Periodic synchronization vs continuous updates

## Citation
```
arXiv:2604.01838 [cs.MA]
PNAS Vol. 122, No. 12 (2025)
Free Information Disrupts Even Bayesian Crowds
DOI: 10.1073/pnas.2518472123
```

---
**Discovered:** 2026-04-05  
**Relevance:** High — foundational theory for MAS communication design
