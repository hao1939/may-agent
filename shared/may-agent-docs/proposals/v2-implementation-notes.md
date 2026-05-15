# v2 Implementation Notes (Historical — as of v0.2)

**Status**: Historical — written during v0.2 migration. For current direction, see
[infra-surface.md](../design/infra-surface.md).

> **⚠️ Historical document.** Written during v0.2 migration. The system has since evolved:
> - `SubagentManager` was rewritten (not just wrapped)
> - `notify` and `agents.fork` were removed (not just deprecated)
> - 13 agents are active (not 5)
> - We're past v0.7, not at the v0.2 tag
>
> This doc preserves what Phase 1-5 actually shipped. For current architecture, see `architecture.md`.

**Status**: Historical. Phases 1–5 implemented on branch `v2`, tagged `v0.2-pre-v2-migration` (rollback point).

This doc describes what actually shipped against the current `../architecture.md`
and the original v2 proposal history.

## What landed

### Phase 1 — Event persistence as invariant

`EventBus.subscribe(fn, { priority: "first" | "normal" })` added.

Persistence (`DbWriter`) is registered with `priority: "first"`. Every emitted event becomes durable in `events` BEFORE any side-effect handler runs. If a handler triggers work, the originating event is already on disk (audit/replay safety).

Files:
- `src/app/event-bus.ts` — split firstSubscribers / normalSubscribers
- `src/app/may.ts` — DbWriter subscribed first
- `test/event-bus-priority.test.ts` — 5 tests (ordering, throw safety, unsub, count)

### Phase 2 — `message` tool

Single async inter-agent communication primitive. Async, persisted, receiver-owned, never blocking. Default queues for receiver's next heartbeat. Priority `P0` triggers immediate heartbeat.

The tool emits **both** `message.created` (v2 canonical) and `agent.notification` (legacy). Existing inbox query, prompt assembly, and DbWriter consume `agent.notification` so back-compat is preserved.

`notify` and `agents.fork` remain as deprecated aliases (still wired in agent-loader, no behavior change).

Files:
- `src/lib/tools/message-tool.ts` — new tool (200 LOC)
- `src/app/event-bus.ts` — `message.created` SystemEvent variant
- `src/lib/db-writer.ts` — explicit case for `message.created`
- `src/app/agent-loader.ts` — `message` preset added
- `test/message-tool.test.ts` — 6 tests (validation, priority, allowlist, intent, artifact)

### Phase 3 — `session.start` / `session.end` event mirrors

The manager emits both legacy (`session_start`, `session_end`) and v2 dot-form (`session.start`, `session.end`) events. v2 consumers can listen on the canonical names without breaking existing subscribers.

Metric breach dedup was already implemented in `metrics-snapshot.ts` via the `metric_alerts` open-row gate — it emits `metric.breach` only on transition into breach, not while the metric stays in breach.

Files:
- `src/app/event-bus.ts` — `session.start`, `session.end` variants
- `src/lib/manager.ts` — emit dot-form alongside legacy at session start (run + resume) and session end (handleCompletion + close)
- `test/v2-events.test.ts` — pin variants in the type union

### Phase 4 — Typed metrics

The `metrics` table already had a `type` column, but every built-in metric was being stored as `'health'` regardless of semantics. Now each metric declares its v2 type:

| metric | type |
|---|---|
| handler.success-rate, .heartbeat-coverage, .p95-duration, .fires-per-hour | gauge |
| handler.completed-count, .failed-count | counter |
| session.error-rate-6h | gauge |
| system.real-output-24h | counter |
| project.active-count, .blocked-count, .stale-active-count, .blocked-rate-7d, .blocked-over-6h | gauge |
| project.iterations-24h | counter |

The prompt formatter (`formatMetricsSection` in `system-status.ts`) now shows the type tag (`[gauge]`, `[counter]`) and uses `alert_op`-aware breach detection instead of a legacy health-only ratio check.

Files:
- `agents/may/handlers/metrics-snapshot.ts` — per-metric `type` field, upsert SQL writes it
- `src/lib/tools/system-status.ts` — type tag display, op-aware breach
- `MetricRow` interface gains `alert_op`; SELECTs include `alert_op`

### Phase 5 — Function workflow steps

Already implemented in `workflow-tool.ts` (`runFunction` at line ~695):

- 30s timeout
- 50KB output truncation
- error-as-result (no workflow crash)
- `source: "function"` on step events for guards
- documented in `workflow-defs.d.ts`

The v2 doc proposed a richer `WorkflowStepContext` (exec/readFile/queryDb/emit/runWorkflow). That's deferred — function steps in this codebase are TS modules that `import` what they need, which is simpler and equally safe (same workspace scoping as agent tools).

Files:
- `test/workflow-function-step.test.ts` — pin the contract

## What we explicitly did NOT do

- **Did not replace `SubagentManager`.** It remains the runtime backend. `AgentSDK.runAgent()` is the v2 façade and already wraps it via `sdk-impl.ts`.
- **Did not remove `notify` or `agents` tools.** Backward compatibility — 5 active agents use them.
- **Did not change DB schema.** Existing `metrics.type` column was already there; we just store correct values.
- **Did not add a richer function-step context.** Existing closures + workspace import boundary suffice.
- **Did not migrate evaluator or May to a new runtime.** They keep using the SDK-backed-by-manager stack.

## Acceptance criteria status

From the v2 architecture target:

- [x] `message.created` events persist and display in receiver context — emits both events; receiver inbox query (`getInbox`) reads from `events` WHERE `owner = ?`
- [x] guards still block unsafe finish/edit behavior — guards untouched, all 14 still wired through `compose-guards.ts`
- [x] DB backup/restore cycle verified — hourly VACUUM INTO unchanged, integrity check unchanged
- [ ] dev/arc/scout complete 20 consecutive heartbeats without error — observation phase, requires runtime
- [ ] session.error-rate-6h does not increase — observation phase
- [ ] handler.success-rate stays >0.95 — observation phase
- [ ] Telegram replies remain context-enriched — observation phase

## Migration tag points

| Tag | Description |
|---|---|
| `v0.1-pre-refactor` | before agent freeze + dev/arc/scout creation |
| `v0.2-pre-v2-migration` | before phase 1; safe full rollback target |

## Rollback procedure

```bash
# Main code
cd /app
git checkout v0.2-pre-v2-migration
bun run build
bun run down && bun run up

# Agents repo
cd /app
git checkout v0.2-pre-v2-migration
```

## Next steps (post-deploy observation)

1. Deploy v2 branch (`docker compose down && up` after build).
2. Watch `handler.success-rate` and `session.error-rate-6h` for 24h.
3. Verify `message.created` events appear in `events` table.
4. Verify metric type tags appear in agent prompts (check `last-session.md` after next heartbeat).
5. If clean: tag `v0.3-v2-migration-stable` and merge `v2` → `main` in main repo.
6. If broken: rollback to `v0.2-pre-v2-migration`, file a finding, retry on a fix branch.
