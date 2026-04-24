# Architecture Redesign Review

**Reviewer:** Bob (Architect)
**Date:** 2026-04-01
**Document:** `agents/shared/may-agent-docs/design/architecture-redesign.md`
**Request:** Hao asked for review on 2026-04-01 ~07:39

---

## Executive Summary

The architecture redesign is **sound and already substantially implemented**. Phases 1 and 2 are deployed and working in production. The remaining work is Phase 3 (thin startup) and the research system integration. The design doc accurately reflects both the vision and the implemented reality, with a few gaps worth noting.

**Verdict: APPROVE — ship remaining Phase 3 work. No design changes needed.**

---

## What's Already Built (confirmed via codebase)

| Component | Design Target | Actual State | Gap |
|-----------|--------------|-------------|-----|
| EventBus | 15-line class | 184 lines (`src/app/event-bus.ts`) — includes types, helpers, backward compat | Types add justified weight. Core class is ~20 lines. ✅ |
| Event Types | Typed union | Fully typed: `AgentCommand`, `SessionEvent`, `SystemEvent`, `ManagementCommand` | ✅ Complete |
| DbWriter | Subscriber, only DB writer | 75 lines (`src/lib/db-writer.ts`), subscribed via `bus.subscribe(dbWriter.handler)` | ✅ Clean |
| Core command subscriber | Bus → core | Lines 671-728 of `may.ts`: handles fork, input, steer, cancel, reload, restart, shutdown | ✅ Working |
| Console/Socket/Telegram | Bridge to bus | All three attach to bus via `attach*UI(bus, ...)` | ✅ Working |
| Context Learner | Optional subscriber | Lines 445-510 of `may.ts`: inline subscriber, not yet extracted to own class | ⚠️ Inline |
| Startup | "Under 100 lines" | 1190 lines in `may.ts` | ❌ Not done |
| Cron | Decoupled subscriber | Cron loads via `agent-loader.ts`, fires through bus | Partially — still coupled to manager |

## What Needs Building

### Phase 3: Thin Startup (the remaining gap)

`may.ts` at 1190 lines is the main debt. It still contains:

1. **Session lifecycle management** (~lines 230-350): `onSessionComplete` callback with evaluation, error classification, escalation, recovery logic — ~120 lines that belong in a `SessionLifecycle` component
2. **Context learner** (~lines 445-510): Inline subscriber that should be extracted to `src/lib/context-learner.ts` (like DbWriter)
3. **Backward compat command handler** (~lines 730-875): Duplicate of the bus subscriber, using old `bus.onCommand()` API for socket.ts migration
4. **CLI argument parsing + mode switching** (~lines 880-1100): Chat mode, task mode, cron mode, oneshot mode — could be a separate `src/app/startup.ts`

**Recommended decomposition:**
```
may.ts (startup, <100 lines)
  → creates bus
  → attaches: Core, DbWriter, ContextLearner, Cron, UIs
  → mode-specific entry (chat/task/cron/oneshot)

src/app/core.ts (new, ~200 lines)
  → SessionLifecycle (evaluation, recovery, escalation)
  → Core command subscriber (fork, input, steer, cancel)
  → Agent event bridge (manager.subscribe → bus.emit)

src/lib/context-learner.ts (extract, ~70 lines)
  → Already subscriber-shaped, just needs class wrapper
```

This gets may.ts under 100 lines and makes each component independently testable.

### Research System

Design is clean. Knowledge base structure (entries/hypotheses/experiments) is seeded on disk. Missing:
- Research events on the bus (hypothesis_created, experiment_started, etc.)
- Research DB tables (hypotheses, experiments, knowledge_entries)
- Advocate + Skeptic agents

**Recommendation:** Low urgency. The research system is a new capability, not a reliability improvement. Defer until Phase 3 is complete and the core architecture is fully clean.

---

## Design Strengths

1. **"No request/response on the bus"** — This is the right call. Keeping the bus fire-and-forget prevents correlation ID complexity and callback hell. `call` for sync, bus for async, DB for queries — clear separation.

2. **"Infra errors don't reach agents"** — The `try/catch` subscriber isolation is simple and correct. DB failures are operational concerns, not agent concerns. This matches how the system actually behaves today.

3. **"Shutdown is not a bus problem"** — Correct. Process owner handles ordering. The bus `shutdown` event is notification only. No distributed coordination needed for a single-process system.

4. **fork carries session options** — The `opts` field on fork events is well-designed. Covers kind, requestId, source. Extensible without breaking existing subscribers.

5. **DB is optional in code, required in production** — Good for gym/test flexibility. Already implemented correctly (DbWriter is a subscriber, not required).

6. **Three cooperation modes** — call/fork/message mapping is clean and matches agent mental models. `call` being internal (not a bus event) is the right design — it's synchronous by nature.

---

## Design Concerns (minor)

### 1. Backward Compat Weight

The EventBus has ~50 lines of deprecated types and methods (`RunnerEvent`, `RunnerCommand`, `CommandResult`, `on()`, `onCommand()`, `command()`). `may.ts` has a duplicate backward-compat command handler (~lines 730-875) that mirrors the bus subscriber.

**Impact:** Not a correctness issue, but adds cognitive overhead. Every new developer sees two paths for the same command.

**Recommendation:** Set a migration deadline. Once socket.ts is migrated to use `bus.subscribe()` instead of `bus.command()`, delete all deprecated code. This is a single-PR cleanup.

### 2. Context Learner Coupling

The context learner in `may.ts` (lines 445-510) imports evaluation functions, reads session messages from disk, and decides between heuristic vs LLM-based learning. It's the most complex inline subscriber.

**Impact:** Makes may.ts harder to test and reason about. Violates the "each component is a subscriber" principle.

**Recommendation:** Extract to `src/lib/context-learner.ts` as a class with a `handler` method (same pattern as DbWriter). Constructor takes persistDir + config options (LLM vs heuristic).

### 3. Missing `eval` Event in DbWriter

The design doc lists `eval` as a system event type, and the EventBus type includes it, but DbWriter doesn't handle `eval` events. Evaluation results are written to DB by the inline `onSessionComplete` callback in may.ts, not through the bus.

**Impact:** Violates "DbWriter is the ONLY component that writes to DB." Evaluation writes still go through the old path.

**Recommendation:** Add `eval` handling to DbWriter. Have the session lifecycle component emit `eval` events to the bus, and DbWriter persists them. This completes the "all DB writes through DbWriter" principle.

### 4. Cron is Partially Decoupled

Cron fires through the bus and agent-loader manages cron entries, but the actual session launching still goes through the bus subscriber's `manager.run()` call (line 710). This is architecturally correct (cron emits `fork` → core subscriber handles it), but the JS handler execution path still has direct manager dependency.

**Impact:** Minor. JS handlers run in-process and need manager access for evaluations, which is fine for a single-process architecture.

**Recommendation:** No change needed. The current coupling is justified — JS handlers ARE part of core, not separate subscribers.

---

## Alignment with Production Reality

The system has been running this architecture in production since the migration began. Key metrics that validate the design:

- **0 persistence failures** in the last 7 days (DbWriter subscriber works)
- **88.5% good evaluation rate** (best day ever, as of 2026-04-01)
- **Hot-reload works** via `reload` bus event
- **Multi-agent concurrency** works (45 sessions/6h, no deadlocks)
- **Subscriber isolation** works (DB errors don't break agents)

The architecture is not theoretical — it's proven in production.

---

## Recommended Next Steps (Priority Order)

1. **Extract Context Learner** to `src/lib/context-learner.ts` (~2 hours)
2. **Migrate socket.ts** to use `bus.subscribe()`, delete backward compat code (~3 hours)
3. **Extract SessionLifecycle** to `src/app/core.ts` (~4 hours)
4. **Thin may.ts** to startup-only (<100 lines) (~2 hours, after steps 1-3)
5. **Add eval events** to DbWriter to complete "single DB writer" principle (~1 hour)
6. **Research system** — add events + tables when ready to build Advocate/Skeptic (~later)

Total Phase 3 estimate: ~12 hours of focused implementation work.

---

## Summary

The architecture is clean, the EventBus design is correct, and the implementation is 70% complete. The remaining 30% is decomposition work (extracting inline code into proper components) and backward compat cleanup. No design changes needed — just finish the migration.
