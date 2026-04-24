# Fragility Audit: manager-receipts.ts — Silent Failure Modes & Blast Radius

**Date**: 2026-04-15  
**Target**: `src/lib/manager-receipts.ts` (409 lines)  
**Scope**: What happens when each subsystem in `wrapToolsWithReceipts.execute()` fails silently or throws.

---

## Summary

The 180-line execute closure in `wrapToolsWithReceipts` interleaves 6 subsystems: guards, receipt persistence, cost signals, pivot heuristic, stuck detection, and finish-tool abort. Most failures are contained to the tool call level due to pervasive `catch {}` blocks. However, **two design flaws create silent behavioral corruption** that degrades session quality without any error signal.

---

## Failure Mode Analysis

### FM-1: Guard Throws an Error (not returns block — throws)

**Code**: Lines 187-220, catch at line 221: `catch { /* guard errors are non-fatal */ }`

**What happens**: The entire guard result is discarded. The tool executes as if no guard existed. No logging, no metric, no indication anything went wrong.

**Blast radius**: **Tool call level** — the tool runs unguarded. If the guard was a finish-guard that should have blocked a premature `finish()`, the agent finishes without guard protection. If the guard was a read-dedup or scrape-dedup, the agent wastes a tool call.

**Severity**: MEDIUM — The silent swallow is intentional (guards should never block execution due to their own bugs), but the **complete absence of logging** means guard bugs are invisible in production. You'd never know a guard was silently broken.

**Recommendation**: Add `log("warn", ...)` inside the catch block with the error message. One line, zero risk.

### FM-2: Receipt Persistence Fails (DB/FS Write Error)

**Code**: Lines 330-340, catch at line 339: `catch { /* best-effort */ }`

**What happens**: The `appendFileSync` to `receipts.jsonl` fails. The tool result is still returned signed and correct. The receipt log is simply missing that entry.

**Blast radius**: **None for the session**. Receipt logs are diagnostic only — they're never read during session execution. The HMAC signature is computed in-memory and doesn't depend on the file write. The only impact is missing forensic data for post-hoc audits.

**Severity**: LOW — Correct design choice. Best-effort logging that cannot block execution.

### FM-3: Cost Signal Tracking Overflows or Corrupts

**Code**: Lines 343-348

**What happens**: `execDurationMs` is a simple `Date.now()` subtraction — it's a plain number, cannot overflow in JavaScript (Number.MAX_SAFE_INTEGER = 9 quadrillion). `outputBytes = outputText.length` — also just a number. The `toFixed(1)` call is safe on any finite number.

**Can it corrupt?**: Only if `Date.now()` regresses (clock skew), producing a negative duration. This would produce `[COST: -500ms, 2.1KB]` — confusing but harmless, as the cost signal is purely informational text injected into the agent's view.

**Blast radius**: **None**. Cost signals are advisory text appended to tool output. They don't gate any behavior.

**Severity**: NEGLIGIBLE — No failure mode exists here.

### FM-4: Pivot Heuristic False Positive

**Code**: Lines 242-259 (pre-exec block) and lines 298-316 (post-exec tracking)

**Mechanism**: `isToolError()` (manager-utils.ts lines 100-123) pattern-matches output text against ~14 regex patterns. If any matches, the call is counted as a failure for that `toolName:argsHash` key.

**False positive scenario**: A tool output contains error-like text in its *content* (e.g., a `read()` of a log file containing "Command exited with code 1", or a `bash` command that prints "Permission denied" as part of expected output). `isToolError()` would classify this as an error, incrementing the failure counter.

**What happens on false positive**: After 3 "failures" with identical args, the tool call is **hard-blocked** (line 246: `failCount >= TOOL_PIVOT_LIMIT`). The agent receives `🚫 E_RETRY_LIMIT` and cannot use those exact args again for the rest of the session. There is no way to reset the counter except by changing the args.

**Blast radius**: **Tool+args combination permanently blocked for the session**. If the agent legitimately needs to re-read the same file 3 times and it contains error-like patterns, it's locked out. However, `computeToolArgsKey` hashes the full params, so any arg change (even whitespace) produces a new key.

**Severity**: MEDIUM — The `isToolError()` function was tightened (anchored `Command exited with code` pattern at line 103), but patterns like `\bPermission denied\b` and `\bNo such file or directory\b` can match inside file content. The mitigation is that most reads won't produce identical args 3 times, but `bash` commands reading logs could hit this.

**Recommendation**: Consider checking whether the exit code of bash is non-zero separately from content pattern matching, to reduce false-positive surface for bash-tool outputs specifically.

### FM-5: Stuck Detection False Positive — Terminates a Healthy Session

**Code (in manager-receipts.ts)**: Lines 370-374 — injects stuck warning when `session.consecutiveErrorTurns >= STUCK_WARNING_THRESHOLD(3)`.

**Code (in session-subscribers.ts)**: Lines 135-136, 180-199 — separate stuck detector with DIFFERENT thresholds (warn=4, terminate=6 vs manager-utils exports of 3 and 5).

**Critical finding — DUAL STUCK DETECTION SYSTEMS with divergent thresholds**:

| System | Warning | Termination | Data source |
|--------|---------|-------------|-------------|
| `manager-receipts.ts` | 3 turns | never (warning only) | `session.consecutiveErrorTurns` (ActiveSession field, set by ?) |
| `session-subscribers.ts` | 4 turns | 6 turns | Own `StuckState.consecutiveErrorTurns` (local Map) |

**The data staleness problem**: `manager-receipts.ts` reads `session.consecutiveErrorTurns` from the ActiveSession object, but **manager-receipts.ts never writes to it**. It only writes `currentTurnErrors` and `currentTurnSuccesses` (lines 308, 315). The `consecutiveErrorTurns` field is initialized to 0 (manager.ts lines 979, 1414) and **never incremented by any code in the codebase** (confirmed by grep). 

**This means**: The stuck warning in manager-receipts.ts (line 370) **can never fire** — `session.consecutiveErrorTurns` is always 0. The stuck detection is entirely handled by `session-subscribers.ts` which maintains its own separate state.

**Blast radius**: **Dead code** — the stuck warning injection at lines 370-374 is unreachable. No false-positive risk because the feature doesn't work. But the *intended* stuck warning (visible to the agent) never gets injected. Only the session-subscribers system fires, which logs and potentially kills but doesn't inject a visible warning into the tool output stream.

**Severity**: HIGH — The agent never sees the "you are in a repetitive failure loop" warning before being killed. The session-subscribers system goes straight from detection to kill without giving the agent a chance to self-correct via the tool output channel.

### FM-6: finish() Abort — queueMicrotask Race Condition

**Code**: Lines 378-383

```typescript
if (tool.name === "finish" && session) {
  queueMicrotask(() => {
    if (!session.closed) {
      session.agent.abort();
    }
  });
}
```

**What happens if session.agent.abort() throws**: The microtask has no try/catch. An unhandled rejection would propagate to the process-level `unhandledRejection` handler (if one exists) or crash the process.

**What happens if session is removed from activeSessions before the microtask fires**: Safe — `session` is captured by closure (not re-fetched from the Map). The `session.closed` check prevents double-abort.

**What happens if the model calls finish() multiple times**: Each call queues a new microtask. The first abort succeeds; subsequent ones are gated by `session.closed`. Safe if `abort()` sets `closed = true` synchronously.

**Blast radius**: **Session level** — if `abort()` throws, the session may not terminate cleanly, potentially leaving it in a zombie state. The `!session.closed` guard is the only protection.

**Severity**: LOW — The `abort()` API is from pi-agent-core and is expected to be safe. The main risk is if `closed` is not set synchronously before the next microtask fires.

---

## Cross-Cutting Concern: Session Lookup Fragility

**Code**: Lines 157-168 — `getSession()` with lazy caching

The `getSession()` closure caches the first successful lookup. If the session is added to `activeSessions` after wrapping but before the first tool call, it works. If the session is never added (bug), every tool call runs with `session = undefined`, which means:
- No op counting (state-changing tools don't increment opCount)
- No pivot tracking (errors are never tracked)
- No stuck detection
- No finish abort
- Tool calls still execute and return signed results

**Blast radius**: **Session-wide silent degradation** — all safety systems are bypassed but the session appears to work normally. No error is logged.

**Severity**: MEDIUM — Unlikely in practice (manager.ts adds sessions before starting them), but the failure mode is completely silent.

---

## Severity Summary

| # | Failure Mode | Severity | Blast Radius |
|---|-------------|----------|-------------- |
| FM-1 | Guard throws | MEDIUM | Tool call (unguarded execution) |
| FM-2 | Receipt persistence fails | LOW | None (diagnostic only) |
| FM-3 | Cost signal corruption | NEGLIGIBLE | None (advisory text) |
| FM-4 | Pivot false positive | MEDIUM | Tool+args blocked for session |
| FM-5 | Stuck warning dead code | **HIGH** | Agent never sees self-correction warning |
| FM-6 | finish() abort throws | LOW | Session (potential zombie) |
| CC-1 | Session lookup miss | MEDIUM | Session-wide safety bypass |

## Recommended Follow-Up Actions

1. **FM-5 (HIGH)**: Fix the dual stuck detection systems. Either:
   - Have `session-subscribers.ts` update `session.consecutiveErrorTurns` on the ActiveSession object, so the warning injection in manager-receipts.ts works, OR
   - Remove the dead warning code from manager-receipts.ts and have session-subscribers inject a steer message before killing.
   
2. **FM-1 (MEDIUM)**: Add `log("warn", ...)` to the guard catch block. One-line fix.

3. **FM-4 (MEDIUM)**: Consider separating bash exit code checking from content pattern matching in `isToolError()`.

4. **CC-1 (MEDIUM)**: Add a `log("warn")` when `getSession()` returns undefined on a tool call.
