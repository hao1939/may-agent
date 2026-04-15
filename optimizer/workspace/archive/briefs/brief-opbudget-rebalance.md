# Brief: OpBudget Rebalance

**Author:** Optimizer
**Date:** 2026-03-17
**Priority:** P1 (HIGH — budget exhaustion is the #1 cause of agent errors)
**Target:** May → agent.json updates

## Problem

Budget exhaustion accounts for **15 of 23 errors** (65%) in the last 150 sessions. Five agents regularly hit their ceiling, causing work to be abandoned mid-task with `OpBudgetExceeded` errors.

## Data (from 200 most recent sessions)

```
Agent         Current    p50    p75    p90    max  Suggest   Status
amy                20     15     20     20     20       25   ⚠️ 14% budget errors
amy-kimi           20     13     16     18     18       25   OK (headroom ~2)
bob                40      8     12     26     26       35   OK (overprovision)
coach              40     15     24     37     40       50   ⚠️ 7% budget errors
evaluator          30      3      4     11     16       15   Overprovision (2x)
may                40      2      6      9     29       15   Overprovision (2.7x)
optimizer          30     29     30     30     31       40   ⚠️ 42% budget errors
qa                 20      0      7      7     17       15   OK (errors are shallow-hb bug, not budget)
scout              20     20     20     20     20       25   ⚠️ 50% budget errors  
tech-lead          60     41     49     56     60       70   ⚠️ 5% budget errors
```

## Recommended Changes

### Increase (hitting ceiling too often):
1. `agents/optimizer/agent.json`: opBudget 30 → **40**
2. `agents/scout/agent.json`: opBudget 20 → **25**
3. `agents/amy/agent.json`: opBudget 20 → **25**
4. `agents/coach/agent.json`: opBudget 40 → **50**
5. `agents/tech-lead/agent.json`: opBudget 60 → **70**

### Decrease (overprovision wastes token context for budget warnings):
6. `agents/evaluator/agent.json`: opBudget 30 → **20** (p90=11, max=16)
7. `agents/may/agent.json`: opBudget 40 → **20** (p90=9, max=29 was outlier)

### Keep as-is:
- `agents/bob/agent.json`: 40 (fine, p90=26)
- `agents/qa/agent.json`: 20 (errors are shallow heartbeat bug, not budget)
- `agents/amy-kimi/agent.json`: 20 → 25 (optional, small headroom)
- `agents/coder/agent.json`: 60 (insufficient data, keep)
- `agents/master/agent.json`: 60 (insufficient data, keep)

## Implementation

For each agent.json, change the `opBudget` field. Example:
```json
// agents/optimizer/agent.json
"opBudget": 40  // was 30
```

## Expected Impact

- **~15 fewer errors per 150 sessions** (65% error reduction)
- Optimizer alone should go from 42% error rate to ~5%
- Scout should go from 50% to ~10%
- Net cost change: roughly neutral (budget increases are modest, decreases offset)

## Cost Guardrail

None of these increases are dramatic. The largest is tech-lead 60→70 (+17%). The optimizer 30→40 (+33%) is justified by the 42% error rate. If any agent starts running away, the budget will still cap them.
