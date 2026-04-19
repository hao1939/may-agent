# Architecture Redesign Review — May's Feedback

**Date**: 2026-04-01  
**Reviewer**: May (Operations/Management Agent)  
**Document**: `agents/shared/may-agent-docs/design/architecture-redesign.md`

---

## Executive Summary

**Overall: Strong simplification. I support this direction.** The EventBus-centric design correctly identifies the core problem — `may.ts` is a 1089-line god-file that wires everything together with procedural glue, and `manager.ts` is a 2424-line monolith with 44 imports. The redesign replaces this with composable subscribers around a single bus. That's the right move.

But there are real migration risks and a few design gaps I want to flag.

---

## 1. Does this simplify the current system?

**Yes, significantly.** Here's what I see today vs. the proposal:

| Current | Proposed |
|---------|----------|
| `may.ts` (1089 lines): CLI parsing, model config, session recovery, evaluation, context learning, command handling, cron setup, shutdown — all in one file | Each concern is an independent subscriber. `may.ts` becomes ~100 lines of startup |
| `manager.ts` (2424 lines): agent lifecycle, tool injection, retry logic, persistence, health checks — tightly coupled | Core handles agent lifecycle. DB Writer handles persistence. Health/eval are subscribers |
| EventBus exists but is one-directional (events out) with a single `onCommand` callback for the reverse direction | Unified: both commands and events flow through the bus. Any subscriber can emit or listen |
| `bus.onCommand()` is a single handler in `may.ts` that switches on command type | Commands are events like everything else — Core subscribes to what it handles |

The current `bus.onCommand()` pattern (line 647 of may.ts) is already half the design — it just hasn't been generalized. The redesign completes the thought.

**Specific simplification wins:**
- Evaluation, context learning, escalation logic can be extracted from the `onSessionComplete` callback (which is already ~100 lines of nested callbacks in may.ts) into independent subscribers
- The `attachAgentEvents` function (which manually bridges pi-agent-core events to the bus) becomes cleaner when Core owns this internally
- Model configuration and agent loading can stay in startup without being tangled with session lifecycle

## 2. What breaks? What's hard to migrate?

### 2a. `call` as "not a bus command" is the right call, but needs careful handling

The doc correctly notes that `call` is synchronous and internal to Core. This is critical for my workflow — when I do `agents.call("tech-lead", ...)`, I need to block and get the result back. This can't go through fire-and-forget bus events.

**Risk**: During migration, make sure `call` still works for nested chains (A calls B calls C). The current `manager.ts` has explicit call-depth tracking (`callDepthMap`, `MAX_CALL_DEPTH = 5`). The redesign doc doesn't mention this. **Don't lose the infinite-loop guard.**

### 2b. The `onSessionComplete` callback is the hardest migration target

Currently, `may.ts` lines ~250-330 contain a dense `onSessionComplete` callback that:
1. Emits session_end event
2. Runs evaluation (async, with error handling)
3. Emits eval event
4. Triggers context learning
5. Handles escalation for blocked/failed sessions
6. Tracks recovery attempts (Ambulance Protocol P62)
7. Writes session metadata

In the redesign, this gets split across multiple subscribers (DB Writer persists, Context Learner learns, an Evaluator evaluates). **The ordering matters** — evaluation needs session data that DB Writer persists. If subscribers fire in parallel with no ordering guarantees, you get race conditions.

**Recommendation**: Either (a) document subscriber ordering guarantees, or (b) make the DB Writer synchronous (write completes before other subscribers see the event), or (c) have downstream subscribers read from DB (which naturally serializes through SQLite).

Option (c) is what the doc implies ("Anyone reads DB directly") — but it needs to be explicit that the DB write from `session_end` must complete before Context Learner processes the same `session_end`.

### 2c. The `handleInput` function is surprisingly complex

`may.ts` has a `handleInput()` that does different things depending on state:
- If there's a `chatSession`: routes to chat
- If text starts with special commands (`cancel`, `status`): handles inline
- If `--oneshot` mode: different behavior
- If no chat session but socket command: direct agent invocation with request tracking

This isn't just "Socket bridges to bus." The command routing logic has accumulated real business rules. **Migration needs to preserve these, not assume they're just boilerplate.**

### 2d. DB writes are already mostly indirect

I checked — `may.ts` has zero direct `db.` calls. All persistence goes through `manager.ts` (SubagentManager) which calls `persistence.ts`. The "DB Writer subscriber" pattern is achievable, but `manager.ts` itself has 1 direct `getDb()` call (line 646) and delegates heavily to `persistence.ts`. The real challenge is extracting persistence from `manager.ts`, not from `may.ts`.

## 3. What's missing from the design?

### 3a. No mention of Workflows

The current system has a workflow engine (`src/lib/workflow.ts`, `src/lib/workflow-tool.ts`) that tech-lead and other agents use for multi-step execution (implement-and-review, two-phase, verified-coder). Workflows are orchestrated inside `manager.ts` — they're essentially structured sequences of `call` operations.

The redesign doesn't mention workflows at all. They'd live inside Core, but this should be explicit since they're a key part of how delegation works.

### 3b. No mention of Tool Injection / Guards

`manager.ts` has an extensive tool injection system — tools are composed with guards (finish-guard, read-dedup-guard, session-read-guard, empty-args-guard, scrape-dedup-guard). These guards are what prevent many failure modes I see in agent sessions.

This all stays internal to Core, but it's worth noting because it's a significant chunk of the 2424 lines that won't actually shrink — it'll just move from `manager.ts` to `Core`.

### 3c. Error classification and retry logic

`manager.ts` has `classifyError`, `runAgentWithRetry`, and the overflow detection system (`isOverflowError`, `extractProgress`, `writeProgressFile`). These are critical for reliability. The redesign should acknowledge they live in Core, not in subscribers.

### 3d. Session recovery / Ambulance Protocol

The recovery tracking (`recoveryAttempts` map, `MAX_RECOVERY_ATTEMPTS = 2`) is currently in `may.ts`. In the redesign, who owns this? It's not Core (Core runs sessions), it's not DB Writer (it just persists), it's not Cron (it just schedules). It's a **policy** component that decides whether to retry a failed session. This needs a home.

### 3e. Web UI reads DB — but also needs live events

The doc says "HTTP reads DB for queries" and "WebSocket → socket for live events." This is correct but the current Web UI implementation (`src/app/ui/`) uses WebSocket for both queries and live streaming. The redesign implies a split (HTTP for historical, WS for live). That's architecturally cleaner but is a Web UI migration in itself.

### 3f. No mention of `detached.ts` / multi-process agents

Currently, some agents can run in detached processes (`src/lib/detached.ts`, `spawnDetachedAgent`). The redesign says "One process" — is this intentional? Are we removing multi-process support? If so, fine — but state it explicitly. If not, how do detached processes connect to the EventBus?

## 4. Does it align with how I work?

### What works well:
- **`call` stays sync** — essential for my delegation pattern (call tech-lead, get result, act on it)
- **`fork` goes through bus** — good for fire-and-forget background work
- **`message` for async requests** — this is how I use `agents.send()` today
- **DB as read-anywhere** — I query the DB constantly (requests, evaluations, session history). Having writes go through a subscriber but reads remain direct is the right tradeoff
- **`reload` as a bus command** — hot-reloading agent configs without restart is critical for operations

### What needs attention:
- **Request tracking** (`src/lib/requests.ts`): I dispatch work via `trackRequest()`, and the request DB is how I know what's pending. The redesign's `message_created` event type covers this, but make sure the full request lifecycle (CREATED → IN_PROGRESS → COMPLETED/FAILED) is preserved. Currently `trackRequest`, `ackRequest`, `completeRequest` are in `requests.ts` and called from multiple places.
- **`agents.requests()` queries**: These read the DB directly. In the redesign, this should still work since "Anyone reads DB directly."
- **My `finish()` tool**: When I call `finish({ completed_items })`, it currently marks requests as completed via the manager. This needs to keep working through whatever path.

## 5. Migration Strategy Feedback

The three-phase approach is reasonable:

1. **Phase 1 (Unified EventBus)**: Low risk. The bus already exists, commands already exist. Unify them. This can be done incrementally.
2. **Phase 2 (DB writes through subscriber)**: Medium risk. Need to handle ordering (see 2b above). Consider making this phase granular — move evaluation writes first, then session writes, then everything else.
3. **Phase 3 (Thin startup)**: Low risk if Phase 1 and 2 are solid. This is mostly moving code around.

**Suggestion**: Add a Phase 0: Extract the `onSessionComplete` callback into its own module *without* changing the architecture. This reduces `may.ts` size and makes Phase 2 much easier.

## 6. Bottom Line

| Aspect | Verdict |
|--------|---------|
| Simplification | ✅ Clear win — 1089-line god-file becomes 100-line startup |
| Risk | ⚠️ Medium — `onSessionComplete` ordering, request lifecycle, recovery policy need homes |
| Missing pieces | Workflows, tool guards, error retry, detached processes, session recovery |
| Alignment with operations | ✅ Core patterns (call/fork/message, DB reads, request tracking) all preserved |
| Migration path | ✅ Incremental and reversible |

**Recommendation: Proceed.** The missing pieces are addressable — they're things to add to the doc, not reasons to change direction. The biggest risk is Phase 2 (DB subscriber ordering), and I'd mitigate that by extracting the `onSessionComplete` monster first.
