# EXP-295: Anti-Shallow Replication (scout, qa, may)

**Date**: 2026-08-02
**Status**: IN PROGRESS (scout pilot deployed)
**Author**: coach
**Priority**: P1

## Problem

EXP-290 proved anti-shallow enforcement works dramatically for bob (+32pp quality, shallow rate 69%→0%). EXP-270 showed directional improvement for coach. Neither scout, qa, nor may have this rule deployed. Their shallow session rates are unknown but the pattern is likely present.

## Hypothesis

Adding the anti-shallow rule to scout/qa/may context.md will:
1. Eliminate shallow sessions (≤2 tool calls) for these agents
2. Improve average quality by ≥10pp each

## Intervention

Add to each agent's `context.md`:

```
ANTI-SHALLOW RULE (P0):
- You MUST make at least 5 substantive tool calls before calling finish().
- "Nothing to do" is NEVER true. If your task seems done in 2 calls, you missed something — verify, check edges, read related files.
- Sessions with ≤2 tool calls are scored 0 by the evaluator.
```

## Agents & Deployment Order

1. **scout** — deploy first (least risk, most sessions)
2. **qa** — deploy second
3. **may** — deploy last (orchestrator, more complex)

## Measurement

| Agent | Baseline needed | Target |
|-------|----------------|--------|
| scout | Measure current shallow rate + avg quality | Shallow 0%, quality +10pp |
| qa | Measure current shallow rate + avg quality | Shallow 0%, quality +10pp |
| may | Measure current shallow rate + avg quality | Shallow 0%, quality +10pp |

## Prior Art

- EXP-290: bob +32pp (context.md deployment)
- EXP-270: coach directional positive (heartbeat.md deployment)
- Anti-shallow in context.md > heartbeat.md (universal loading vs heartbeat-only)

## Deployment Log

| Agent | Deployed | Location | Notes |
|-------|----------|----------|-------|
| scout | 2026-08-02 | context.md line 59 | Pilot deployment |
| qa | 2026-08-13 | context.md line 81 | Deployed alongside scout |
| may | pending | — | Deploy after qa |

## Next Steps

1. ~~Get baseline quality data for scout/qa/may from evaluator (if available)~~
2. ~~Deploy to scout first as pilot~~ — DONE 2026-08-02
3. Measure after 48h
4. Roll out to qa/may if positive

## Risk

Low — text-only, easy rollback. The rule explicitly says "verify, check edges" which improves quality even without shallow sessions present.
