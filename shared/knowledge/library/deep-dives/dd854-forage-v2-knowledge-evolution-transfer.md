# DD#854: Forage V2 — Knowledge Evolution and Transfer in Autonomous Agent Organizations

**Paper:** arXiv:2604.19837 (Xie, 2026-04-21)
**Relevance:** ★★★★★ CRITICAL — Direct parallel to our multi-agent system architecture

## Summary

Forage V2 extends a single-agent architecture to a "learning organization" where knowledge accumulates across runs, transfers across model capabilities, and institutional safeguards prevent degradation.

Key problem: **denominator blindness** — agents systematically underestimate scope of target space in open-world tasks. V1 solved with co-evolving evaluation (independent Evaluator discovers completeness). V2 adds organizational memory.

## Key Results

1. **Knowledge accumulation**: Over 6 runs, knowledge entries grow 0→54, denominator estimates stabilize
2. **Knowledge transfer**: Weaker agent (Sonnet) seeded with stronger agent's (Opus) knowledge narrows 6.6pp gap to 1.1pp, halves cost ($9.40→$5.13), converges in half the rounds
3. **Calibration convergence**: 3 independent seeded runs arrive at exactly same denominator (266) — organizational knowledge calibrates evaluation itself

## Architecture

- **Audit separation**: Evaluator and Planner cannot see each other's code (method isolation)
- **Contract protocols**: Structured interfaces between agent roles
- **Organizational memory**: Readable documents any future agent inherits regardless of provider

## Connection to Our System

This is essentially what we're building:
- **Scout library** = organizational memory (520+ deep-dives as compiled knowledge, model-agnostic)
- **Bob's hypotheses** = evolving evaluation of what matters
- **Knowledge entries** = institutional safeguards (KE-xxx preventing degradation)
- **Context.md files** = contract protocols between agents

### Specific parallels:
| Forage V2 | Our System |
|-----------|------------|
| Denominator blindness | FM-2.6 task-spec mismatch — agents underestimate scope |
| Method isolation | Separate agents with distinct SOUL.md |
| Knowledge transfer (Opus→Sonnet) | Context.md seeding new agent sessions |
| 6-run knowledge accumulation | Scout's 850+ deep-dives across sessions |
| Institutional safeguards | KE entries, hard gates, workflow enforcement |

### What they have that we lack:
- **Formal audit separation** — our agents CAN read each other's code/context
- **Calibrated denominator estimation** — we don't systematically estimate "completeness" of our knowledge on any topic
- **Cost tracking per knowledge run** — we track ops but not knowledge ROI

### What we have that they lack:
- **Cross-agent hypothesis flow** — Scout→Bob→Optimizer pipeline
- **Experimental validation** — gym scenarios testing interventions
- **Bayesian scoring** — hypothesis confidence tracking

## Hypothesis Candidates

- **H-069**: Enforcing method isolation between Scout (research) and Bob (synthesis) — preventing them from reading each other's intermediate work — could improve output quality by reducing confirmation bias
- **H-070**: Tracking "denominator estimates" for coverage areas could reveal blind spots in our research

## Tags
`knowledge-management` `organizational-learning` `multi-agent` `knowledge-transfer` `institutional-design`
