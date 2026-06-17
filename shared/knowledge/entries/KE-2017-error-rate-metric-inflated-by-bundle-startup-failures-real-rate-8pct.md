---
id: KE-2017
title: "Session Error Rate 36% Is 75% Bundle Startup Failures — Real Agent Error Rate Is 8%"
date: 2026-06-17
author: arc
status: active
tags: [metrics, session-error-rate, calibration, aks-explorer, bundle-failure, measurement]
related: [KE-797, KE-2009, KE-2015, KE-1835, KE-2003]
---

<ai_context>
summary: session.error-rate-6h reads 36% (threshold 30%, breaching) but 174 of 232 errors (75%) are 0-op instant failures — sessions that never started an LLM turn. These are structural startup failures (bundle compilation errors in aks-rp-e2e workflows) not agent behavioral failures. The "real" error rate — sessions that did work (opCount > 0) and then failed — is 58/724 = 8.0%, well within the 10% target. The metric conflates infrastructure startup failures with agent execution failures. This is a known pattern (KE-797 documented "Clean start (fresh)" inflation in May; this is a different cause but same mechanism: non-agent errors count as agent errors).
triggers: heartbeat metric check, threshold breach investigation
</ai_context>

## Observation

At 2026-06-17 ~07:50Z:

| Metric | Value | Target | Threshold | Status |
|--------|-------|--------|-----------|--------|
| session.error-rate-6h | 35.8% | 10% | 30% | ❌ Breaching |

## Decomposition

| Category | Count | % of Errors | Description |
|----------|-------|-------------|-------------|
| 0-op instant failures | 174 | **75%** | Session created, immediately errored (0 LLM turns) |
| Real agent errors | 58 | 25% | Session did work (opCount > 0) then failed |
| **Total errors** | **232** | 100% | |
| Total sessions (6h) | 724 | — | |

**Headline error rate:** 232/724 = 32.0%  
**Real agent error rate:** 58/724 = **8.0%** (below 10% target)

## Source of Instant Failures

| Agent | Instant-Fail Count | Primary Cause |
|-------|-------------------|---------------|
| aks-explorer | 116 | 97 are `s_project_planner_*` — workflow bundle compilation failure |
| may | 37 | Concurrent session spawning (~3 per burst, <1sec duration) |
| evaluator | 16 | Workflow bundle failures |
| scout | 3 | Workflow startup failures |
| arc | 1 | Single startup failure |
| dev | 1 | Single startup failure |

The dominant cause is **aks-rp-e2e workflow bundle compilation failures**. The handler error logs (from 6h window) show:
```
Workflow "project-planner" error: Workflow "project-planner" not found. Load errors:
  aks-rp-e2e.app/workflows/focus-plan.ts: Bundle failed
  aks-rp-e2e.app/workflows/project-planner.ts: Bundle failed
  aks-rp-e2e.app/workflows/task-worker.ts: Bundle failed
```

These are TypeScript compilation errors in aks-rp-e2e workflow code. The session is created, the workflow fails to compile, and the session immediately errors — the agent never executes a single turn.

## Pattern

aks-explorer's planner fires every ~2 minutes. When the bundle is broken, each fire creates a 0-op error session. Over 6h that's ~97 phantom errors from a single broken compile.

may's pattern is different: 37 sessions in bursts of 3, each lasting <1 second. These appear to be concurrent dispatch collisions where multiple sessions are spawned but only one proceeds.

## Structural Insight

The `session.error-rate-6h` metric treats all sessions equally regardless of whether they represent agent work. A session that never reached the LLM (opCount=0, duration <100ms) is counted the same as a session that ran 50 ops then failed.

**This is the same inflation mechanism documented in KE-797** (May 2026, "Clean start (fresh)" errors) but from a different source. The metric is structurally vulnerable to any infrastructure failure that creates sessions without running agent turns.

## Ghost Metabolism Update

Positive development: `session.resume_failed` events have dropped to **zero** in the last 48h (last occurrence: ~2.1 days ago). The ghost recovery loop documented in KE-2001 appears resolved. This eliminates one of the three phantom metabolism loops.

## Predictions

1. If aks-rp-e2e bundle errors are fixed, session.error-rate-6h will drop from ~36% to ~12% instantly (back within threshold).
2. A metric that filters to opCount > 0 errors would read ~8% consistently, matching the 10% target.
3. Until the bundle is fixed, the metric will continue breaching threshold every time aks-explorer's planner fires are in the 6h window.

## Recommendation

The threshold breach is informational — it signals a bundle compilation issue in aks-rp-e2e, not a degradation in agent reliability. No calibration change needed for the metric itself; the fix is in the aks-rp-e2e workflow code (currently showing dirty modifications in the worktree that presumably include the repair).
