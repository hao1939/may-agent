# CR#316: The Agent Software Engineering Stack — From Architecture to Testing

**Date**: 2026-04-07
**Type**: Cross-reference synthesis
**Rating**: ★★★★★ CRITICAL SYNTHESIS
**Sources**: DD-639 (ABTest), DD-640 (Scaffold Taxonomy), DD-641 (AgenticFlict), DD-642 (TRACE), DD-643 (DebugHarness), DD-636 (Beyond Fixed Tests)

## Thesis

A complete Agent Software Engineering stack is crystallizing. Five papers from a single arXiv batch (cs.SE, April 7 2026) collectively define the layers:

| Layer | Paper | Function |
|-------|-------|----------|
| Architecture | DD-640 (Scaffold Taxonomy) | 5 composable loop primitives, 12 dimensions, 3 layers |
| Perception | DD-642 (TRACE) | Trust allocation, blind spots, artifact conflicts |
| Execution | DD-643 (DebugHarness) | Dynamic probing, hypothesis testing |
| Collaboration | DD-641 (AgenticFlict) | 27.67% merge conflict rate = coordination cost |
| Testing | DD-639 (ABTest) | Behavioral fuzzing, 47 interaction patterns, 128 action types |

## The Emerging Stack

1. **Build** (DD-640): Choose loop primitives, tool surface, context strategy
2. **Perceive** (DD-642): Over-trust docs, miss code drift — design for it
3. **Execute** (DD-643): Close loop with runtime feedback, not static reasoning
4. **Coordinate** (DD-641): Multi-agent work costs 27.67% in merge conflicts — budget for it
5. **Test** (DD-639): Fuzz behavioral patterns, not just outputs

## Software Engineering 3.0

- SE 1.0: Humans write code
- SE 2.0: Humans use AI to write code (copilot)
- SE 3.0: AI agents write code, humans orchestrate and verify

Each transition requires new testing infrastructure, coordination protocols, and trust models.

## Connections

- CR-301 (Harness Engineering): DD-639 + DD-643 = test + debug harness = accountability layer
- CR-307 (Decoction): DD-642 tells what to decoct (trusted signals) vs discard (drift blind spots)
- CR-314 (Three-Channel): DD-640's convergent/divergent split IS channel separation
- CR-315 (Robustness-Architecture): DD-639 + DD-635 operationalize robustness testing

## Prediction

Within 12 months, threads converge into integrated agent engineering platform combining scaffold composition, behavioral testing, trust-aware perception, and merge-aware coordination.

**Seeds KE-086.**
