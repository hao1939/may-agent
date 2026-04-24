# Audit: Turn Budget Enforcement End-to-End Flow

**Date**: 2026-04-13  
**Scope**: `src/lib/manager-utils.ts` (config), `src/lib/manager.ts` (enforcement), integration points in cron/may/persistence  
**Auditor**: tech-lead

---

## 1. Architecture Overview

The turn budget system is a **two-phase enforcement mechanism**:
- **Soft limit**: At `maxTurns`, inject a steer message telling the agent to wrap up
- **Hard limit**: At `maxTurns + TURN_BUDGET_GRACE`, force-abort the session

The entire implementation lives in **one code path** — the `message_end` subscriber in `subscribeForPersistence()` (manager.ts:278–315). This is remarkably compact: ~35 lines of logic.

## 2. Full Data Flow Trace

### Phase A: Budget Assignment (session creation)

1. **Cron heartbeats** → `cron.ts:747` sets `maxTurns: TURN_BUDGET_TIERS.heartbeat` (= 8)
2. **Event bus forks** → `may.ts:814` passes `maxTurns: event.opts?.maxTurns` (caller-specified or undefined)
3. **Agent tools (fork/call)** → Tools do NOT pass maxTurns at all (not in `src/lib/tools/*.ts`)
4. **`manager.run()`** → `manager.ts:1007` sets `maxTurns: opts?.maxTurns ?? 0` (0 = unlimited)
5. **Persistence** → `maxTurns` is persisted in session metadata (`persistence.ts:60`) for crash recovery
6. **Restored sessions** → `manager.ts:1441` reads `persisted.maxTurns ?? RESTORED_MAX_TURNS_FALLBACK` (fallback = 0)

**Finding F1**: Only cron heartbeats get a budget. Agent-forked/called sessions are ALWAYS unlimited (maxTurns=0). The `TURN_BUDGET_TIERS` config defines `research: 15` and `implementation: 25` tiers that are **never referenced anywhere** — dead config.

### Phase B: Turn Counting (runtime)

1. **Event subscription** → `subscribeForPersistence()` subscribes to `session.agent.subscribe()`
2. **Trigger** → On `event.type === "message_end"` where `event.message.role === "assistant"`
3. **Increment** → `session.turnCount++` (manager.ts:287)
4. **Reset** → `session.turnCount = 0` when chat session goes idle (manager.ts:809)

A "turn" = one assistant message (LLM response). This is counted in the subscriber callback, which fires *after* the message is fully streamed.

### Phase C: Soft Budget Check (nudge injection)

Triggered when `session.turnCount === softLimit` (exactly equal):

1. Emits info bus event: `[turn-budget] Session ... reached soft limit`
2. Calls `session.agent.steer()` to inject a user-role wrap-up message
3. The steer message tells the agent it has `TURN_BUDGET_GRACE` (= 2) more turns

### Phase D: Hard Limit Enforcement (force-close)

Triggered when `session.turnCount >= hardLimit` (hardLimit = softLimit + 2):

1. Emits warn bus event: `[turn-budget] Session ... exceeded hard limit`
2. Calls `session.abortController.abort()` — signals the infra abort
3. Calls `session.agent.abort()` — signals the LLM agent to stop

---

## 3. Findings & Severity Ratings

### F1: Dead Tier Config — SEVERITY: LOW (waste/confusion)

```ts
// manager-utils.ts:163-167
export const TURN_BUDGET_TIERS = {
  heartbeat: 8,
  research: 15,        // ← NEVER USED
  implementation: 25,  // ← NEVER USED
};
```

Only `TURN_BUDGET_TIERS.heartbeat` is imported (by `cron.ts`). The `research` and `implementation` tiers exist but no code classifies sessions into these tiers or uses them. This is dead config — not harmful, but misleading for anyone reading the code.

### F2: Agent-Spawned Sessions Have No Budget — SEVERITY: MEDIUM (design gap)

When agents fork/call sub-sessions via the `agents` tool, no `maxTurns` is passed. These sessions run unlimited. The only backstop is the wall-clock timeout watchdog.

This means a heartbeat agent gets an 8-turn budget, but if it forks a coder session, that coder runs unlimited. The tiered budget design doc (referenced at manager-utils.ts:162) presumably intended for child sessions to also be budgeted, but the plumbing was never built.

**Impact**: Runaway child sessions aren't caught by turn budget. The watchdog timeout is the only safety net.

### F3: Soft Limit Uses Exact Equality — SEVERITY: LOW (minor fragility)

```ts
if (session.turnCount === softLimit) {  // exactly equal
```

If `turnCount` somehow skips over the exact value (e.g., restored from a crash where the count was reconstructed imprecisely), the soft nudge would be skipped entirely and only the hard `>=` check would fire. In practice this is unlikely because:
- turnCount increments by 1 each time
- Restored sessions reconstruct turnCount from `savedMessages.filter(m => m.role === "assistant").length` (manager.ts:1427) — accurate

But the asymmetry (soft uses `===`, hard uses `>=`) is a minor code smell. The hard limit correctly uses `>=` for robustness.

### F4: Chat Session turnCount Reset — SEVERITY: LOW (cosmetic)

```ts
// manager.ts:809
session.turnCount = 0;
```

When a chat session goes idle (user stops typing), `turnCount` resets to 0. This means the budget effectively resets per conversation turn for chat sessions. This is intentional behavior (chat sessions use `autoClose: "never"`), but it means turn budgets are meaningless for chat sessions. Since chat sessions typically have `maxTurns: 0` anyway, this is a non-issue.

### F5: No Feedback Loop on Budget Effectiveness — SEVERITY: LOW (observability)

The bus events (`[turn-budget] Session ... reached soft limit`) are emitted but there's no tracking of:
- How often soft limits fire vs how often agents actually wrap up in the grace period
- How often hard limits have to force-close (indicating the soft nudge failed)
- Whether the nudge message is effective at all

This is an observability gap, not a bug.

### F6: Steer Timing — SEVERITY: LOW (race window)

The `steer()` call injects a user message into the agent's conversation. This fires inside the `message_end` subscriber, which means:
1. The LLM just finished an assistant message (turn N)
2. The subscriber fires, increments turnCount, detects soft limit
3. `steer()` injects a wrap-up user message
4. The LLM is about to process tool results from turn N

The steer message is queued and the LLM will see it on its next turn. This is correct behavior — there's no race condition here because the event loop is single-threaded and `steer()` just appends to the message queue.

---

## 4. Complexity Assessment

**Layers of indirection**: 2 (config → session creation → runtime enforcement)

This is actually a **well-structured, low-complexity system**:
- Config in one place (`manager-utils.ts`)
- Assignment in one place (`manager.run()` / `restoreSession()`)
- Enforcement in one place (`subscribeForPersistence()`)
- No middleware chains, no complex state machines, no event cascades

The main complexity risk is the **dead config** (F1) and **incomplete plumbing** (F2) — the system was designed for tiered budgets but only the heartbeat tier was wired up. This creates a false sense of coverage.

## 5. Summary

| Finding | Severity | Type | Action Needed |
|---------|----------|------|---------------|
| F1: Dead tier config (research/implementation) | LOW | Dead code | Delete or wire up |
| F2: Agent-spawned sessions unbudgeted | MEDIUM | Design gap | Decide: budget child sessions or accept watchdog-only |
| F3: Soft limit exact equality | LOW | Fragility | Change `===` to `>=` with a `!softNudgeSent` guard |
| F4: Chat session turnCount reset | LOW | Cosmetic | Intentional, document it |
| F5: No budget effectiveness tracking | LOW | Observability | Add metrics if budget matters |
| F6: Steer timing | LOW | Non-issue | Correct as-is |

**Overall verdict**: The turn budget system is simple, focused, and well-contained. The main concern is that it's **only partially deployed** — heartbeats get budgeted, everything else runs unlimited. If budget enforcement matters, F2 is the gap to close. If the watchdog timeout is sufficient, the tier config should be cleaned up to avoid confusion.
