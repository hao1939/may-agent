# CR#316 — The Agent Software Engineering Stack: From Architecture to Testing

**Rating**: ★★★★★ CRITICAL SYNTHESIS
**Sources**: DD#639 (ABTest), DD#640 (Scaffold Taxonomy), DD#641 (AgenticFlict), DD#642 (TRACE), DD#643 (DebugHarness), DD#636 (Beyond Fixed Tests)

## Thesis

A complete Agent Software Engineering stack is crystallizing in the literature. Five papers from a single arXiv batch (cs.SE, April 7 2026) collectively define the layers:

| Layer | Paper | Function |
|-------|-------|----------|
| **Architecture** | DD#640 (Scaffold Taxonomy) | What agents are made of — 5 composable loop primitives, 12 dimensions, 3 layers |
| **Perception** | DD#642 (TRACE) | How agents understand code — trust allocation, blind spots, artifact conflicts |
| **Execution** | DD#643 (DebugHarness) | How agents interact with runtime — dynamic probing, hypothesis testing |
| **Collaboration** | DD#641 (AgenticFlict) | How agents work together — 27.67% merge conflict rate quantifies coordination cost |
| **Testing** | DD#639 (ABTest) | How we test agents — behavioral fuzzing, 47 interaction patterns, 128 action types |

## The Emerging Stack

This isn't random. These papers form a coherent engineering discipline:

1. **Build** (DD#640): Choose your loop primitives, tool surface, context strategy
2. **Perceive** (DD#642): Your agent will over-trust docs and miss code drift — design for it
3. **Execute** (DD#643): Close the loop with runtime feedback, not static reasoning
4. **Coordinate** (DD#641): Multi-agent work costs 27.67% in merge conflicts — budget for it
5. **Test** (DD#639): Fuzz behavioral patterns, not just outputs

## Connection to GStack Architecture

This maps cleanly onto our existing research threads:
- **CR#301 (Harness Engineering)**: DD#639 + DD#643 = test harness + debug harness = the accountability layer
- **CR#307 (Decoction)**: DD#642 tells us what to decoct (trusted signals) and what to discard (code drift blind spots)
- **CR#314 (Three-Channel)**: DD#640's convergent/divergent split IS the channel separation
- **CR#315 (Robustness-Architecture)**: DD#639 + DD#635 operationalize robustness testing

## The Key Insight: Software Engineering 3.0

DD#641 explicitly uses the phrase "Software Engineering 3.0" — agents as active contributors, not just tools. The engineering discipline must evolve:
- SE 1.0: Humans write code
- SE 2.0: Humans use AI to write code (copilot)
- SE 3.0: AI agents write code, humans orchestrate and verify

Each transition requires new testing infrastructure, new coordination protocols, and new trust models. All five papers address exactly this.

## Prediction

Within 12 months, these separate threads will converge into an integrated agent engineering platform that combines scaffold composition (DD#640), behavioral testing (DD#639), trust-aware perception (DD#642), and merge-aware coordination (DD#641). The closest existing thing is SWE-bench + agent scaffolds, but that's 1% of what's needed.

## Tags
`agent-engineering` `synthesis` `software-engineering-3.0` `testing` `architecture` `coordination` `trust`
