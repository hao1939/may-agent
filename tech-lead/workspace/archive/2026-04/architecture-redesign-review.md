# Architecture Redesign Review

**Reviewer**: tech-lead  
**Date**: 2026-04-01  
**Document**: `agents/shared/may-agent-docs/design/architecture-redesign.md`

---

## Executive Summary

The design correctly identifies the coupling problem — may.ts (1089 lines) is a god-object orchestrator that manually wires 29 `manager.*` calls to the EventBus via callback-heavy glue code. The proposed solution (unified EventBus, component subscribers) is the right direction. But the document underestimates the migration difficulty and has gaps that will cause bugs in production.

**Verdict**: Good architecture. Incomplete migration plan. Needs 3 design clarifications before Phase 1 can start.

---

## Question 1: Does this simplify the current system?

**Yes, significantly.** Here's the concrete comparison:

### Current: Split event/command model with manual wiring

`src/app/event-bus.ts` (line 108-126) has two separate mechanisms:
- **Events**: `on(listener)` / `emit(event)` — broadcast to all listeners
- **Commands**: `onCommand(handler)` / `command(cmd)` — single handler, request/response

This forces may.ts to be the glue: it registers a single `bus.onCommand()` handler (line 585-720) that switches on 10+ command types and calls `manager.*` directly. Every command goes through may.ts.

```
Socket → bus.command() → may.ts onCommand switch → manager.run/cancel/steer/input → ...
```

### Proposed: Unified subscribe/emit

All components subscribe directly. Core handles `fork`, `cancel`, `input`, `steer`. Cron handles `cron_fired`. No central switch statement.

```
Socket → bus.emit({type:"fork"}) → Core subscriber handles it directly
```

**The win**: may.ts's 200-line command handler (lines 585-720) disappears. The 40-line `attachAgentEvents()` function (lines 383-415) moves into Core. The context-learn subscriber (lines 335-383) moves into its own component. Each component owns its own event handling.

**Net code reduction estimate**: may.ts drops from ~1089 to ~200 lines (startup, CLI parsing, models). The command routing, event wiring, recovery logic, and context learning each move to the component that owns them.

### What the current EventBus gets right that the proposal preserves

The current `emit()` already has `try/catch` per listener (line 117-120). Good — the proposal keeps this. The current event types (SessionEvent, SystemEvent) are already well-defined (lines 10-46) — the proposal extends them with command events.

---

## Question 2: What breaks? What's hard to migrate?

### Hard Problem #1: manager.ts is the real monolith, not may.ts

The design talks about simplifying may.ts, but the real problem is `manager.ts` at 2424 lines. The SubagentManager is a god-class that does:

1. **Session lifecycle** (run, cancel, input, steer, waitFor, waitForIdle)
2. **Persistence** (subscribeForPersistence, appendSessionMessage, registry ops)
3. **Agent creation** (Agent instantiation, tool wrapping, system prompt resolution)
4. **Recovery** (resumeStaleSessions, cleanupZombieSessions)
5. **Depth tracking** (callDepths, findRootSession)
6. **Health monitoring** (health, auditHealth, reconcileHealth)
7. **Memory** (appendMemoryEntry, readMemoryEntries)
8. **Workflow support** (traces, workflow runs)

The design says Core "subscribes to commands" but doesn't address breaking up the SubagentManager. If Core is just SubagentManager wrapped in bus subscriptions, we haven't simplified — we've added a layer.

**Recommendation**: The design should specify which SubagentManager methods become Core methods vs. which get extracted. Specifically:
- `subscribeForPersistence()` (line 242) should move to DB Writer
- `resumeStaleSessions()` and `cleanupZombieSessions()` should be startup concerns, not Core
- `health()`/`auditHealth()`/`reconcileHealth()` are read-only queries — they should read DB directly, not go through Core

### Hard Problem #2: 46 direct manager calls across src/app/

```
src/app/may.ts:          29 calls to manager.*
src/app/chat-session.ts: 17 calls to manager.*
src/app/ui/socket.ts:     2 calls to manager.*
src/app/cron.ts:           1 call to manager.run()
```

`chat-session.ts` (392 lines) is particularly tangled — it calls `manager.status()` 7 times, `manager.cancel()` 3 times, `manager.run()` 2 times. To migrate this:
- `manager.run()` → `bus.emit({type: "fork"})` ✓ straightforward
- `manager.cancel()` → `bus.emit({type: "cancel"})` ✓ straightforward
- `manager.status()` → ??? The design says "read DB directly" but `manager.status()` returns **in-memory** active session state (running/idle, runtime, current task). This isn't in SQLite. The DB only has persisted session metadata.

**This is the critical gap.** The design says "Infra needs data now → Read DB directly" but the current system's status comes from in-memory `ActiveSession` objects (manager-utils.ts lines 176-243) that have live state like `turnCount`, `totalToolCalls`, `consecutiveErrorTurns`, `status: "running" | "idle"`. The DB has stale snapshots.

**Options**:
1. Core exposes a synchronous `status()` method alongside bus subscriptions (hybrid)
2. DB Writer keeps live state updated on every turn_end event (but adds latency)
3. Accept that bus-only consumers can't query live status

I'd go with option 1 — Core has a `getActiveSessions()` synchronous method. Components that need live status import Core directly. The bus is for commands and observations, not queries.

### Hard Problem #3: The recovery/escalation chain

The current onSessionComplete callback in may.ts (lines 251-323) does:
1. Classify the error (`classifyError`)
2. Auto-requeue on infra errors (up to MAX_RECOVERY_ATTEMPTS)
3. Escalate to human on exhaustion
4. Auto-evaluate completed task trees
5. Emit context-learn events

This is ~70 lines of orchestration logic that depends on both `manager.run()` (to requeue) AND `bus.emit()` (to notify) AND `escalateToHuman()` (file + telegram). In the new design, this lives in Core as a `session_end` handler, but Core would need to:
- Call its own `run()` to requeue (fine — it owns sessions)
- Emit events for context-learn and evaluation (fine — it emits to bus)
- Call `escalateToHuman()` which writes to `escalations.jsonl` AND sends Telegram

The Telegram dependency is the awkward part. Currently it's a module-scoped `telegramAlert` function that's late-bound (may.ts line 238). In the new design, Core shouldn't know about Telegram. Solution: Core emits a `notification` event, and the Telegram subscriber handles it. That works — the `notification` event type already exists in the proposal.

### Hard Problem #4: 98 test files, 1490 test cases

Tests import `SubagentManager` directly in 51 files. Any interface changes (renaming methods, changing constructor signature, splitting the class) break tests immediately. The migration must preserve the `SubagentManager` API or provide a compatibility shim.

Tests that will need changes:
- Tests importing `EventBus` (5 files) — type changes if events/commands merge
- Tests importing `SubagentManager` (51 files) — if constructor changes
- Tests importing from `manager-utils.ts` (ActiveSession, RunOptions) — if these move

**Recommendation**: Phase 1 should NOT change SubagentManager's public API. Instead, add the bus integration on top. Core wraps SubagentManager and translates bus commands to manager calls. Later phases can refactor the internals.

---

## Question 3: What's missing from the design?

### Missing #1: Live status queries

Covered above. The design says "read DB directly" but live session status isn't in the DB. Need a synchronous query path.

### Missing #2: Error propagation for `fork` commands

The design says the bus is fire-and-forget. But what happens when a `fork` command fails? Example: `bus.emit({type: "fork", agent: "nonexistent", task: "..."})`. Core's subscriber tries to start the session, gets an error. Currently `manager.run()` throws synchronously. In the bus model, the error is silently caught by the subscriber's try/catch.

The caller (Cron, Socket) never knows the fork failed. This is a regression from the current behavior where `manager.run()` throws and the caller handles it.

**Solution needed**: Core should emit a `session_end` with `status: "error"` immediately when a fork fails, or emit a `fork_rejected` event. The design should specify this.

### Missing #3: Ordering guarantees

The design says "No correlation IDs. No response events." But consider:
1. Socket sends `cancel` for session X
2. Socket immediately sends `fork` for a new session
3. Bus delivers them out of order (unlikely with sync emit, but possible with async subscribers)

The current bus is synchronous (`for (const fn of subscribers) fn(event)`) so ordering is preserved per-emit. But if any subscriber is async (like context-learn which uses `setTimeout`), ordering of *side effects* is not guaranteed.

The design should state explicitly: **bus.emit() is synchronous. Subscribers that do async work must not depend on ordering with other subscribers.**

### Missing #4: Back-pressure / rate limiting

The current system has no back-pressure problems because it's synchronous. But with the bus model, what stops a runaway component from flooding the bus? Example: a broken cron handler that emits `fork` in a loop. Currently, may.ts's command handler can reject commands. In the bus model, the fork goes straight to Core.

Not critical for Phase 1 (the current system has the same problem) but should be noted as a future concern.

### Missing #5: Cost/usage tracking path

The design mentions `eval` events but doesn't mention usage tracking (token counts, cost). Currently, this data flows through `manager-retry.ts` and session metadata. The design should clarify: does usage data flow through the bus, or does it go directly to the DB?

Current flow: `pi-agent-core` → AgentEvent → manager subscription → session metadata → archival.
The design should state: usage tracking stays inside Core (not a bus concern). It's internal bookkeeping that's persisted to session metadata files.

### Missing #6: The `workflow` event type

The current EventBus (event-bus.ts lines 32-42) has a `workflow` event type that's missing from the proposed event types. Workflows emit `start`, `step_start`, `step_done`, `done`, `escalated` events. These are used by the Console UI and Socket UI. The redesign should either include them or explain why they're removed.

### Missing #7: The `eval` event type

Similarly, `eval` events (event-bus.ts lines 43-52) are in the current system but missing from the proposal. These carry verdict, efficiency, quality, tokens, cost data.

### Missing #8: subscribe → sessions (V2 protocol)

The current socket protocol has a `subscribe` command (event-bus.ts line 102) that lets clients filter events by session IDs. The redesign doesn't address per-session filtering. Without it, every socket client gets every event from every session, which doesn't scale.

This filtering is currently done in socket.ts, not in the bus. That's correct — the bus broadcasts everything, and consumers filter. The design should explicitly state this pattern continues.

---

## Question 4: Does it align with how agents work?

**Yes, the cooperation model is well-aligned.** The three modes (call/fork/message) map exactly to the current agents tool:

| Agents tool action | Current implementation | Proposed |
|---|---|---|
| `call` | `manager.callAgent()` (line 2280+) | Same — internal to Core, blocks caller |
| `fork` (was `run`) | `manager.runAgent()` (line 2402+) | Bus command `{type: "fork"}` |
| `message` (was `send`) | `trackRequest()` to DB | Bus command `{type: "message"}` → Core writes to request DB |

The key insight the design gets right: **`call` should NOT go through the bus.** It's synchronous and internal. The calling agent awaits the result. Putting this on the bus would add complexity for no benefit.

Where I have a concern: the design says `message` goes through the bus (`{type: "message"}`), but currently it goes directly to the request DB via `trackRequest()` (in `manager-agents-tool.ts`). Since the bus `message` handler would just... call `trackRequest()`, this adds indirection without benefit. I'd keep `message` as a direct DB write and not route it through the bus.

**Counter-argument**: if DB Writer is the only component that writes to the DB, then message must go through the bus so DB Writer can handle it. But the design already says "Anyone reads DB directly" — so maybe anyone should write to it too? The DB-as-shared-store model is simpler than DB-as-subscriber-only-write.

---

## Question 5: Is the migration path realistic?

### Phase 1: Unified EventBus — REALISTIC with caveats

**What "15-line EventBus" actually means:**

The current EventBus is 147 lines with types. The proposed bus is functionally simpler (no `onCommand`/`command` methods — just `subscribe`/`emit`). But the type union grows from ~20 event variants to ~30 (adding command events).

Phase 1 steps I'd actually do:

1. **Add command event types to the existing `AgentEvent` union** (event-bus.ts). Keep the old `onCommand`/`command` methods for backward compat.
2. **Add Core as a bus subscriber** that handles `fork`, `cancel`, `input`, `steer` by calling `manager.*` methods.
3. **Migrate may.ts's command handler** to emit bus events instead of calling manager directly.
4. **Migrate chat-session.ts** to emit bus events for fork/cancel.
5. **Run the full test suite** — nothing should break because the manager API is unchanged.

**Estimated effort**: 2-3 days of focused work. Mostly mechanical rewiring.

**Test risk**: LOW for Phase 1. The SubagentManager API doesn't change. The EventBus gets new event types but old types still work. Tests that import `EventBus` directly (5 files) may need type updates.

### Phase 2: DB writes through subscriber — HIGH RISK

This is where it gets dangerous. Currently, persistence is deeply embedded in SubagentManager:
- `subscribeForPersistence()` (line 242-324) — 80 lines of event-to-JSONL mapping
- `handleCompletion()` (line 700-1035) — 335 lines of session archival, memory writing, request updates
- `registry.saveSession()` / `registry.updateSessionStatus()` — scattered throughout

Extracting this into a DB Writer subscriber means:
1. Every event that currently triggers a DB write must now also emit a bus event
2. The DB Writer must reconstruct the same write logic from bus events
3. **Ordering matters**: session archival must happen AFTER all messages are persisted. Currently this is guaranteed by the synchronous `handleCompletion()` flow. With a subscriber model, ordering depends on emission order.

**I'd defer Phase 2.** The JSONL persistence is tightly coupled to the agent event stream (not the bus event stream). Moving it to a bus subscriber would require either:
- Duplicating all AgentEvents on the bus (noisy, high volume)
- Or keeping the per-session subscription in Core and only emitting summary events

The pragmatic path: Core keeps `subscribeForPersistence()` internally. DB Writer only handles high-level events (session_start, session_end, cron_fired). JSONL writes stay in Core.

### Phase 3: Thin startup — REALISTIC after Phase 1

Once Core wraps the manager and subscribes to the bus, startup simplifies naturally:

```typescript
const bus = new EventBus();
const core = new Core(bus, { persistDir, projectRoot, models });
const socket = new SocketServer(bus, socketPath);
if (cronEnabled) new CronScheduler(bus, core, cronConfig);
// ...
```

This can be ~50 lines of component creation + ~100 lines of CLI parsing + ~50 lines of model definitions = ~200 lines. Realistic.

---

## Specific Recommendations

### Do First (Pre-Phase-1)
1. **Define the Core interface** — what methods does it expose beyond bus subscriptions? At minimum: `getActiveSessions()`, `hasAgent()`, `agentNames()`.
2. **Decide on `message` routing** — bus command or direct DB write?
3. **Add `fork_error` event** — for failed fork commands.

### Phase 1 (Safe)
4. Extend EventBus types with command events.
5. Create Core class that wraps SubagentManager + subscribes to bus.
6. Migrate may.ts command handler to bus emissions.
7. Migrate cron to emit `fork` instead of calling `manager.run()`.
8. Full test suite passes.

### Phase 2 (Defer or scope down)
9. Extract context-learn into standalone subscriber (low risk — it's already event-driven via `context-learn` events).
10. Extract escalation/recovery into Core's session_end handler (medium risk).
11. **Skip**: DB Writer for JSONL persistence. Keep it in Core.

### Phase 3 (After Phase 1+2 stabilize)
12. Thin startup in may.ts.
13. Remove deprecated `onCommand`/`command` from EventBus.

---

## What the Design Gets Right

1. **`call` stays internal to Core** — no bus overhead for synchronous agent calls. This is the right call (pun intended).
2. **DB is optional** — tests and gym can run without SQLite. This preserves the current test architecture.
3. **Subscriber error isolation** — `try/catch` per subscriber. One broken subscriber doesn't crash the system.
4. **Shutdown is not a bus problem** — explicit startup-order-reversed teardown. Correct.
5. **Three cooperation modes** — matches exactly how agents work today.
6. **Socket as bridge** — clean separation between transport and logic.

## What Needs Rework

1. **Live status queries** — "read DB" doesn't work for in-memory session state. Core needs a sync query method.
2. **Fork error handling** — silent failures are a regression. Add fork_error events.
3. **Phase 2 scope** — JSONL persistence extraction is too risky. Scope it down to high-level events only.
4. **Missing event types** — `workflow` and `eval` events from current system aren't in the proposal.
5. **SubagentManager decomposition** — the design doesn't address the 2424-line monolith. Phase 1 should wrap it, not rewrite it.

---

## Summary

| Aspect | Assessment |
|--------|-----------|
| Core concept (unified bus) | ✅ Good — simplifies the command routing maze |
| Event type design | ⚠️ Mostly good — missing workflow, eval, fork_error |
| Migration Phase 1 | ✅ Realistic — 2-3 days, low test risk |
| Migration Phase 2 | ❌ Too risky as written — scope down to high-level events |
| Migration Phase 3 | ✅ Realistic after Phase 1 |
| Missing: live status | ❌ Must be addressed before implementation |
| Missing: fork errors | ⚠️ Should be addressed — silent failures are bad |
| Alignment with agents | ✅ call/fork/message maps perfectly |
| Test compatibility | ✅ Phase 1 preserves SubagentManager API |

**Bottom line**: Ship Phase 1 after resolving the 3 design gaps (live status, fork errors, missing event types). Defer Phase 2 DB extraction. The architecture is sound — the migration plan needs refinement.
