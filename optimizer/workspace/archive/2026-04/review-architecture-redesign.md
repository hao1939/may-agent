# Architecture Redesign Review — Optimizer

**Date**: 2026-04-01
**Document reviewed**: `agents/shared/may-agent-docs/design/architecture-redesign.md`

## Executive Summary

The redesign is directionally correct and well-structured. It formalizes what already partially exists (EventBus is 147 lines today, already handles events + commands) and pushes toward cleaner component boundaries. My main concerns are: (1) the migration path underestimates how deeply may.ts is coupled to manager, (2) DB-as-subscriber creates a reliability gap for critical operations, and (3) some things that work today via direct calls would become more fragile through the bus.

---

## 1. Does This Simplify the Current System?

**Yes, meaningfully.** Here's what I see:

### Current pain points this solves
- **may.ts is 1,089 lines** of wiring glue — it manually bridges manager → bus, bus → cron, cron → manager, manager → DB. The redesign's "20-line startup" vision would eliminate ~800 lines of that.
- **Cron class (919 lines)** directly calls `manager.run()`, `getDb()`, `trackRequest()`, `updateRequest()` — 29 direct DB calls. Making it a bus-emitting component that only emits `fork` commands would cut Cron's responsibilities dramatically.
- **Direct call chains** like `may.ts:266 manager.run()` inside the bus event handler create circular-feeling logic. The redesign makes this unidirectional: Cron → bus → Core.

### What it doesn't simplify
- **Manager (2,424 lines)** is the real complexity center, and the redesign doesn't touch it. The manager handles session lifecycle, persistence, agent tools, retry logic, stuck detection, compaction, etc. "Core" in the redesign is basically "manager + bus adapter." The complexity moves but doesn't shrink.
- The **3 cooperation modes** (call/fork/message) already exist in the current system — they just have different names (`manager.run()`, `spawnDetachedAgent()`, `trackRequest()`). The redesign aligns the naming, which helps, but it's not a simplification of behavior.

### Net assessment: **Moderate simplification.** The main win is killing the glue code in may.ts and making component boundaries explicit. The core complexity (manager) remains.

---

## 2. What Breaks? What's Hard to Migrate?

### Hard breaks

1. **Cron's direct manager dependency.** Today, `new Cron(configPath, manager, ...)` takes a `SubagentManager` reference directly. The redesign says Cron only emits `fork` commands. But Cron currently does:
   - `manager.run()` for heartbeats (line ~675 in cron.ts)
   - Circuit breaker logic that reads manager session status
   - `heartbeatRunning` tracking that checks if sessions are active
   
   Moving all of this through the bus means Cron needs to *observe* session_start/session_end events to track what's running. That's a significant rewrite of Cron, not a thin adapter.

2. **Request tracking.** Today, `trackRequest()` and `updateRequest()` are called directly from manager, cron, and may.ts (39 total calls across these files). The redesign says "DB is an optional subscriber" and "the only component that writes to DB." But request tracking is used for:
   - Cron overlap detection (read+write)
   - Agent cooperation (message → trackRequest)
   - Session lifecycle (manager updates request status on completion)
   
   Making DB optional means: if DB subscriber fails or isn't attached, request tracking silently breaks. Today, these are synchronous calls that throw on failure. The bus swallows errors (`catch { /* never breaks anyone */ }`). This is a reliability regression for critical operations.

3. **Context learning.** Currently wired in may.ts as a bus event listener that calls `learnFromSession()`. The redesign's "Context Learner" subscriber looks clean on paper, but the current implementation needs `persistDir`, `agentsRoot`, and the LLM model reference to run. It's not just subscribing to an event — it needs substantial dependencies.

### Migration friction

4. **Socket UI passes `manager` reference directly.** The socket server currently takes `{ bus, manager, getSessionId, agentName, instance }`. The redesign wants Socket to only talk through the bus. But some commands (like `status`) need synchronous data from manager (list of active sessions). Either the bus needs request/response semantics (not in the design) or the socket keeps a manager reference (violating the architecture).

5. **Workflow's `ctx.runAgent()` is internal to Core.** The design says `call` is internal and that's fine. But today, workflows go through `manager.callAgent()` which does session creation, persistence, event subscription, etc. This just stays as-is, which is fine — but it means Core is still the monolith it is today, just with a bus adapter on top.

---

## 3. What's Missing from the Design?

### Critical gaps

1. **Request/response pattern.** The bus is fire-and-forget. But several current operations need synchronous responses:
   - `status` command → needs list of active sessions
   - `cancel` command → needs confirmation it worked
   - `run` command → needs the sessionId back
   
   The design has `CommandResult` equivalent in the current system but doesn't show how the new bus handles this. A pure pub/sub bus can't do request/response without adding correlation IDs and response events.

2. **Error propagation.** The bus `emit` catches errors and continues. This is correct for UI subscribers but wrong for critical operations. If the DB writer fails to persist a session_end event, nobody knows. Today, DB writes are synchronous and failures propagate. The design needs a distinction between "nice-to-have" subscribers (UI, context learner) and "must-succeed" subscribers (DB writer).

3. **Ordering guarantees.** Multiple subscribers receive events in registration order. But what if DB writer needs to persist session_start *before* Cron checks for overlap? The bus doesn't guarantee this. Today, the direct call chain ensures ordering.

4. **Backpressure.** If a subscriber is slow (context learning with LLM calls), does it block the bus? The current `emit` iterates subscribers synchronously. With the redesign putting more through the bus, a slow subscriber could delay event delivery to fast subscribers. Need async emit or subscriber queues.

5. **Graceful shutdown sequencing.** Today, may.ts carefully orchestrates: cancel sessions → stop cron → close socket → exit. With components only connected through the bus, how does shutdown sequence? A `shutdown` event goes to everyone simultaneously. Cron might fire a new heartbeat while Core is draining sessions.

6. **Hot reload.** The design has `reload` as a bus command. Today, `reload_agents` in may.ts calls `reloadAgents()` which reads config files and hot-swaps agent definitions in the manager. This needs to be synchronous — the manager must finish reloading before accepting new sessions. A bus command doesn't enforce this.

### Missing but less critical

7. **Metrics/observability.** No mention of metrics emission (session counts, queue depths, error rates). The current system has system-status handler that reads DB. That still works, but bus events could enable real-time dashboards.

8. **Health checks.** No liveness/readiness pattern. Today, the socket's existence serves as a liveness signal. Worth formalizing.

9. **Event versioning.** The `AgentEvent` union type will evolve. No migration story for when event shapes change.

---

## 4. Does It Align with How I Work?

### What works well for my role

- **Delegation via fork/message** — I use `agents.call` (sync) and `agents.send` (async) extensively. The 3-mode model in the redesign matches exactly how I work. `call` for workflow steps, `fork` for parallel work, `message` for fire-and-forget to tech-lead/coder.

- **DB reads for monitoring** — I query may.db constantly (quality metrics, session counts, cost analysis, waste %). The design says "anyone reads DB directly" which is exactly what I need. Good.

- **Session events for observation** — The tool_call/tool_result/session_end events would let me build better monitoring. Today I query DB after the fact. With bus events I could react in real-time (though I don't need this today).

### What doesn't work / concerns

- **Workflow execution.** I run `workflow.run("skill-lifecycle", ...)` which chains multiple call-mode sub-agents. The design says this is internal to Core and doesn't change. Fine — but I want to confirm: workflow execution stays synchronous from the calling agent's perspective? If not, my skill-lifecycle workflow (which needs phase 1 → 2 → 3 → 4 ordering) breaks.

- **maxTurns enforcement.** I literally just found (Mar 31) that maxTurns was a dead variable in cron.ts — the config was set but never passed to the actual session. In the redesign, Cron emits `{ type: "fork", agent: "bob", task: "..." }` but where does `maxTurns` go? The fork event type doesn't include `handlerConfig`. This is exactly the kind of config that gets lost in a loosely coupled system. The `fork` event type needs a `config` or `options` field.

- **Request tracking for my send() calls.** When I `agents.send()` to tech-lead with a P0 bug report, that creates a tracked request in the DB. In the redesign, `message` goes through the bus → Core → "writes to request DB." But if DB is optional, my P0 requests could vanish. This must not be optional for message commands.

---

## 5. Concrete Recommendations

### Do first (high-value, low-risk)
1. **Formalize the current EventBus** — it's already 147 lines. Clean up the deprecated `info`/`prompt` types, add the missing event types from the design (`cron_fired`, `message_created`). This is backward-compatible.
2. **Move Cron from direct manager.run() to bus.emit({ type: "fork" })** — but keep the manager as the fork handler. This decouples Cron without breaking anything. Wire: bus handler in may.ts calls manager.run() when it sees a fork event.
3. **Extract the bus event → DB persistence wiring** into a named DbWriter class. It already exists inline in may.ts (~20 lines). Making it a class with explicit subscribe is clean and testable.

### Do carefully (high-value, needs design)
4. **Add request/response to the bus** — correlation IDs + response events. Without this, the `status` and `cancel` commands can't work through the bus alone. Alternatively, accept that some commands stay as direct method calls.
5. **Distinguish critical vs optional subscribers** — DB writer failures must propagate. Add a `{ critical: true }` flag or a separate `emitOrThrow()` path.
6. **Add config passthrough to fork events** — `{ type: "fork", agent, task, config?: { maxTurns, kind, requestId, ... } }`. Without this, config gets lost.

### Don't do (or defer)
7. **Don't make DB truly optional** — the system can't function without session persistence. "Optional" in the startup code is fine (for testing), but in production it's required. The design should acknowledge this.
8. **Don't try to eliminate all direct calls in Phase 2.** Some things (request tracking, session meta writes) are transactional and belong as direct calls. The bus is for events and commands, not for database transactions.

---

## 6. Summary Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Conceptual clarity | ⭐⭐⭐⭐⭐ | Excellent. The diagram, event types, and mode table are clear. |
| Simplification | ⭐⭐⭐⭐ | Kills glue code in may.ts. Doesn't touch the real complexity (manager). |
| Migration feasibility | ⭐⭐⭐ | Phase 1 is clean. Phase 2 (DB subscriber) needs more design. Phase 3 depends on solving request/response. |
| Completeness | ⭐⭐⭐ | Missing: request/response, error propagation, shutdown sequencing, config passthrough in fork events. |
| Impact on my work | ⭐⭐⭐⭐ | Mostly transparent. Workflow execution and request tracking need explicit guarantees. |

**Bottom line:** Ship Phase 1 as described. Design request/response before Phase 2. Don't make DB optional in production. Add `config` field to `fork` events before migrating Cron.
