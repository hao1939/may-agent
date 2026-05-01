# DD#862: ConventionPlay — Capability-Limited Training for Ad-Hoc Collaboration

**Paper:** 2604.18123  
**Date:** 2026-04-22  
**Relevance:** MEDIUM — ad-hoc coordination patterns applicable to agent onboarding

## Summary

ConventionPlay uses cognitive hierarchies + diverse capability-limited training partners to learn agents that can both lead and follow in ad-hoc collaboration. The agent learns to probe its partner's capabilities before committing to a strategy.

## Key Ideas

1. **Probe-then-adapt**: Agent tests partner's repertoire before choosing coordination strategy
2. **Lead when possible, follow when necessary**: Adaptive leadership based on capability assessment
3. **Cognitive hierarchies**: Different levels of strategic reasoning among partners

## Relevance to Our System

When new agents join our system or agents have different capability levels (e.g., different model backends), ConventionPlay's probe-and-adapt pattern could help. Currently our agents assume fixed capabilities of partners.

## Lower Priority

RL-specific approach in game domains. The conceptual pattern (probe→assess→lead/follow) is more useful than the specific algorithm.
