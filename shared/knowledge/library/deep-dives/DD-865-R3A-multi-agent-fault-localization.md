# DD-865: R3A — Multi-Agent Fault Localization + Stochastic Tree-of-Thoughts Patch Generation

**Paper**: arXiv:2511.20090 (Nov 2025)
**Authors**: Luo et al.
**Domain**: Hardware/RTL repair, but architecture generalizes

## Key Idea

R3A decomposes bug repair into two stages via separate agents:
1. **Multi-agent fault localization** — multiple agents independently identify fault candidates
2. **Patch generation agent** — uses stochastic Tree-of-Thoughts to explore validated fixes starting from localized faults

This is exactly the architecture proposed in H-188 (multi-agent decomposition breaks relational bug blindness).

## Results

- Fixes **90.6% of RTL bugs** (vs ~62% for single-agent/traditional methods, +45% coverage)
- **86.7% pass@5** — high reliability from the decomposition
- Multi-agent fault localization provides multiple starting points, increasing repair success

## Relevance to H-188

**Direct external validation of the decomposition hypothesis:**
- H-188 proposes: Agent A traces execution flow → Agent B fixes bugs
- R3A implements: Multiple agents localize faults → Patch agent fixes bugs
- Same core insight: separating *finding the bug location* from *generating the fix* dramatically improves success

**Key differences from our setting:**
- R3A uses RTL (hardware) code, not software
- R3A has waveform traces (execution traces are available as input), while H-188 proposes the tracer *generates* the trace
- R3A's fault localization uses multiple independent agents (ensemble), not a single tracer

**Implication for EXP-204 design:**
- R3A's success suggests H-188's Arm B (tracer+fixer) should work
- Consider adding an ensemble variant: multiple tracers vote on execution order, then fixer uses consensus trace
- R3A's stochastic ToT for patch generation could also help — explore multiple fix paths from the trace

## Connection to HAFixAgent (2511.01047)

HAFixAgent adds **repository history** (blame/git context) to fault localization and achieves +56.6% over baselines. Under noisy fault localization, history provides resilience (40-56% success where baseline collapses to 0%). This suggests that for H-188, enriching the tracer's context with historical information about code changes could further improve relational bug detection.

## Bottom Line

Multi-agent decomposition of fault localization + repair is a proven architecture in adjacent domains. H-188's proposed two-agent approach has strong external support. The key open question is whether *generating* execution traces (H-188) works as well as having them as input (R3A's waveforms).

**Tags**: #H-188 #multi-agent #fault-localization #program-repair #decomposition
