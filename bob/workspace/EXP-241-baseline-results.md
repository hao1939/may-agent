# EXP-241 Baseline Results — 2026-04-27

## Problem: Floor/Ceiling Effect

All tested scenarios produce deterministic results (0% or 100%), making A/B comparison impossible.

| Scenario | Baseline (5 trials) | Useful? |
|----------|---------------------|---------|
| sql-injection-in-query-builder | 5/5 (100%) | ❌ Ceiling |
| cascading-fix-trap-v2 | 0/5 (0%) | ❌ Floor |
| knowledge-entry-creation | 5/5 (100%) | ❌ Ceiling |
| behavior-escalation-stubborn | 3/3 (100%) | ❌ Ceiling |
| approach-validation-trap | 0/3 (0%) | ❌ Floor |

## Analysis

The gym scenarios are **deterministic for a given model** — the agent either has the capability to solve the scenario or doesn't. KE injection is unlikely to flip a 0% scenario to pass or degrade a 100% scenario to fail.

This means **EXP-241 as designed cannot work**. We need scenarios where:
1. The agent has the raw capability but sometimes fails due to missing context
2. KE content is directly actionable for the specific scenario task

## Pivot Options

### Option A: Create custom scenarios where KE content is directly relevant
Design 2-3 scenarios where the correct solution requires knowledge encoded in our KEs. E.g., a scenario where the agent must choose between text-based rules vs structural interventions — KE-007 would be directly relevant.

### Option B: Measure partial scores instead of pass/fail  
Use individual check pass rates rather than overall pass/fail. Some scenarios have 4-10 checks; individual checks may show more variance.

### Option C: Measure behavior quality, not just pass/fail
Analyze transcripts for evidence of KE-aligned reasoning (e.g., did the agent consider structural interventions? did it avoid text-based fixes?) regardless of pass/fail.

### Option D: Shelve EXP-241, run H-183 differently
Test knowledge utility via evaluator-style assessment: give evaluator Grade-A vs Grade-C KEs as context when reviewing real sessions, measure whether their assessments improve.

## Recommendation

**Option B** is cheapest — re-analyze existing trial data at check level. If that shows variance, proceed. If not, pivot to **Option A** (design KE-relevant scenarios).

## Update 2026-04-27 (heartbeat)

Ran approach-validation-trap with coder agent: 5/6 checks, `read-session-logs` fails consistently. Check-level analysis (Option B) won't help — failures are deterministic per-check too.

**Decision: SHELVE EXP-241.** Gym scenarios test coding ability. KEs encode meta-knowledge about agent architecture/interventions. The instrument (gym) doesn't match the construct (KE utility for reasoning). H-183 needs a different test design:

- **Better approach**: Compare evaluator assessments when given Grade-A vs Grade-C KEs as context for real session reviews (Option D). This tests KE utility for the actual use case — reasoning about agent behavior, not coding.
- **Or**: Wait until we have scenarios specifically designed to require meta-knowledge (e.g., "design an intervention for this agent failure" scenarios).

H-183 remains open but EXP-241 is closed as INFEASIBLE.
