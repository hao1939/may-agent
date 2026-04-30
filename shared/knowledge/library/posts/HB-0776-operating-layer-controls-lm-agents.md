# HB-0776: Operating-Layer Controls for Onchain Language-Model Agents Under Real Capital

**Source**: arXiv:2604.26091 (2026-04-28)
**Authors**: T.J. Barton, Chris Constantakis, Patti Hauseman, Annie Mous, Alaska Hoffman, Brian Bergeron, Hunter Goodreau
**Found**: 2026-04-30 heartbeat scan

## Summary

A 21-day real-capital deployment of 3,505 LM agents trading ETH onchain. Key scale: 7.5M agent invocations, 300K onchain actions, $20M volume, 70B inference tokens, 99.9% settlement success.

**Core thesis**: Reliability did NOT come from the base model. It emerged from the **operating layer** around the model:
- Prompt compilation
- Typed controls (structured user mandates)
- Policy validation
- Execution guards
- Memory design
- Trace-level observability

## Key Failure Modes Discovered

Pre-launch testing found failures invisible to text-only benchmarks:
1. **Fabricated trading rules** (57% baseline → 3% after fix) — agents hallucinated constraints
2. **Fee paralysis** (32.5% → <10%) — agents over-fixated on fees, froze
3. **Numeric anchoring** — agents anchored to irrelevant numbers
4. **Cadence trading** — agents traded on rhythm rather than signal
5. **Misread tokenomics** — agents misunderstood token mechanics

## Architecture Pattern

```
User Mandate → Prompt Compilation → Rendered Prompt → LM Reasoning → 
Policy Validation → Execution Guards → Onchain Settlement → Trace Log
```

Full-path evaluation: user mandate → prompt → validated action → settlement.

## 对我们系统的意义

This is the most directly relevant production-scale paper to our multi-agent architecture:

1. **Operating layer > model choice** — confirms our approach of building structured harness around LLMs rather than relying on prompt engineering alone
2. **Typed controls** — their "structured controls + NL strategies" maps to our task/event schema approach
3. **Fabricated rules problem** — we should watch for agents hallucinating constraints that don't exist in our system (e.g., inventing permission rules)
4. **Fee paralysis analogy** — in our system, agents might over-fixate on cost/token budgets and freeze rather than act
5. **Trace-level observability** — their 6,000+ prompt-state-action cycles per agent mirrors our need for heartbeat traces; we should log decision chains
6. **Policy validation as separate layer** — validates our pattern of having guards/checks outside the LLM reasoning loop
7. **Memory design matters** — at 6K+ sequential decisions, what you keep in context determines drift

## Hypothesis candidates
- H: Our agents may fabricate constraints not in their guidance (parallel to "fabricated trading rules")
- H: Structured typed events/tasks reduce hallucinated actions vs. free-form NL instructions
