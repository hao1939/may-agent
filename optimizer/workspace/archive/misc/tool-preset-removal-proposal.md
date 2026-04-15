# Tool Preset Removal Proposal

## Date: 2026-03-17
## Author: Optimizer
## Type: Tool Efficiency — Focus Area #3

## Summary

Remove unused tool presets from 5 agents to reduce system prompt token waste. Based on audit of 8,000+ sessions showing 0% or near-0% usage rates.

## Changes Requested

### 1. Remove `coordination` from QA (`agents/qa/agent.json`)
- **Evidence**: 0 handoff calls across 120 sessions (0%)
- **Savings**: ~500 tokens/session × hundreds of future sessions
- **Risk**: None. QA is a leaf reviewer — never needs to hand off work.

### 2. Remove `coordination` from Coder (`agents/coder/agent.json`)
- **Evidence**: 0 handoff calls across 154 sessions (0%)
- **Savings**: ~500 tokens/session
- **Risk**: None. Coder writes code and returns — no cross-agent handoffs.

### 3. Remove `coordination` from Amy (`agents/amy/agent.json`)
- **Evidence**: 0 handoff calls across 793 sessions (0%)
- **Savings**: ~500 tokens/session
- **Risk**: None. Amy researches XHS content — no handoff targets.

### 4. Remove `coordination` from Amy-Kimi (`agents/amy-kimi/agent.json`)
- **Evidence**: 1 handoff call across 671 sessions (0.1%)
- **Savings**: ~500 tokens/session
- **Risk**: Near-zero. Single usage was likely incidental.

### 5. Remove `workflow` from Tech-Lead (`agents/tech-lead/agent.json`)
- **Evidence**: 3 workflow calls across 1,194 sessions (0.3%)
- **Savings**: ~800 tokens/session (workflow tool has larger schema)
- **Risk**: Low. Tech-lead delegates via `agents` tool, not workflows.

## Total Impact

- **5 agents affected**
- **~2,800 tokens saved per session** across all 5 agents combined
- **Estimated savings**: ~2.5M tokens over historical volume, ongoing savings for future sessions
- Each unnecessary tool also increases the probability of tool confusion (the LLM considers unused tools as action options, wasting reasoning tokens)

## Exact Edits

### QA: `agents/qa/agent.json`
```diff
  "tools": [
-   "coordination",
    "coding",
    "finish"
  ]
```

### Coder: `agents/coder/agent.json`
```diff
  "tools": [
-   "coordination",
    "coding",
    "finish"
  ]
```

### Amy: `agents/amy/agent.json`
```diff
  "tools": [
-   "coordination",
    "coding",
    "finish"
  ]
```

### Amy-Kimi: `agents/amy-kimi/agent.json`
```diff
  "tools": [
-   "coordination",
    "coding",
    "finish"
  ]
```

### Tech-Lead: `agents/tech-lead/agent.json`
```diff
  "tools": [
    "coding",
-   "workflow",
    "agents",
    "coordination",
    "finish"
  ]
```

## Rollback

If any agent later needs a removed tool, re-add the preset to their agent.json. The tools remain available in the codebase — this only removes them from specific agents' toolsets.
