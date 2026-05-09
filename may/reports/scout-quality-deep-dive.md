# Scout Agent Quality Deep Dive — 24h Analysis

**Generated:** 2025-07-05  
**Finding:** Scout has 83% needs_improvement rate (98 of 118 evaluated sessions)

## Summary

Scout's operational friction rate is 83%, driven overwhelmingly by a single root cause: **uncommitted changes blocking finish**. This is not a quality-of-work problem — it's a workflow hygiene problem that inflates failure metrics.

## Issue Breakdown (24h, needs_improvement sessions)

| Issue Category | Count | % of Failures |
|---|---|---|
| Uncommitted changes | 65 | 66% |
| Schema/query errors | 13 | 13% |
| Terminal errors | 9 | 9% |
| Review overrides | 5 | 5% |
| Anti-shallow gate | 4 | 4% |
| Interrupted | 2 | 2% |

## Root Cause Analysis

### 1. Uncommitted Changes (65 sessions — dominant cause)
Scout sessions complete their work but fail the finish hygiene gate because dirty files remain in the git worktree. This accounts for **two-thirds** of all scout failures. The fix is behavioral: scout needs stronger commit discipline in its heartbeat/task workflows, or the evaluator heuristic needs to distinguish "work done but not committed" from "work not done."

**Recommendation:** Add explicit commit step to scout's workflow preamble, or soften the heuristic to flag this as a warning rather than needs_improvement when the session otherwise completed successfully.

### 2. Schema/Query Errors (13 sessions)
Scout encounters DB schema mismatches when investigating metrics. This suggests scout's knowledge of the runtime DB schema is stale or incomplete.

**Recommendation:** Ensure scout uses `PRAGMA table_info()` before querying unfamiliar tables. Add a knowledge file with current schema.

### 3. Terminal Errors (9 sessions)  
These are hard crashes — likely provider errors or timeouts. At 7% of total sessions, this is within acceptable range.

## Metric Impact

These three open alerts are all downstream of the same root cause:
- `scout.operational-friction-rate-24h`: 0.83 (threshold: 0.3) — **BREACH**
- `scout.good-session-rate-24h`: 0.178 (threshold: 0.65) — **BREACH**
- `capability.message-conversation-close-rate`: 0.14 (threshold: 0.15) — **BREACH** (minor)

Fixing the uncommitted-changes issue alone would likely move the good-session-rate from 17% to ~55-60%, and the friction rate from 83% to ~35%.

## Overall System Health

All P0 and P1 metrics are green. The system is healthy:
- Handler success rate: 99.6%
- Session error rate: 3.0%  
- LLM eval lag: 0.35h
- Heartbeat coverage: 5 agents active
- Zero zombie sessions, zero stale projects
- Real output: 1,010 files in 24h
