# v2 Migration — Detailed Plan

**Status**: Historical. The implemented state is captured in
`v2-implementation-notes.md`; the active architecture reference is
`../architecture.md`. Current infra-surface work supersedes this plan's older
direct-session and persistence wording; use `../2a-design/infra-surface.md` for
new implementation decisions.

## Reality check: what already exists

Surprisingly, the bones of v2 are largely in place. We don't need to rewrite — we need to converge.

| v2 Component | Current implementation | Gap |
|---|---|---|
| EventBus | `src/app/event-bus.ts` (153 LOC) | **Persistence is a subscriber, not part of `emit()`**. No priority. |
| `runAgent()` façade | `AgentSDK.runAgent()` in `src/lib/sdk.ts` + `sdk-impl.ts` | Wraps `manager.callAgent()` — already works. |
| `SubagentManager` | `src/lib/manager.ts` (2349 LOC) | Will remain as backend; SDK is the public face. |
| `message` primitive | `notify` tool in `src/lib/tools/send-tool.ts` + `agents.fork` | Two tools today; spec says one. Notify ≈ message default; agents.fork ≈ message+immediate trigger. |
| Tool guards | `src/lib/tools/*-guard.ts` (14 files, ~2k LOC) | Already runtime middleware via `compose-guards.ts`. ✅ |
| Workflows | `src/lib/workflow-tool.ts` (1143 LOC) | Has agent steps. **No function steps.** |
| Typed metrics | `metrics-snapshot` handler measures 6 metrics | **No type system** (gauge/counter/health/derived). All gauge-ish today. |
| Project format | `projects/<id>/project.md` | ✅ matches v2 doc |
| DB safety | hourly backup, integrity check, single connection | ✅ already done |

**Conclusion**: v2 is mostly a rename + tightening exercise. The hard work (guards, DB safety, persistence, agent runtime) is already done.

## What truly needs to change

1. **Make event persistence part of `emit()`**, not a subscriber. (Small, mechanical.)
2. **Add `message` event type + tool** that unifies notify/fork semantics. Keep `notify` and `agents.fork` as deprecated aliases for one release cycle.
3. **Add metric type system** to the metrics table. Migrate the 6 system metrics to typed.
4. **Add function workflow steps** (no LLM, mechanical work).
5. **Add metric breach dedup** (don't re-fire while a metric stays in breach).
6. **Add `session.start` event type** for symmetry with `session.end`.
7. **Mark `AgentSDK.runAgent()` as the canonical entry point** for new code; keep `manager.callAgent` as the implementation.

That's the whole migration. No big rewrite.

## What we are NOT doing

- ❌ Replacing `SubagentManager` with raw `pi-coding-agent` calls. The manager already provides what we need (registry, retry, depth tracking, persistence). The "no custom runtime loop" target stays aspirational — we keep the manager as the implementation behind the SDK.
- ❌ Big-bang rewrite of cron / handlers / workflows.
- ❌ Removing `notify` or `agents` tool. Backward compatibility matters; system has 5 active agents using them right now.

## Phases

### Phase 1: Event persistence as invariant (small, isolated)

**Files**: `src/app/event-bus.ts`, `src/lib/db.ts` (or a new `src/app/event-persistence.ts`)

**What**: Move event persistence from a subscriber to inside `bus.emit()`, before subscribers fire.

**Acceptance**:
- All emitted events are durable in `events` table before any handler runs.
- If a handler crashes, the event is still recorded.

### Phase 2: Add `message` event + tool

**Files**: `src/app/event-bus.ts`, new `src/lib/tools/message.ts`, update `agent-loader.ts` toolset

**What**:
- Add `message.created` to `SystemEvent` type with `priority?: "P0"|"P1"|"P2"|"P3"`.
- Add `message` tool that emits `message.created` and persists to `messages` table.
- Historical default: queue for next heartbeat. The current convention is
  event -> handler/workflow -> session/function; direct `manager.runAgent`
  wording here is not current guidance.
- `notify` and `agents.fork` keep working but log a deprecation notice when used.

**Acceptance**:
- Agent calls `message({to, content, priority})` → row in `messages` table → event on bus → next receiver heartbeat sees it in prompt.
- P0 message triggers immediate run for receivers in opt-in list.
- `notify` and `agents.fork` still work.

### Phase 3: Add `session.start` + metric breach dedup

**Files**: `src/app/event-bus.ts`, `src/lib/manager.ts` (emit on session start), agents/may/handlers/metrics-snapshot.ts

**What**:
- Add `session.start` event emitted from manager.run().
- Track open metric breaches in DB; don't re-emit `metric.breach` while same metric is already in breach.

**Acceptance**:
- UI/Telegram see session.start events.
- A metric stuck in breach for 6 hours emits `metric.breach` only once, not every snapshot tick.

### Phase 4: Typed metrics

**Files**: DB migration to add `type` column, `agents/may/handlers/metrics-snapshot.ts`, prompt assembly in `src/app/agent-loader.ts` (where context is built).

**What**:
- Add `type` column to `metrics` table: `gauge | counter | health | derived`.
- Update `metrics-snapshot` handler to evaluate alerts per-type:
  - gauge: threshold (instant or sustained)
  - counter: rate or stalled
  - health: consecutive failures
  - derived: same as gauge applied to formula
- Update prompt formatting to show `[type]` and target/threshold.

**Acceptance**:
- Existing 6 metrics migrated to typed equivalents.
- Agent prompts show type tag.

### Phase 5: Function workflow steps

**Files**: `src/lib/workflow.ts`, `src/lib/workflow-tool.ts`, workflow def types in `src/lib/workflow-defs.d.ts`

**What**:
- Add `fn` step type alongside `agent` step type in workflow schema.
- Function steps receive `WorkflowStepContext` with scoped exec/readFile/writeFile/queryDb/emit/runWorkflow.
- No raw DB access; queryDb is read-only via SDK.

**Acceptance**:
- A workflow can run `bun test` as a function step.
- Function steps cannot write outside agent workspace.
- Function steps cannot open the DB file directly.

### Phase 6: Documentation + acceptance run

**Files**: `shared/may-agent-docs/sdk.md`, runtime docs

**What**:
- Update SDK docs to call `runAgent()` the canonical entry.
- Mark `notify` / `agents.fork` as legacy aliases (still supported).
- Run for 24h with all 5 active agents and check acceptance criteria from v2 doc.

**Acceptance** (from the v2 architecture target):
- dev/arc/scout complete 20 consecutive heartbeats without error
- session.error-rate-6h does not increase
- handler.success-rate stays >0.95
- message.created events persist and display in receiver context
- guards still block unsafe finish/edit behavior
- Telegram replies remain context-enriched
- DB backup/restore cycle verified

## Order of execution

Phases 1, 2, 3 are independent and small — do them sequentially without much risk.
Phase 4 (typed metrics) touches DB schema; do after 1-3 are stable.
Phase 5 (function steps) is purely additive; do last.
Phase 6 is observation, not code.

## Rollback

Tag `v0.2-pre-v2-migration` exists. Each phase is its own commit; `git revert` or branch back if anything breaks.
