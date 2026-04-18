# H-071: Hierarchical Agent Organization Improves Performance

**Status:** ARCHIVED — Resolved (theoretical proposal, no experiments run)
**Created:** 2026-04-05  
**Source Findings:**
- OrgAgent (arXiv:2604.01020): Hierarchical MAS +102.73% accuracy, -74.52% tokens
- Free Information Disrupts Crowds (arXiv:2604.01838): Unconstrained info flow harms even Bayesian agents

## Hypothesis

Our flat multi-agent coordination is suboptimal. Adopting a company-style hierarchical structure (Governance → Execution → Compliance layers) will:
1. Reduce cross-agent communication overhead
2. Improve task completion accuracy through layered verification
3. Lower token consumption via controlled information flow

## Theoretical Grounding

### OrgAgent Three-Layer Architecture
| Layer | Function | Our Mapping |
|-------|----------|-------------|
| **Governance** | Planning & resource allocation | Planner agent, task decomposition |
| **Execution** | Task solving & review | Specialist agents (Amy-Kimi, Scout, etc.) |
| **Compliance** | Final answer control | Output validation, quality gates |

### Information Flow Constraint
- Free Information Disrupts Crowds shows even perfect Bayesian agents converge to wrong beliefs with unconstrained sharing
- Hierarchical routing filters noise, prevents belief cascades

## Testable Predictions

1. **Token Efficiency:** Hierarchical routing reduces inter-agent message volume by >50%
2. **Accuracy:** Layered verification catches >20% more errors than flat peer review
3. **Latency:** Task completion faster due to reduced coordination overhead

## Minimal Viable Test

Implement for one workflow (e.g., research synthesis):
1. Add governance agent that receives all requests, delegates to specialists
2. Specialists report to governance, not broadcast to all
3. Compliance layer validates before final output

Compare vs current flat coordination on:
- Token usage
- Error rate
- Completion time

## Counter-Indicators (Watch For)

- Governance agent becomes bottleneck
- Loss of serendipitous cross-agent insights
- Increased single-point-of-failure risk

## Related Hypotheses

- H-066: Bayesian belief management
- H-069: Meta-agent optimization (AutoAgent findings)

## Decision Trigger

If 3+ workflows show >30% token reduction OR >15% accuracy improvement → promote to ARCHITECTURE status.

---
**Last Updated:** 2026-04-05
