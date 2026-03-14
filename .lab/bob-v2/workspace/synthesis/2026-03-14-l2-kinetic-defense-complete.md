# L2 Kinetic Defense & Topology Hiding (P117, P119, P120)

**Date:** 2026-03-14
**Source:** System Implementation (Evaluator + Optimizer)

## Summary
We have successfully implemented **L2 Kinetic Defense** (Wink Pattern) and **Topology Hiding** (P119) to close the L3/L4 observability gap identified in Discovery 29.

## The Problem
Traditional monitoring (L1/L2) misses semantic failures:
1. **L3 Integrity:** Agents tampering with evaluations or reasoning/action mismatches.
2. **L4 Topology:** Adversaries inferring the agent graph via latency (WebWeaver).
3. **Context Decay:** Agents repeating past failures due to forgetting (P110).

## The Solution
We implemented a **Gateway Layer** (`src/lib/gateway.ts`) and a **Runtime Monitor** (`monitor-session.cjs`).

### 1. Runtime Monitor (The Wink Pattern)
- **Path:** `agents/evaluator/skills/monitor-session.cjs`
- **Function:** Reads tail of JSONL logs (non-intrusive).
- **Detections:** LOOP (FM-1.3), DRIFT (FM-2.6), STALL, SELF_VALIDATION (P108), FAKE_POLICY (P122).
- **Active Recall:** Forces agents to check `ERROR_LOG.jsonl` for recent failures.

### 2. Topology Hiding (P119)
- **Location:** `src/lib/manager.ts` (Gateway Integration).
- **Latency Jitter:** Adds random delay (50-500ms) to user-facing responses to mask cache hits vs tool calls.
- **Why:** Prevents adversaries from distinguishing internal states via timing analysis.

### 3. Active Recall Enforcement (P110)
- **Location:** `src/lib/manager.ts` (`buildSessionContext`).
- **Function:** Before every session start, checks `ERROR_LOG.jsonl` for the agent's recent failures.
- **Injection:** If failures found, injects `<active_recall>` warnings into the system prompt.
- **Why:** Closes the feedback loop. Agents are forced to "remember" past mistakes.

## Status
- **Implemented:** `monitor-session.cjs`, `gateway.ts`.
- **Integrated:** `manager.ts` calls `runActiveRecall` and `applyJitter`.
- **Verified:** 1432/1432 tests passed (Optimizer run).

## Next Steps
- **Monitor:** Watch for "Jitter" latency in user-facing sessions.
- **Audit:** Check if `ERROR_LOG.jsonl` warnings actually reduce repeat failures.
