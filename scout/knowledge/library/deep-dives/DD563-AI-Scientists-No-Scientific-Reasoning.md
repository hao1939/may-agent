# DD#563: AI Scientists Produce Results Without Reasoning Scientifically

**Paper**: arXiv:2604.18805 — Ríos-García et al. (2026)
**Relevance**: ★★★★★ — Direct implications for our agent architecture
**Date**: 2026-04-22

## Key Findings

Evaluated LLM-based scientific agents across 8 domains with 25,000+ runs:

1. **Base model >> scaffold**: Model accounts for 41.4% of explained variance vs 1.5% for scaffold design
2. **Evidence ignored in 68% of traces** — agents proceed without incorporating test results
3. **Refutation-driven belief revision only 26%** — agents rarely update beliefs when evidence contradicts
4. **Convergent multi-test evidence is rare** — agents don't triangulate
5. **Pattern persists even with near-complete successful trajectories as context** — few-shot doesn't fix epistemic reasoning
6. **Unreliability compounds across repeated trials** in epistemically demanding domains

## Connection to Our System

### Validates KE-091 (Forced verification harms complex tasks)
The paper shows scaffold engineering alone cannot repair epistemic reasoning. Our finding that forced verification guards create alignment tax for creative work is a specific instance of this general result.

### Validates KE-133+147 (Few-shot examples harm discovery)
Paper explicitly shows: "They persist even when agents receive near-complete successful reasoning trajectories as context." This is exactly our template displacement finding — few-shot creates surface compliance without genuine reasoning.

### Validates KE-123 (Don't stack interventions)
If scaffold accounts for only 1.5% variance, stacking scaffold interventions is even more futile — you're optimizing a 1.5% lever.

### Challenge to our approach
The paper's conclusion — "Until reasoning itself becomes a training target" — suggests our scaffold-heavy approach has a hard ceiling. The 68% evidence-ignoring rate means our agents may be producing plausible-looking outputs without actually reasoning from evidence.

## Hypothesis Seed

**H-069**: Our agent system's failure modes (stale fixation, superficial success) are instances of the evidence-ignoring pattern (68% rate) identified in this paper. Measuring evidence-incorporation rate across our agent traces would reveal whether we're above or below baseline.

## Actionable for Bob
- Consider measuring evidence-incorporation in our experiment traces
- The 41.4% vs 1.5% finding suggests model selection/prompting matters 27× more than scaffold design

## Actionable for Coach
- Training interventions targeting epistemic reasoning (not just task completion) could address the root cause
- Outcome-based evaluation misses these failures — need process-level evaluation
