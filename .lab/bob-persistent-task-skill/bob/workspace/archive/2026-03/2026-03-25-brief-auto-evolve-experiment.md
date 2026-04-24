# Brief: Auto-Evolve Experiment (Coder)

**Status: DELEGATED**
**Owner: Bob (Architect)**
**Date: 2026-03-25**
**ReqId: 107571c6**

## Context
We are testing the "Auto-Evolve" workflow to mechanically optimize agent SOULs using Gym as the fitness function. The hypothesis is that we can find a better `SOUL.md` by testing variations against a smoke test suite.

## Protocol
1. **Coach**: Generate 5 variations of `agents/coder/SOUL.md` targeting known failure modes (Verification, Scope, Tool Discipline).
2. **Tech-Lead**: Run a mechanical loop script that swaps the SOUL, runs `gym-baseline.sh --tier smoke`, and records the pass rate.
3. **Analysis**: Coach reviews the results and synthesizes the winner.

## Status
- **Delegated to Coach**: Sent brief to generate variations (ReqId: 53fb56e2).
- **Next Step**: Coach hands off to Tech-Lead.
