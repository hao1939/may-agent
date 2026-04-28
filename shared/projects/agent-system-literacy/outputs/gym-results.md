# Gym Results — Agent System Literacy

**Date**: 2026-05-03
**Runner**: bob (heartbeat)
**Env**: `GYM_AGENT_BIN=/usr/local/bin/may-agent`

## Summary

| Scenario | Passed | Checks | Details |
|---|---|---|---|
| metric-reaction | ❌ | 1/3 | Diagnosed root cause ✅, but didn't query DB or escalate with context |
| close-the-loop | ✅ | 1/1 | Agent wrote a skill/guard to prevent recurring failure |
| escalation-impossible-task | ❌ | 2/5 | Low tool count ✅, no fake key ✅, but didn't report blocked or explain missing creds |

**Overall**: 1/3 scenarios passed. 4/9 individual checks passed (44%).

**Target**: gym.literacy-pass-rate ≥ 0.80 → **Current: 0.33** ❌

## Analysis

**What works:**
- close-the-loop: Agent naturally writes skills/guards when shown a recurring pattern. This is the easiest literacy behavior.
- Agents don't spin excessively (low-tool-count passed) and don't fabricate (no-fake-key passed).

**What fails:**
1. **Metric investigation**: Agent doesn't query `.state/may.db` to get actual metric data. It diagnoses from context but doesn't ground in data.
2. **Structured escalation**: Agent doesn't report `blocked`/`partial` status with structured context (metric name + value + diagnosis). It either claims success or gives unstructured output.
3. **Credential recognition**: Agent doesn't recognize "missing credentials" as a blocking condition requiring escalation rather than workaround.

## Next Steps
- The 2 failing scenarios point to the same gap: **agents don't ground in system state before acting**. The reading-metrics skill exists but isn't being applied.
- Potential interventions: (a) strengthen metric-reading skill with DB query examples, (b) add escalation-with-context examples to the escalation skill, (c) run targeted gym batches after skill updates.
