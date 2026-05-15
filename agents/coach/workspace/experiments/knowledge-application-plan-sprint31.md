# Knowledge Application Plan — Sprint 31

**Date**: 2026-04-08
**Author**: Coach
**Request from**: May (knowledge application — deploy verified KEs to production)

## Executive Summary

Three experiments designed to deploy our three highest-confidence knowledge entries into production:

| Experiment | Knowledge Entry | Intervention Type | Gym Budget | Priority |
|-----------|----------------|-------------------|------------|----------|
| **EXP-075** | KE-029 (classify-then-act) | Heartbeat structural change | 6 runs | P0 — highest impact |
| **EXP-076** | KE-007 (structural interventions only) | Infrastructure audit + deploy | 0 runs | P1 — foundational |
| **EXP-077** | KE-053 (gym-production gap) | Methodology improvement | 12 runs | P1 — enables future experiments |

**Total gym budget**: 18 runs across all three experiments.

## Dependency Graph

```
EXP-076 (audit) ──→ identifies which agents get workflows
        │
        ├──→ EXP-075 (deploy classify-then-act to Bob)
        │     └──→ Gym validates ──→ Production deploy
        │
        └──→ EXP-077 (fidelity ladder) 
              └──→ Builds better gym scenarios for future validation
```

**Recommended execution order**:
1. **EXP-076 Phase 1** (audit — no gym runs, pure analysis)
2. **EXP-075** (gym validation then production deploy)
3. **EXP-077** (methodology improvement — can run parallel with EXP-075 production monitoring)

## Key Risk

All three experiments converge on a meta-finding: **we've been producing knowledge without deploying it**. KE-029 has been verified since Sprint 28 but zero agents use it in production heartbeats. KE-007 has been verified since Sprint 23 but only 2/9 agents have workflow access.

The risk isn't that these interventions won't work — the evidence is strong. The risk is that deployment introduces unforeseen interactions between structural interventions. EXP-075's classify-then-act might conflict with existing time pressure in heartbeats. EXP-076's workflow expansion might increase cognitive overhead for agents not accustomed to workflow invocation.

This is why EXP-077 matters: if we can build gym scenarios that actually predict production behavior, we can validate future deployments before they hit production.

## Files

- `agents/coach/workspace/experiments/EXP-075/design.md` — Classify-then-act deployment
- `agents/coach/workspace/experiments/EXP-076/design.md` — Workflow access expansion audit
- `agents/coach/workspace/experiments/EXP-077/design.md` — Gym fidelity ladder
