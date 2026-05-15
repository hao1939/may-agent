# Evaluation coverage heartbeat — 2026-04-30

## DB liveness
- `evaluations.maxCreatedAt`: **2026-04-30T20:17:16Z** (evaluations are being written; pipeline alive)

## Coverage snapshot
From `.state/may.db`:
- Ended sessions: **3249**
- Ended sessions without evaluation row: **2047**
- Coverage (ended with eval / ended): **0.36996** (~37%)

Missing evals breakdown:
- By kind: `job` **1050**, `call` **995**, `chat` **2**
- By (kind,status): `job done` **1050**, `call done` **978**, `call interrupted` **13**, `call error` **3**, `job interrupted` **1**

Key agent coverage (ended sessions):
- optimizer: **0.478** (406/850); missing: **444**
- coach: **0.531** (469/884); missing: **415**
- may: **0.723** (81/112)
- tech-lead: **0.278** (5/18)

## Freshness vs completeness
Last-24h “LLM-ish” evals (heuristic=0 and skippedByJs=0):
- by kind: `call` **531**, `job` **44**
- by agent/kind: optimizer calls **154**, coach calls **150**, may calls **66**, bob calls **46**, amy calls **41**, qa calls **37**, scout calls **36**, plus jobs.

## Working hypotheses
1. **Sampling/budget cap** is intentional (explains stable partial coverage while still producing many evals).
2. **Eligibility filter** exists but is not limited to failures; many `call done` sessions are still missing.
3. Some **backlog/latency** may exist, but a block of coach/optimizer calls from ~08:34–08:47Z are still missing.

## Follow-ups
- Find/confirm the current selection logic (evaluateTask / evaluation-sync path) and whether sampling is intended.
- If sampling is intended, document an explicit target/expectation for Coverage.
- If sampling is not intended, investigate why a large fraction of ended sessions never get an evaluation row.
