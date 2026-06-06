# Design: Guard Escalation Override

**Author**: tech-lead  
**Date**: 2026-04-15  
**Status**: Draft — awaiting Hao's review  

## Problem

Guards can permanently block agents with no escape. The cost-limit-guard blocks at 60 cumulative turns — once triggered, every subsequent call (including `finish()`) is also blocked because the counter keeps incrementing. The agent is trapped: it can't exit cleanly, can't report its status, can't do anything. The session eventually times out and is marked as an error with no useful output.

**Incident**: An agent hit the 200-call limit (TOOL_CALL_LIMIT was set low). The cost-limit-guard blocked every subsequent call, including `finish()`. The agent looped trying to exit, burning context window, until the session was killed externally.

### Current Architecture

```
composeGuards(
  emptyArgsGuard,      // validates args shape
  toolSchemaGuard,     // validates against tool schema
  pathHallucinationGuard,
  completenessGuard,   // agent-specific checks
  finishGuard,         // validates finish() evidence (FM-3.1, FM-3.3)
  commitGuard,         // review gate for src/ commits
  verificationDepthGuard,
  readDedupGuard,      // warns on re-reading same file
  sessionReadGuard,    // warns on cross-session reads
  scrapeDedupGuard,
  costLimitGuard,      // LAST — emergency brake at 60 turns
)
```

Guards return `{ block: true, reason }` → `manager-receipts.ts` returns the reason as a tool error without executing. The agent sees the block message and retries (often with the same call), which triggers the guard again, creating a death loop.

## Design Questions & Answers

### Q1: Should `finish()` be unconditionally exempt from all guards?

**Answer: Yes, with one exception.**

`finish()` is how agents exit cleanly. If a guard blocks `finish()`, the agent is trapped — it can't report partial results, can't record what it learned, can't save deliverables. The session dies with an external timeout and all context is lost.

**Recommendation**: All guards except `finishGuard` itself should skip `finish()` calls.

The **finish-guard** (FM-3.1/FM-3.3) is special — it validates that agents aren't fabricating results. But even the finish-guard should never hard-block more than once. On the second attempt, it should downgrade to a warning and allow the call through (logging the override for May's review).

**Implementation**: In `composeGuards`, check if `context.toolCall.name === "finish"`. If so, skip all guards except `finishGuard`. This is a one-line check that affects no other code paths.

**Layering with finish-guard**: The finish-guard validates evidence quality for `status: "success"`. If it blocks once and the agent retries without fixing the evidence, on the second block the guard should:
1. Allow the call through
2. Downgrade `status` to `"partial"` (or let the agent change it themselves)
3. Log a `guard_override` event

This prevents the trap while preserving signal: May sees "this agent tried to claim success without evidence, was blocked, retried without fixing it."

### Q2: How does an agent signal "I acknowledge the guard but want to proceed"?

**Recommended approach: (c) + (d) — finish() is always exempt; other guards have a retry-with-override protocol.**

Evaluated options:

| Option | Pros | Cons |
|--------|------|------|
| (a) Special parameter on tool call | Explicit intent | Agents need to learn new param; adds complexity to every tool schema |
| (b) Separate `escalate()` tool | Clean separation | Another tool to maintain; can itself be blocked; adds a round-trip |
| (c) Certain tools always exempt | Zero agent effort; simple | Only works for `finish()` — doesn't solve other guard traps |
| (d) Retry-with-override protocol | Guards auto-detect repeated blocks; no agent changes needed | Guard needs state; risk of accidental override |

**Recommended: Combine (c) and (d).**

- **finish()** is unconditionally exempt from all guards except finish-guard (option c).
- **For all other guards**: if the same guard blocks the same tool call twice in a row (same tool name, within 3 turns), the second block is downgraded to a warning and allowed through (option d). The guard logs the override.

**Why not a special parameter or new tool**: Agents shouldn't need to learn escalation mechanics. The problem is architectural — guards shouldn't trap agents — so the fix should be architectural too. Adding `override: true` to tool schemas or an `escalate()` tool adds cognitive load and new failure modes (what if the agent doesn't know about them? what if `escalate()` is itself blocked?).

**Retry detection**: Each guard tracks its last block per `(toolCallName)`. If the same tool name is blocked again within 3 message indices, the guard returns `{ block: false, reason: "OVERRIDE: ..." }` instead.

### Q3: How is the override logged for May's async review?

**Log to both session.jsonl and may.db.**

**session.jsonl** (per-session log): Add a `guard_override` event alongside existing `tool_call` events:
```jsonl
{"type":"guard_override","ts":1713200330686,"guard":"cost-limit-guard","tool":"finish","attempt":2,"originalReason":"Cost limit reached: 201 tool calls...","agent":"coder"}
```

**may.db** (queryable): Add to the existing `sessions` table or a new `guard_overrides` table:

```sql
CREATE TABLE IF NOT EXISTS guard_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  agent TEXT NOT NULL,
  guard TEXT NOT NULL,
  tool TEXT NOT NULL,
  reason TEXT NOT NULL,
  overriddenAt INTEGER NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES sessions(id)
);
```

**Why both**: session.jsonl is the source of truth for replay/debugging. may.db is for querying patterns ("which guards are being overridden most? is a specific agent repeatedly hitting limits?").

**What to log**:
- `agent`: which agent triggered the override
- `guard`: which guard was overridden (need guards to self-identify — see Changes below)
- `tool`: which tool call was being attempted
- `reason`: the original block reason
- `sessionId`: for correlation
- `overriddenAt`: timestamp

### Q4: What guards should NEVER be overridable?

**Two guards should never be overridable:**

1. **cross-edit-guard** — Prevents agents from modifying other agents' identity files (SOUL.md, agent.json, heartbeat.md) and evaluation criteria. This is a **security boundary**, not an efficiency guard. An agent overriding this could tamper with another agent's identity or the evaluation system (reward hacking). No escalation path — agents must use `agents.send()` to request changes from the owning agent.

2. **path-hallucination-guard** (if it blocks writes to non-existent directories) — Prevents writing to `/home/`, `/Users/`, `~/` paths that don't exist in this environment. These are always wrong; retrying won't make them right.

**All other guards should be overridable** because they're protecting against quality issues, not security issues. The override log gives May visibility to catch patterns.

Note: The cross-edit-guard is implemented differently (in `write.ts`/`edit.ts` directly, not as a `BeforeToolCallHook`), so it's naturally excluded from the `composeGuards` override mechanism.

## Recommended Approach — Summary

### Two-layer design:

**Layer 1: finish() exemption** (solves the immediate trap problem)
- `composeGuards` checks if `toolCall.name === "finish"` and skips all guards except `finishGuard`.
- `finishGuard` itself gets a retry counter: blocks once, allows on second attempt with a downgrade warning.

**Layer 2: Retry-based override for all guards** (solves the general case)
- Each guard in `composeGuards` gets wrapped with retry detection.
- If the same `(guard, toolName)` pair blocks twice within 3 turns, the second block is downgraded to `{ block: false }` and a `guard_override` event is logged.
- Non-overridable guards (cross-edit, path-hallucination hard blocks) are marked with a `nonOverridable: true` flag.

### Priority: **Implement Layer 1 first.** It's 90% of the value with 10% of the effort. Layer 2 is nice-to-have — we haven't seen agents get trapped by non-finish guards in practice (cost-limit trapping finish() was the actual incident).

## Changes Needed

### Layer 1 (finish() exemption)

| File | Change |
|------|--------|
| `src/lib/tools/compose-guards.ts` | In `composeGuards`, add early return for `finish` tool calls: skip all guards except those marked as `finishRelevant`. |
| `src/lib/tools/finish-guard.ts` | Add retry counter. On second consecutive block of same `finish()` call, downgrade to warning. Add `guardName: "finish-guard"` identifier. |
| `src/lib/tools/cost-limit-guard.ts` | No changes needed — finish() simply bypasses it. |
| `src/lib/manager-receipts.ts` | Add `guard_override` event emission when a guard is overridden (downgraded from block to warning). |

**Interface change** to `BeforeToolCallHook`:
```typescript
// Guards that should still run on finish() calls
interface GuardMetadata {
  finishRelevant?: boolean;    // true = run even on finish() calls
  nonOverridable?: boolean;    // true = never allow override (security guards)
  name: string;                // guard identifier for logging
}

// Extended hook type
type GuardedHook = BeforeToolCallHook & { __guardMeta?: GuardMetadata };
```

### Layer 2 (retry-based override — deferred)

| File | Change |
|------|--------|
| `src/lib/tools/compose-guards.ts` | Wrap each guard with retry tracking. Maintain `Map<string, { count, lastMessageIdx }>` keyed by `${guardName}:${toolName}`. |
| `src/lib/manager-receipts.ts` | Emit `guard_override` events to session log and may.db. |
| DB migration | Add `guard_overrides` table to may.db. |

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Agent abuses override to skip quality checks** | Medium | Override is logged; May reviews guard_overrides in async evaluation. Finish-guard downgrade still marks the session — the override is visible. |
| **Retry detection has false positives** (agent legitimately retries after fixing the issue, but guard thinks it's an override) | Low | The "within 3 turns" window is short enough that if the agent actually fixed the issue, the guard wouldn't block again. False positives only happen when the agent retries without fixing — which is exactly when override should fire. |
| **Non-overridable list is too restrictive** | Low | Start with only cross-edit-guard. Can add more later based on data. |
| **Guard metadata adds interface complexity** | Low | `__guardMeta` is optional — existing guards work unchanged. Only guards that need special behavior need to set it. |
| **finish() exemption hides real problems** (agent finishes without evidence) | Medium | finish-guard still runs on finish() — only other guards (cost-limit, read-dedup, etc.) are skipped. The evidence quality signal is preserved. |

## Estimated Implementation Effort

| Layer | Files | Effort | Value |
|-------|-------|--------|-------|
| Layer 1: finish() exemption | 3 files (compose-guards, finish-guard, manager-receipts) | ~2 hours | High — eliminates the trap |
| Layer 2: retry-based override | 3 files + DB migration | ~4 hours | Low — theoretical risk, no incidents yet |
| **Total Layer 1** | | **~2 hours** | |

**Recommendation**: Ship Layer 1 only. Revisit Layer 2 if we see agents getting trapped by non-finish guards.

## Alternative Considered: "Allowlist" approach

Instead of making finish() exempt, we could maintain an allowlist of tools that are always permitted. This is more general but harder to reason about — which tools should always be allowed? `read()`? `checkpoint()`? The list grows over time and becomes its own maintenance burden.

The finish()-specific exemption is simpler, covers the actual failure mode, and is easy to audit.
