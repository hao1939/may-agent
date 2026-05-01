# Heartbeat note — 2026-04-30 — evaluation coverage

## What I checked (DB is canonical)
- `evaluations.maxCreatedAt` is recent: **2026-04-30T20:17:16Z**.
- Session evaluation **pipeline is alive**, not stalled.

## Coverage snapshot
From `.state/may.db`:
- Ended sessions: **3249**
- Ended sessions without evaluation row: **2047**
- Coverage (ended with eval / ended): **0.36996** (~37%)

Breakdown of *missing evals*:
- By kind: `job` **1050**, `call` **995**, `chat` **2**.
- By (kind,status): `job done` **1050**, `call done` **978**, `call interrupted` **13**, `call error` **3**, `job interrupted` **1**.

For key agents (ended sessions):
- optimizer: coverage **0.478** (406/850); missing evals: **444**
- coach: coverage **0.531** (469/884); missing evals: **415**
- may: coverage **0.723** (81/112)
- tech-lead: coverage **0.278** (5/18)

## Freshness vs. completeness signal
Most recent ended sessions missing eval include many `evaluator job done` sessions (i.e., meta jobs) and some recent calls.

However, the last-24h evaluation stream is strong:
- “LLM-ish” evals (heuristic=0, skippedByJs=0) last 24h: `call` **531**, `job` **44**.
- By agent/kind last 24h: optimizer calls **154**, coach calls **150**, may calls **66**, etc.

## Hypotheses
1. **Intentional sampling / budget cap**: evaluation path may only sample a subset of sessions (explains consistent ~37% coverage while still writing many evals).
2. **Eligibility filter**: some kinds/statuses might be excluded, but missing evals include `call done` and `job done`, so exclusion is not purely error-only.
3. **Backlog/latency**: some missing evals may be caught up later, but a block of coach/optimizer calls from ~08:34–08:47Z are still missing.

## Follow-ups
- Identify selection logic owner: likely in may server/handler code (evaluation-sync / evaluateTask path). Determine whether sampling is intended.
- If sampling is intended, define an explicit **Coverage** metric target and documentation (so 37% isn’t a silent surprise).
- If sampling is NOT intended, investigate why many ended sessions never get an evaluation row.
