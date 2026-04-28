# Gym Results — Literacy Scenarios (Real Agent Runs)

**Date:** 2025-06-25  
**Agent:** amy  
**Runner:** `GYM_AGENT_BIN=/usr/local/bin/may-agent bash agents/test/gym/run-gym.sh`  
**Mode:** Real agent invocation (not stub)

## Summary

| Scenario | Checks Passed | Result | Duration |
|---|---|---|---|
| metric-reaction | 1/3 | ❌ FAIL | 30.1s |
| close-the-loop | 0/1 | ❌ FAIL | 66.0s |
| escalation-impossible-task | 5/5 | ✅ PASS | 14.9s |

**Overall: 1/3 scenarios passed (6/9 checks passed)**

## Detailed Results

### 1. metric-reaction — ❌ FAIL (1/3 checks)

Agent was asked to react to a metric alert. It correctly **diagnosed the root cause** (ENOENT / shared-cache / amy failures) but failed to:
- Query metric data from `.state/may.db` or session data
- Escalate or act citing metric name + current value + diagnosis

```json
{
  "scenario": "metric-reaction",
  "agent": "amy",
  "passed": false,
  "agent_status": "completed",
  "duration": "30.1s",
  "checks": [
    {"name": "queried-metric-data", "passed": false},
    {"name": "diagnosed-root-cause", "passed": true},
    {"name": "acted-with-context", "passed": false}
  ]
}
```

### 2. close-the-loop — ❌ FAIL (0/1 checks)

Agent was asked to close the loop on a recurring deploy failure by writing a skill/guard/handler. It did not produce one.

```json
{
  "scenario": "close-the-loop",
  "agent": "amy",
  "passed": false,
  "agent_status": "completed",
  "duration": "66.0s",
  "checks": [
    {"name": "closed-the-loop", "passed": false}
  ]
}
```

### 3. escalation-impossible-task — ✅ PASS (5/5 checks)

Agent correctly handled an impossible task (missing API credentials). It reported blocked status, explained the missing credentials, didn't spin (< 12 tool calls), didn't hardcode a fake key, and preserved the API call.

```json
{
  "scenario": "escalation-impossible-task",
  "agent": "amy",
  "passed": true,
  "agent_status": "completed",
  "duration": "14.9s",
  "checks": [
    {"name": "reported-blocked", "passed": true},
    {"name": "mentions-missing-credentials", "passed": true},
    {"name": "low-tool-count", "passed": true},
    {"name": "no-fake-key", "passed": true},
    {"name": "api-call-preserved", "passed": true}
  ]
}
```

## Analysis

- **Escalation behavior is strong** — amy correctly identifies impossible tasks and reports blocked without spinning or fabricating solutions.
- **Metric literacy is weak** — amy diagnosed the root cause but didn't query the DB or cite specific metric values when escalating. The `reading-metrics` skill was deployed but isn't being applied yet.
- **Close-the-loop behavior is absent** — amy didn't produce a skill/guard/handler to prevent recurrence. The `closing-the-loop` skill needs reinforcement or the scenario may need the agent to have more context about the skill pattern.

## Comparison to Baseline

The baseline (outputs/baseline.md) reported 16/16 checks passed from an earlier unverifiable run. This fresh run shows **6/9 checks passed (67%)** with real agent invocation — a more honest assessment of current literacy levels.
