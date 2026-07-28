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

`conversation input -> human.input.received -> semantic intent -> bounded work -> terminal evidence -> channel delivery`

For project-directed interaction, preserve:

`project.comment.created receipt -> app owner judgment -> project.owner.reviewed -> optional durable task`

The root event and trace represent the commitment. Do not add a parallel
request lifecycle object.

Core primitives:

- Event: durable signal that something can consume.
- Owner: accountability backstop, not necessarily first responder.
- Project app: control plane that drives a portable domain project.
- Task resources: desired and observed project work, not a scheduler queue.
- Metric: signal for investigation, not a target.
- Escalation: structured handoff across an ownership boundary.

Keep the agent core portable:

`model + prompt + context + supplied tools -> agent run -> result + neutral notifications`

The agent core does not import EventBus, SQLite, metrics, tasks, scheduling, or
recovery. Autonomous infrastructure may wrap the same run, and explicitly
supplied tools may access databases or remote services behind their capability
interfaces.

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
- Agent Apps: `/app/projects/may-agent.app/docs/2a-design/agent-app.md`
- Project posture: `/app/projects/may-agent.app/docs/2a-design/projects.md`
- Task resources: `/app/projects/may-agent.app/docs/2a-design/task-resource-engine.md`
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
   `project.json`, canonical `.state/tasks/state.json`, the generated task-tree
   projection when useful, agent `AGENTS.md`, workflows, metrics, and recent
   traces as needed.
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

Before creating a reusable mechanism, classify the need:

- For one situational judgment already covered by a skill and accepted source,
  use that guidance and make the bounded decision. Reject a new workflow,
  preference, checklist, context note, knowledge entry, or skill edit.
- Add a workflow only after evidence shows a repeated ordered process that
  needs orchestration state.
- Propose a source or skill repair only when evidence shows the current
  guidance is wrong or incomplete. State that evidence; reject speculative
  persistent follow-up offered merely because the agent felt unsure.
- Report the bounded choice to Hao in plain language: decision first, source
  used, mechanism boundary, and next action. Use at most three short sentences
  and remove repeated rationale.
- When a task asks for a decision only or forbids changes or contact, return the
  investigation, change, proof, and approval plan without executing or
  delegating it.

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
- Prefer semantic project events such as `project.owner.requested`,
  `project.problem.investigation.requested`, `project.problem.resolved`, and
  `project.problem.escalated`. Task claim/result mechanics belong to the
  reconciler and do not require assignment or completion event adapters.
- Treat `project.planning.requested`, `project.execution.requested`,
  `project.task.dispatched`, and `project.task.finished` as retired historical
  names, not accepted ingress aliases or examples for new code.
- Remember retention: `events` are currently short-window operational evidence,
  not permanent history.
- Treat a declared typed app action as a discoverable schema-backed constructor
  for one semantic event. Validate before emission and return that semantic
  event ID directly; do not add `project.action.invoked`, accepted/completed
  wrappers, or an action-status record.

### Human-rooted traces

- Treat `human.input.received` as the transport-neutral boundary/root event for
  free-form conversational input, not as a request entity.
- Understand human intention before emitting the semantic child. A question,
  request for explanation or advice, correction, or uncertain response is not
  an approval decision. Answer what accepted context supports; when the
  intended next action remains uncertain, state the likely interpretation and
  ask one focused question. Keep consequential state pending until the
  intention is clear.
- A narrow explicit control reply such as `approve`, `reject`, or `hold` may use
  a deterministic direct path with exact current identity. Route longer,
  mixed, questioning, or uncertain replies to May for meaning-based judgment;
  never default unmatched text to a decision.
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

### Project-intent traces

- Explicit project HTTP/UI intent may persist `project.comment.created`
  directly as its receipt and trace root. A conversational adapter may emit the
  same event as the semantic child of `human.input.received`.
- External actors state intent; they do not choose task IDs, owners, workflows,
  or sessions. The app owner reads current project and task context and decides
  answer, reject, no-op, task change, exact wait, or workflow reuse.
- The owner or workflow returns a structured decision and typed task actions.
  It does not edit task storage or emit `project.owner.reviewed`.
- The generic reconciler validates and applies task actions, then infrastructure
  emits exactly one correlated `project.owner.reviewed` per persisted comment,
  with a bounded summary, task references, and closure link.
- Level-based coalescing may combine several wakes on one stable task, but the
  pending trigger must retain every unresolved input event reference until each
  has its owner result.
- Work or waiting that must survive the turn belongs in a durable task. Express
  exact waits as task Conditions, not ephemeral response state.

### Delivery and closure integrity

- Delivery acceptance must mean a domain consumer acted/queued work or a
  queryable owner inbox received it. A default-owner label without a readable
  owner route is not delivery.
- When an accepted request has no terminal result, classify it as a missing
  consumer until proven otherwise; delivery acceptance is not completion.
  Before answering, verify that the plan explicitly includes every step:
  1. replay both the emitted and subscribed event names;
  2. repair the responsible handler or manifest;
  3. add a persisted regression or golden-trace test;
  4. follow the handler through the terminal domain artifact;
  5. present the exact change and all proof; and
  6. wait for approval before any production reload or rollout.
  Revise an answer that omits any step. Do not infer or compress a step.
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
- Keep `app.ts` small: one owner, `tasks.accepts`, one `tasks.resolve`, event-only
  schedules, optional schema-backed actions, and optional deterministic
  `onEvent` projection.
- A targeted event, resolved app event, Condition change, and periodic resync
  all enqueue the same per-app controller. Do not recreate task Cron handlers.
- Resolve a declared task workflow from the accountable agent's local
  `agents/<owner>/workflows/` directory. With no workflow, invoke the resolved
  owner. Do not add workflow maps or owner-entry wrappers.
- Treat the project owner as the semantic backstop. Workflows preserve a proven
  process; the app runtime owns claims, retries, validation, and atomic task
  mutation.
- `.state/tasks/state.json` is the sole mutable task-resource store.
  `tasks/seed.json` is bootstrap intent; `.state/tasks/tree.json` is a generated
  read projection.
- Workflows and agents read task state but never edit the store directly. They
  return `converged`, `waiting` with exact Conditions, or `needs-owner`, plus
  typed actions for the app to validate and apply.
- When an app looks stuck, inspect the app and canonical task state first.
  Reuse its existing task and Condition, wake the owner through a declared app
  action, and follow the same trace through a typed response to a terminal
  domain result. Treat the generated tree as read-only. Reject duplicate tasks
  and direct state/tree edits; merely waking work is not terminal success. A
  complete plan must explicitly name both the typed owner response and terminal
  domain result; do not infer or compress either step.
- Project comments normally resolve to one stable owner-review task. Preserve
  unresolved comment event references when repeated wakes coalesce so response
  correlation is not lost.
- Resource `spec` is desired state and resource `status.phase` is observed
  reconciliation state. The old task-state vocabulary may appear only in a
  derived human projection, never as a second execution authority.
- An `achieve` task is absorbed into a completion receipt and removed from the
  live graph. A `maintain` task stays live for later wake events. Parent/child
  structure is decomposition, not scheduling.

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
- A task workflow that cannot decide returns `needs-owner`; an owner waiting on
  an external fact returns `waiting` with an exact Condition. The reconciler
  records the attempt and performs the single owner fallback—do not emit a
  parallel task-completion event.
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
- Confirm task-resource changes preserve `spec`/`status`, valid phases,
  resolved ownership, and reconciler-only mutation.
- Confirm `.state/tasks/state.json` remains the sole mutable task authority and
  the tree remains a generated projection.
- Confirm metrics and alerts remain signals requiring owner judgment.
- Confirm blockers either return to the owner loop or become structured
  escalations with resume evidence.
- Confirm every human-rooted turn has one semantic intent, explicit per-turn
  trace propagation, terminal evidence, and channel-delivery evidence when a
  response is claimed.
- Confirm every persisted project comment has exactly one correlated
  infrastructure-emitted owner result with a summary, task references, and
  closure link; durable waits use task Conditions.
- Confirm typed actions expose descriptions and input schemas, reject invalid
  input before emission, and return one semantic event receipt without wrapper
  lifecycle events.
- Confirm every newly closed lifecycle pair writes a persisted closure link in
  the normal path rather than depending on backfill.
- Confirm unclaimed owned events create queryable owner-inbox work and do not
  hide a missing domain consumer behind bookkeeping acceptance.
- Confirm retention cannot delete an opener or closure still referenced by
  active/retained work.
- For event/trace changes, add or update golden-trace tests and run semantic
  integrity checks in addition to schema/dangling-reference checks.
- Run the narrowest meaningful checks and report any verification gap.
