---
name: may-agent-system
description: Maintain and evolve the May-agent system and project apps. Use when May works on May-agent projects, project apps, task trees, event handlers, metrics, runtime health, blocker handling, escalation flows, agent conventions, or design-doc-aligned changes under /app/projects/may-agent.app, /app/projects/*.app, agents/, shared/, or May-agent runtime code.
---

# May-Agent System

Use this skill when maintaining May-agent runtime behavior, project apps, agent
directories, task trees, event flows, metrics, alerts, or escalation loops.

## Architecture Overview

May-agent is an event-driven autonomous agent system. Preserve this mental
model:

`event -> owner routing -> agent judgment -> evidence -> state update -> follow-up event`

For human interaction, preserve the more specific shape:

`human.input.received -> semantic intent -> bounded work -> terminal evidence -> channel delivery`

The root event and trace represent the commitment. Do not add a parallel
request lifecycle object.

Core primitives:

- Event: durable signal that something can consume.
- Owner: accountability backstop, not necessarily first responder.
- Project app: control plane that drives a portable domain project.
- Task tree: project owner's durable thinking map, not a scheduler.
- Metric: signal for investigation, not a target.
- Escalation: structured handoff across an ownership boundary.

## Discovery Boundary

This file is the canonical May-local copy and is routed from `agents/may/AGENTS.md`.
May-native discovery loads canonical immediate `<name>/SKILL.md` packages from
app-local agent, global agent, and shared roots; closer scope wins. Invalid,
ambiguous, archived, oversized, or trust-escaping packages are omitted with
loader diagnostics. New turns receive a bounded metadata catalog, while the
full body enters context only after a successful model read or explicit
activation such as `$may-agent-system ...` or a typed `skill` option.

Expose this canonical directory to external Codex workers through a supported
skill location, preferably by symlink, and verify actual discovery; do not
maintain an unsynchronized copy.

## Source Of Truth

Start with the compact system model, then read only the subsystem contract
relevant to the change:

- Governing model: `/app/projects/may-agent.app/docs/2a-design/system-model.md`
- Architecture: `/app/projects/may-agent.app/docs/2a-design/architecture.md`
- Core principles: `/app/projects/may-agent.app/docs/1-principles/core-principles.md`
- Work model: `/app/projects/may-agent.app/docs/1-principles/work-model.md`
- Events: `/app/projects/may-agent.app/docs/2a-design/events.md`
- Event graph and trace: `/app/projects/may-agent.app/docs/2a-design/event-graph.md`
- Human control surfaces: `/app/projects/may-agent.app/docs/2a-design/human-control-surfaces.md`
- Sessions and chat-turn lifecycle: `/app/projects/may-agent.app/docs/2a-design/sessions.md`
- Skills and progressive disclosure: `/app/projects/may-agent.app/docs/2a-design/skills.md`
- Workflow discovery and execution: `/app/projects/may-agent.app/docs/2a-design/workflows.md`
- Metrics: `/app/projects/may-agent.app/docs/2a-design/metrics.md`
- Escalation: `/app/projects/may-agent.app/docs/2a-design/escalation.md`
- Project apps: `/app/projects/may-agent.app/docs/2a-design/project-app-v3.md`
- Project posture: `/app/projects/may-agent.app/docs/2a-design/projects.md`
- App/project integrity: `/app/projects/may-agent.app/docs/2a-design/app-project-integrity.md`
- Task trees: `/app/projects/may-agent.app/docs/2a-design/task-tree-engine.md`
- Agent directories: `/app/projects/may-agent.app/docs/2b-manual/agent-convention.md`
- Metric alert triage: `/app/projects/may-agent.app/docs/2b-manual/metric-alerts.md`

Tier 3 proposals are background, not source of truth. Use them only when an
accepted design doc explicitly points to unresolved proposal context.

If implementation and docs disagree, treat it as a design or implementation
gap. Do not invent a third convention. Either align code to the doc, update the
doc with evidence, or call out the mismatch.

## Operating Loop

1. Locate the owner boundary: runtime, app, project owner, worker, problem
   solver, May, or human.
2. Read the active project/app files that own the work: `app.ts`,
   `project.json`, `tasks/tree.json`, agent `AGENTS.md`, workflows, handlers,
   metrics, and recent traces as needed.
3. Preserve the loop:
   `project + metrics + trigger -> bounded work -> agent judgment -> evidence -> project update`.
4. Make the smallest change that keeps the loop closed. Prefer existing
   conventions, app-local workflows, SDK helpers, and task-tree tools over new
   configuration or broad framework code.
   Prefer JavaScript/TypeScript and Bun for new May-agent scripts and runtime
   tooling; use another language only when an existing required tool has no
   maintained JavaScript/TypeScript equivalent.
5. Verify with the app/runtime command surface. Use app-local `bun run check`
   or narrower scripts when available; otherwise run targeted tests, typecheck,
   or read-only integrity commands and report what was not verified.

## Events

Use events only for durable signals that can be consumed. Facts that nobody
reacts to belong in state, logs, traces, metrics, or knowledge.

- Emit canonical event envelopes: `type`, `source`, `owner`, optional
  `target`/`urgency`/`ttl_ms`/`timestamp`/`trace`, and `data`.
- Put domain fields in `data`, not on the envelope. Do not duplicate `owner`
  as `data.owner`.
- Route by target first, then owner fallback. `owner` is the accountability
  backstop, not necessarily the first handler.
- Ensure each emitted event has a consumer: direct handler, app adapter,
  queryable owner inbox, or explicit external platform path. Pair bookkeeping
  alone is not domain delivery.
- For handlers, read `event.data.*`; do not add shortcut field promotion.
- Prefer canonical project events:
  `project.owner.requested`, `project.task.assigned`,
  `project.task.completed`, `project.problem.investigation.requested`,
  `project.problem.resolved`, and `project.problem.escalated`.
- Treat `project.planning.requested`, `project.execution.requested`,
  `project.task.dispatched`, and `project.task.finished` as retired historical
  names, not accepted ingress aliases or examples for new code.
- Remember retention: `events` are currently short-window operational evidence,
  not permanent history.

### Human-rooted traces

- Treat `human.input.received` as the transport-neutral boundary/root event for
  free-form human input, not as a request entity.
- Emit exactly one semantic child intent from the input router. Use
  `chat.start.requested` only to create/bind a chat; use
  `session.steer.requested` for an existing target.
- Treat a persistent chat session as a conversation container, not a trace.
  Carry trace context per queued turn through `manager.send()`, cold resume,
  tools, calls/forks, workflows, CLI delegation, and outbound delivery.
- Close the semantic intent with the turn's `session.idle` or `session.end`.
  Do not attach all future turns to the session's original trace.
- Keep replies to notifications/results in the referenced trace. A standalone
  follow-up starts a new trace. Never mutate or reopen an old closure; represent
  rework as a new linked branch.

### Delivery and closure integrity

- Delivery acceptance must mean a domain consumer acted/queued work or a
  queryable owner inbox received it. A default-owner label without a readable
  owner route is not delivery.
- Lifecycle bookkeeping may consume infra-only lifecycle events, but the pair
  tracker must not mask a missing targeted project/session/workflow/owner
  consumer.
- When live pair tracking closes a pair, persist the pair update and trace
  closure link atomically. Backfill is historical repair, not the normal write
  path.
- Distinguish handled, started, completed, delivered, and human-confirmed as
  derived graph questions. Closure does not automatically mean project success
  or human satisfaction.
- Trace verification must be semantic as well as structural: look for closed
  pairs without closure links, opener/closer trace splits, human intents with no
  child work/disposition, generated results without channel delivery, and
  unexpected singleton lifecycle events.
- Preserve events referenced by open work or retained trace links. Apply base
  age retention only after referential protection; prune detail before root,
  delivery, and closure evidence.
- Keep event-graph reads canonical: one `events` collection, one `relations`
  collection, and graph/timeline event-id projections in `scope`. Do not return
  duplicate raw event arrays for each UI view.

## Project Apps And Task Trees

Keep domain projects portable and May-agent control planes separate.

- Put May-agent app logic in `projects/<id>.app/`; domain tools and artifacts
  stay in the domain workspace.
- Keep `app.ts` readable as an event graph: schedules/actions/events route to
  handlers, adapters, or explicit external events.
- Use app-local workflows for project-specific policy. Global handlers should
  deliver, discover, route, and surface missing closure, not encode domain
  strategy.
- Use `ctx.appPath(...)` for app/control-plane files, `ctx.workspacePath(...)`
  for files in the bound domain workspace, and `ctx.workspaceCwd()` when a tool
  needs that workspace as its cwd. Treat `ctx.projectPath(...)` as a deprecated
  compatibility alias.
- Treat the project owner as the brain. Workflow code wakes sessions, passes
  compact context, and emits events; it should not own task decomposition,
  acceptance, retry policy, or project strategy.
- Use the Project App V3 shape:
  `app.ts` defines the event graph, `project.json` stores structured state and
  workspace binding, `tasks/tree.json` stores decomposition, `workflows/`
  stores app policy, and `agents/` stores app-local identities.
- In `app.ts`, use `schedules[].emits[]` and
  `workflowHandlers[].accepts[]`. Keep `workflowHandlers` as static
  event-to-workflow routes, optional imperative `onEvent` as bounded adapter
  behavior, and `eventGraph` as audit metadata. Do not add singular schedule
  `event`, handler `on`, or workflow-handler sugar under `onEvent`.
- Follow the owner workflow pattern: `project.owner.requested` reviews the
  trigger, updates/reviews the task tree, assigns capacity, and checkpoints
  done slices; `project.task.assigned` runs one task-owned worker session and
  returns `project.task.completed` to wake the owner.
- Mutate task trees through task-tree tools when available. Direct JSON edits
  are for migration or repair only.
- Persist only these task states: `backlog`, `active`, `review`, `done`,
  `blocked`. Readiness, decomposition, acceptance, cancellation, and
  supersession are projections or metadata, not states.
- Treat `state` as the only persisted task lifecycle field. Legacy `status`
  access may map to `state` at runtime, but must not become a second serialized
  value or appear in new event snapshots.
- Workers handle exactly one owner-assigned leaf and submit evidence to
  `review`. They do not reshape siblings, roll up parents, mark done, or create
  planning/control branches.
- Record useful done summaries and evidence links. Keep runtime attempts in
  infra traces, not as noisy live tree branches.

## Metrics And Runtime Health

Treat metrics as signals, not decisions.

- Inspect the metric row, recent snapshots, related events/sessions, project
  context, and current value before acting.
- Resolve ownership by runtime convention: explicit `metrics.owner` first;
  project-scoped metrics enter the `project:<id>` / project-app owner path;
  unscoped metrics fall back through a valid agent-like metric-id prefix, then
  May. The project owner remains the accountability backstop for project
  judgment.
- Do not manually reroute alerts by editing `metrics.owner`; fix
  `metrics.project`, project owner metadata, metric definitions, or resolver
  code.
- For project-scoped breaches, wake or support the project owner with compact
  metric context. Do not create one alert task per breach by default.
- Use balanced project metrics where possible: activity plus impact, with
  health metrics for stuck loops.
- Watch runtime health through event delivery, orphan lifecycle pairs, stale
  active tasks, heartbeat darkness, invalid config, pending escalations,
  stale metrics, and session/provider failures.
- When handling metric alerts, choose exactly one operation from the manual:
  investigate then final operation, fix root cause, calibrate, downgrade,
  upgrade/escalate, resolve stale/transient, or document exception.
- Use safe runtime write paths for metric calibration, priority changes,
  exceptions, and manual alert resolution. Do not edit `.state/*.db` directly
  from shell or ad hoc scripts.
- Keep `sdk.query` read-only. Put state-changing helpers on `sdk.commands`, and
  have those commands emit canonical durable events instead of mutating query
  tables behind a read-shaped API.

## Blockers And Escalations

Distinguish local blockers from ownership-boundary escalations.

- A workflow `ctx.blocked(...)` result is local and synchronous. The caller
  records it, returns it to the task/project owner, or promotes it only when it
  crosses an owner boundary.
- Top-level project task blockers should usually return to the project owner
  as blocked `project.task.completed` with task id, attempt id, workflow run,
  reason, and compact context.
- Use `project.owner.requested` for project workflows without task context and
  `workflow.owner.requested` for non-project workflows.
- Emit `escalation.created` only when another owner must answer or act. Prefer
  `sdk.escalate(reason, opts)` and include source agent/session, project
  context, reason, requested action, severity, blocker evidence, resume
  context, and a stable `dedupKey` when possible. `sdk.escalate(...)` returns
  `{ eventId, compatibilityId }`; persist and use `eventId` as the canonical
  escalation identity. Preserve `data.escalationId` only when touching legacy
  raw event paths.
- Route `owner: "human:<role>"` through May as deputy while preserving the
  human owner on the event.
- On resolution, use `escalation.resolved` or `escalation.dismissed` with a
  closure link to the opening event in the same trace. Accept legacy
  `data.escalationId` correlation only for compatibility. A resolution
  disposition is not proof the source project is fixed; the source owner still
  judges unblock.
- Do not hide human notification, retry loops, or project-specific workarounds
  inside escalation code.

## Agent And Chat Conventions

- Keep normal prompt assembly lean: shared common sense plus the agent
  `AGENTS.md`; put situational or long knowledge in `knowledge/` with an
  index.
- Put app-scoped task agents under `projects/<id>.app/agents/<name>/`.
  Reserve global `agents/` for May and explicitly justified system-level
  agents during migration.
- Put operational settings in `agent.json`, not prose instructions.
- For human interaction, preserve chat/job separation: chat is a persistent
  observed REPL without `finish()`; jobs are bounded task sessions with
  terminal cleanup.
- Human, CLI, Telegram, web, and socket actions should enter through canonical
  intent events rather than untracked side channels.
- Keep per-turn causality explicit across long-lived chat sessions. Ambient
  async trace inheritance is useful inside one handler continuation but is not
  sufficient for queued turns or work that outlives that continuation.
- Bare cancel is session-scoped. Never upgrade it to cancel-all; broad
  cancellation requires the explicit `session.cancel_all.requested` intent.
- Treat skills as per-turn advisory context. Do not use them as task state,
  completion evidence, workflow enforcement, or a parallel request lifecycle.
- Use one explicit primary skill when a human or delegation names it. Preserve
  the enclosing event/session trace and verify `skill.loaded` evidence instead
  of inventing `skill.completed`.
- Treat workflow TypeScript as executable orchestration. Share discovery and
  provenance conventions with skills, but keep workflow run state and terminal
  closure in the existing workflow/event trace.
- System callers use the typed workflow runner directly. Only the model-facing
  tool boundary should construct the schema/JSON adapter.
- Keep each workflow invocation synchronous and ordered. If work must wait for
  a future event or external condition, end with `ctx.blocked(...)` and resume
  through a second event-linked workflow; do not suspend one workflow run.

## Runtime Restart

For restart, deploy, binary activation, or supervisor work, read
[`references/runtime-operations.md`](references/runtime-operations.md) before
acting. Keep that situational procedure out of ordinary project, event, metric,
and task-tree work.

## Change Checklist

Before finishing:

- Confirm the relevant design doc still supports the behavior.
- Confirm every new event has a responsible consumer or explicit owner path.
- Confirm project-app changes preserve app/domain boundaries.
- Confirm task-tree changes use valid states and owner/worker roles.
- Confirm metrics and alerts remain signals requiring owner judgment.
- Confirm blockers either return to the owner loop or become structured
  escalations with resume evidence.
- Confirm every human-rooted turn has one semantic intent, explicit per-turn
  trace propagation, terminal evidence, and channel-delivery evidence when a
  response is claimed.
- Confirm every newly closed lifecycle pair writes a persisted closure link in
  the normal path rather than depending on backfill.
- Confirm unclaimed owned events create queryable owner-inbox work and do not
  hide a missing domain consumer behind bookkeeping acceptance.
- Confirm retention cannot delete an opener or closure still referenced by
  active/retained work.
- For event/trace changes, add or update golden-trace tests and run semantic
  integrity checks in addition to schema/dangling-reference checks.
- Run the narrowest meaningful checks and report any verification gap.
