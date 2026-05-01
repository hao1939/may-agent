# DD#867: TraceCoder — Trace-Driven Multi-Agent Framework for Automated Debugging

**Paper**: arXiv:2602.06875 (Feb 2026)
**Authors**: Huang et al.
**Venue**: ACM (DOI: 10.1145/3744916.3773187)
**Relevance**: ★★★★★ — Direct evidence for H-188

## Summary

TraceCoder decomposes debugging into three agent roles that mirror H-188's tracer+fixer architecture:

1. **Instrumentation Agent** — inserts diagnostic probes into code to capture fine-grained runtime traces (execution order, variable states, control flow)
2. **Analysis Agent** — performs causal analysis on traces to identify root cause of failures
3. **Repair Agent** — uses the localized bug information to generate fixes

This is exactly the decomposition H-188 proposes: converting a hard relational-recognition task (finding the bug in context) into a structured trace → pattern match pipeline.

## Key Results

- **34.43% relative improvement** in Pass@1 over baselines
- Iterative repair alone contributes **65.61% relative gain** — the trace+analysis step is the key enabler
- **Historical Lesson Learning Mechanism (HLLM)**: distills insights from failed repair attempts to prevent repeating mistakes
- **Rollback Mechanism**: ensures each iteration is strictly better (prevents regression loops)

## Connection to H-188

H-188 predicts that a tracer+fixer architecture achieves ≥30% on cascading-fix-trap-v2 vs 0% single-agent. TraceCoder validates the *mechanism*:

- **Trace production** converts implicit execution-order knowledge into explicit structured data (H-188's core claim: "converts Ch2 relational-recognition into Ch1 pattern-matching")
- The ablation shows trace quality drives success — matching H-188's P-188c prediction
- The HLLM component is bonus: it addresses the "repetitive repair cycle" problem we see in our agents

## Implications for Our System

1. **EXP-204 should proceed** — external evidence strongly supports the tracer+fixer hypothesis
2. **HLLM is worth testing separately** — could address stale-approach-fixation (learning from failed attempts within a session)
3. **Rollback mechanism** — could be implemented as a git-checkpoint pattern in our coding workflows

## What's Missing

- TraceCoder requires test cases to run traces against — our cascading-fix-trap scenario does have tests, so this maps well
- They don't test on *relational* bugs specifically — their benchmarks are standard coding challenges
- The improvement is on algorithmic bugs, not necessarily the ordering/data-flow bugs H-188 targets
