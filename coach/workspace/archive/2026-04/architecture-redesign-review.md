# Architecture Redesign — Coach Review

**Date**: 2026-04-01  
**Reviewer**: Coach  
**Document**: `agents/shared/may-agent-docs/design/architecture-redesign.md`

---

## TL;DR

The redesign is a genuine simplification. The current system already has an EventBus, but it's half-committed — events flow through the bus, but commands use a separate `onCommand`/`command` callback mechanism, DB writes are scattered across manager, persistence, cron, and may.ts, and the bus is UI-focused rather than system-wide. The redesign completes what's already started. I support it.

The hard parts are (1) extracting DB writes from manager.ts into a subscriber, (2) migrating cron's 15+ direct `getDb()` calls, and (3) deciding what `call` actually means at the bus level. None of these are blockers — they're just the real work.

---

## Does This Simplify the Current System?

**Yes, significantly.** Here's what the current system looks like from the inside:

| Concern | Current (scattered) | Redesign (bus) |
|---------|-------------------|----------------|
| Event flow | `EventBus` emits to UI listeners | Same, but bus is the spine |
| Commands | `bus.onCommand(handler)` — single callback in may.ts, 80-line switch | Commands are just events on the bus |
| DB writes | `upsertSession()` in persistence.ts, `trackRequest()`/`updateRequest()` in cron.ts, `updateSessionDb()` in manager.ts, `writeSkippedEvaluations()` in may.ts | Single `DbWriter` subscriber |
| Cron → Core | Cron calls `manager.run()` directly, imports `getDb` for overlap detection | Cron emits `fork` commands, reads DB for history |
| Session recovery | `manager.resumeStaleSessions()` called manually in may.ts startup | Could be a startup event or component concern |
| Context learning | Inline anonymous `bus.on()` handler in may.ts (~50 lines) | Dedicated `ContextLearner` subscriber |

The biggest win: **may.ts goes from 1089 lines to ~100.** Right now it's the god module — it creates the bus, manager, loads agents, sets up all event handlers, wires cron, handles commands, manages shutdown, does context learning inline, tracks recovery attempts, manages readline, etc. The redesign breaks this into focused components.

---

## What Breaks? What's Hard to Migrate?

### 1. DB Writes Are Deeply Embedded in Manager (Hard)

`manager.ts` (2424 lines) calls `upsertSession`, `updateSessionDb`, `trackRequest`, and `updateRequest` directly — at least 15 call sites. The redesign says "DB writer subscriber handles all writes," but manager session-state transitions (`running → done → archived`) are tightly coupled to the DB.

**Migration path**: Manager would need to emit events like `{ type: "session_status_change", sessionId, status, error }` and let the DB subscriber persist them. This is doable but requires touching nearly every state transition in manager.ts. Risk: race conditions if the DB subscriber falls behind and something queries stale data.

**Recommendation**: Phase 2 should start with cron's DB writes (simpler, fewer call sites) before tackling manager's. Manager might keep direct DB writes longer, with the bus subscriber handling the "optional" writes (eval, context-learn, escalation tracking).

### 2. Cron's Direct DB Access (Medium)

`cron.ts` has 15+ `getDb()` calls for overlap detection, last-fire-time queries, and request tracking. The redesign says cron "reads DB for job history" — that's a direct read, which is fine. But cron also _writes_ to the DB (trackRequest, updateRequest) when firing jobs.

**Migration**: Cron emits `fork` commands → Core starts sessions → Core emits session_start → DB subscriber writes. For the tracking part, cron could emit `cron_fired` events that the DB subscriber persists. The overlap detection stays as direct DB reads (the redesign explicitly allows this).

### 3. The `call` Semantics Are Underspecified

The redesign says `call` is "internal to core — not a bus command." But the current `agents.call()` tool blocks the calling agent's turn until the child completes. This means:

- The calling agent's execution is suspended
- The child session runs to completion
- The result flows back through the manager

This works fine as-is and doesn't need the bus. But the design doc should be explicit: **`call` never touches the bus except for the session_start/session_end observations it produces.** The diagram shows it correctly, but the migration guide should call out that `call` is exempt from the "everything through the bus" principle.

### 4. The Command Routing in may.ts Is Non-Trivial

The current `bus.onCommand()` handler does more than routing:
- `steer` checks if session is idle vs running, uses different manager methods
- `run` tracks requests before spawning
- `cancel_task` vs `cancel` vs `cancel_all` have different semantics
- Reload triggers agent-loader hot-reload

In the redesign, Core subscribes to `fork`, `input`, `steer`, `cancel` as events. But who handles `cancel_all`? Who handles `run` (which is `fork` + request tracking)? The mapping isn't 1:1.

**Recommendation**: Define the exact event types for edge cases. Or accept that Core's event handler will have a switch statement similar to today's command handler — just located in a different file.

### 5. Ambulance Protocol (Session Recovery)

The current system has recovery logic in may.ts: when a session errors with infra failure, it auto-requeues up to 2 times, with escalation on exhaustion. In the redesign, this could be:
- Core emits `session_end` with error
- A recovery subscriber listens, decides whether to emit a new `fork`
- The recovery subscriber tracks attempts (in-memory or DB)

This actually fits the bus model well — it becomes a clean subscriber. But it needs to be called out as a component (it's not in the architecture diagram).

---

## What's Missing From the Design?

### 1. Error Handling / Event Ordering Guarantees

The EventBus catches subscriber errors (`try { fn(event); } catch { /* never breaks anyone */ }`). Good — one broken subscriber doesn't crash the system. But:

- What if the DB subscriber throws on a critical write? The event is lost silently.
- Is there any ordering guarantee? If two events fire rapidly, do all subscribers see them in order?
- The current implementation is synchronous (for loop), which gives ordering. If it ever goes async, this breaks.

**Recommendation**: Add a `deadLetterQueue` or at minimum log subscriber errors instead of swallowing them. The current `/* never breaks anyone */` comment is aspirational but dangerous for data integrity.

### 2. Evaluation Pipeline

The current may.ts has auto-evaluation logic: when a child session completes under a task session, it runs `evaluateTask()`, then emits `context-learn` events for each evaluated agent. This is a multi-step workflow triggered by `session_end`.

In the redesign, this could be an `Evaluator` subscriber (not shown in the diagram). It subscribes to `session_end`, checks if the session is a task child, runs evaluation, emits results.

### 3. Hot-Reload Details

`reload` reloads agent configs from disk. But the current `reloadAgents()` touches the agent-loader, which modifies the manager's agent registry. If Core owns the manager, and reload is a bus event, Core handles it — fine. But does the cron need to re-read its config too? Currently cron has its own file watcher. The bus event could replace that.

### 4. Health Monitoring / Watchdog

Not mentioned in the redesign. The current system has a watchdog cron handler that checks for stuck sessions. Where does this live? It's a natural bus subscriber: subscribe to `session_start`, track durations, emit alerts when sessions exceed thresholds.

### 5. Web UI Authentication/Authorization

The redesign mentions Web UI reads DB directly. But there's no mention of how the web UI authenticates or how it's authorized to emit commands. The socket currently trusts all connections. This is fine for local development but matters for deployment.

---

## Does It Align With How I Work?

### Delegation (`call`, `fork`, `message`)

The three-mode model matches exactly how I use the `agents` tool:
- `call` for synchronous gym runs and agent evaluations (I block until the result comes back)
- `fork` for background experiments (I start it and continue)
- `message` for sending work to other agents (fire-and-forget)

The redesign preserves these semantics. `call` stays internal to core (good — I don't want bus latency in my synchronous calls). `fork` and `message` go through the bus (fine — they're async anyway).

### Gym Runs

My gym experiments spawn sub-agents via workflows and `call`. These are purely internal to core. The redesign doesn't change this at all — it's still `manager.callAgent()` under the hood.

### Context Learning

Currently context learning is an inline handler in may.ts that fires on my session endings. The redesign makes it a proper `ContextLearner` component. This is better — I can be excluded cleanly (the current code already has a `["evaluator", "coach", "judge"].includes(agentName)` check, which is fragile).

### One Concern: Event Storm During Gym Runs

When I run a growth-cycle, I spawn 5-10 agent sessions. Each produces session_start, multiple turn_end, tool_call, tool_result, and session_end events. In the redesign, every subscriber gets every event. The DB subscriber will be writing during every tool call.

This is fine if the event volume is manageable, but during a training sprint (30+ sessions), the DB subscriber will be doing a LOT of writes. The current system avoids this because most session events don't hit the DB — only meta.json files on disk.

**Question**: Does the DB subscriber persist ALL event types, or just the lifecycle ones (session_start, session_end, cron_fired)? The design says it subscribes to `session_start, session_end, message_created, eval, cron_fired` — that's selective. Good. But it should be explicit that `text`, `tool_call`, `tool_result`, and `turn_end` are NOT persisted to the DB (they're already on disk in transcript files).

---

## Summary Verdict

| Question | Answer |
|----------|--------|
| Simplifies current system? | **Yes** — may.ts shrinks from 1089 to ~100 lines, components get clear boundaries |
| What breaks? | DB writes in manager.ts need careful extraction; cron's direct DB access needs migration |
| What's missing? | Error handling strategy, evaluation pipeline, watchdog, recovery protocol |
| Aligns with my work? | **Yes** — call/fork/message semantics preserved, gym runs unaffected |
| Recommended? | **Yes, proceed with phased migration** |

### Suggested Phase Order

1. **Phase 0** (prerequisite): Audit all `getDb()` / `trackRequest()` / `updateRequest()` calls across the codebase. Map which component owns which writes.
2. **Phase 1**: Unify the command channel — replace `bus.onCommand()` with commands-as-events. Move command handling from may.ts inline switch into Core's event handler.
3. **Phase 1.5**: Extract Context Learner and Evaluator from may.ts into standalone subscribers.
4. **Phase 2**: Extract cron's DB writes into the DB subscriber (easier, fewer call sites).
5. **Phase 2.5**: Extract recovery protocol (ambulance) into a subscriber.
6. **Phase 3**: Tackle manager's DB writes (hardest, most call sites, most risk).
7. **Phase 4**: Thin startup — compose everything in ~20 lines.

### Open Questions for Hao

1. **Event ordering**: Is synchronous dispatch (current) guaranteed forever, or might we go async? This affects whether subscribers can depend on seeing events in order.
2. **DB subscriber error policy**: Silent swallow, retry, or dead-letter queue?
3. **Manager extraction timeline**: Phase 3 is the hardest. Is it worth doing, or should manager keep its direct DB writes indefinitely? The 80/20 rule might say "everything else through the bus, manager stays special."
4. **Event volume during training sprints**: Should we add event filtering per subscriber (subscribe to specific types), or keep the broadcast model and let subscribers filter internally?
