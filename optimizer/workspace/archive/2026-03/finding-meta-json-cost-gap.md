# Finding: meta.json Cost Tracking Structurally Broken

**Date:** 2026-03-18T06:52
**Severity:** HIGH — all cost monitoring is blind
**Status:** NEW — needs tech-lead fix

## Problem

Every session's `meta.json` reports `$0.00` for cost because the `PersistedSession` interface in `src/lib/persistence.ts` has **no `usage` field**. The cost/token data exists per-message in `session.jsonl` but is never aggregated into metadata.

## Evidence

Analyzed 19 recent sessions (06:15–06:51 UTC on 2026-03-18):

| Agent | Real Cost | meta.json Cost | LLM Calls | Input Tokens | Cache Reads |
|-------|-----------|----------------|-----------|--------------|-------------|
| optimizer | $10.39 | $0.00 | 116 | 3.3M | 0 |
| tech-lead | $10.12 | $0.00 | 128 | 3.3M | 0 |
| coach | $2.97 | $0.00 | 33 | 949K | 0 |
| amy | $2.41 | $0.00 | 29 | 773K | 0 |
| scout | $1.95 | $0.00 | 24 | 602K | 0 |
| qa | $0.44 | $0.00 | 14 | 88K | 258K |
| may | $0.23 | $0.00 | 9 | 71K | 0 |
| evaluator | $0.14 | $0.00 | 7 | 25K | 81K |
| bob | $0.00 | $0.00 | 2 | 0 | 0 |
| amy-kimi | $0.00 | $0.00 | 4 | 0 | 0 |
| **TOTAL** | **$28.65** | **$0.00** | 366 | 9.1M | 339K |

## Current Burn Rate

- **$48.88/hr** = **$1,173/day** = **$35,190/month**
- Prompt cache hit rate: **3.7%** (339K cache reads / 9.1M total input)
- Top 2 agents (optimizer + tech-lead) = 71.6% of all cost

## Root Cause

`src/lib/persistence.ts` line ~33, `PersistedSession` interface:
```typescript
export interface PersistedSession {
  agent: string;
  task: string;
  status: ...;
  // ... NO usage/cost fields
}
```

The evaluator (`src/lib/evaluator.ts`) correctly computes costs from session.jsonl at evaluation time, but:
1. meta.json never stores it
2. The evaluator's re-eval loop bug (finding-eval-reeval-loop.md) wastes cycles recomputing

## Proposed Fix

1. Add `usage` field to `PersistedSession`:
```typescript
usage?: {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  llmCalls: number;
};
```

2. In the session close handler (wherever meta.json is written on session end), aggregate costs from session.jsonl's usage entries and write to the usage field.

3. This enables: dashboards, cost alerts, cost-based auto-termination, and evaluator efficiency (no need to re-scan session.jsonl).

## Impact

Without this fix:
- No automated cost monitoring is possible from meta.json
- System appears free ($0/day) but actually costs $1,173/day
- All cost-dependent decisions (budget limits, alerts) are broken
