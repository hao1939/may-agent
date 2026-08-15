---
name: may-agent-system
description: Maintain and evolve the May-agent system and Agent Apps. Use for Kubernetes-style task-resource reconciliation, stable tasks, task trees, Conditions, event/timer wakes, Agent Apps, event handlers, metrics, runtime health, blocker handling, escalation flows, agent conventions, or design-doc-aligned changes under /app/projects/may-agent.app, /app/projects/*.app, agents/, shared/, or May-agent runtime code.
---

# May-Agent System

Use this skill when maintaining May-agent runtime behavior, Agent Apps, agent
directories, task trees, event flows, metrics, alerts, or escalation loops.

## Architecture Overview

May-agent is an Agent App host. Preserve this mental model:

`addressed request -> App inbox -> complete, delegate, or attach task -> result`

For human interaction, preserve the more specific shape:

`conversation input -> May App inbox -> answer or delegation -> channel delivery`

For project-directed interaction, preserve:

`project.comment.created fact -> declared App subscription -> App inbox request -> optional task dependency -> App result`

The App inbox item is the authority for an addressed result. The task is the
authority for a durable desired outcome. Events and traces are facts and causal
evidence, not alternate request lifecycles.

Core primitives:

- Event: persisted fact and wake for declared consumers.
- App inbox item: one addressed request and correlated result.
- Owner: accountability backstop, not necessarily first responder.
- Agent App: control plane that drives a portable domain project.
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
   `project.json`, bounded canonical task views, agent `AGENTS.md`, workflows,
   metrics, and recent traces as needed. Do not make raw task persistence an
   App or agent contract.
3. Preserve the loop:
   `project + metrics + trigger -> bounded work -> agent judgment -> evidence -> project update`.
4. Make the smallest change that keeps the loop closed. Prefer existing
   conventions, app-local workflows, SDK helpers, bounded task projections,
   and canonical App/task actions over new configuration or broad framework
   code.
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
- Route only through an explicit App subscription, task subscription, exact
  task target, or host-internal maintenance consumer. `owner` is diagnostic
  accountability metadata, never a generic routing fallback.
- Ensure each actionable event has a declared consumer and every unaddressed
  fact has an intentional observation/unhandled disposition. Pair bookkeeping
  alone is not domain delivery.
- For handlers, read `event.data.*`; do not add shortcut field promotion.
- Prefer semantic project facts such as `project.problem.resolved` and exact
  task wakes. An addressed event such as `project.owner.requested` is valid
  only when a declared App subscription translates it into one correlated App
  request. Task claim/result mechanics belong to the reconciler and do not
  require assignment or completion event adapters.
- Treat `project.planning.requested`, `project.execution.requested`,
  `project.task.dispatched`, and `project.task.finished` as retired historical
  names, not accepted ingress aliases or examples for new code.
- Remember retention: `events` are currently short-window operational evidence,
  not permanent history.
- Treat a declared typed App action as discoverable schema-backed ingress.
  Validate its parameters, translate them with `toInput`, and admit one
  correlated App request. Do not emit an actionable semantic event as a
  shortcut or add action accepted/completed wrapper lifecycles.

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
- A declared App subscription translates project intent into a correlated App
  inbox request. The owner or pure route returns `complete`, `delegate`, or an
  explicit task attachment; it does not edit task storage or emit an owner
  result event.
- The task reconciler validates and applies task actions. When an attached task
  completes, `app.dependency.completed` wakes the exact inbox request so its
  owner can review the bounded dependency observation and return the App result.
- Compatible inbox work may batch and task wakes may coalesce, but every
  addressed request keeps its own identity and result. A shared task does not
  absorb the request lifecycle.
- Work or waiting that must survive the turn belongs in a durable task. Express
  exact waits as task Conditions, not ephemeral response state.

### Delivery and closure integrity

- Delivery acceptance must mean a domain consumer acted/queued work or a
  durable App inbox received it. A default-owner label without an explicit
  route is not delivery.
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

## Agent Apps And Task Trees

Keep domain projects portable and May-agent control planes separate.

- Put May-agent app logic in `projects/<id>.app/`; domain tools and artifacts
  stay in the domain workspace.
- Keep `app.ts` small: one owner, `tasks.subscriptions`, one `tasks.resolve`,
  fact-publishing schedules, optional schema-backed actions, and explicit inbox
  subscriptions that translate facts into canonical App inputs.
- A targeted event, resolved app event, Condition change, and periodic resync
  all enqueue the same per-app controller. Do not recreate task Cron handlers.
- Resolve a declared task workflow from the accountable agent's local
  `agents/<owner>/workflows/` directory. With no workflow, invoke the resolved
  owner. Do not add workflow maps or owner-entry wrappers.
- Treat the project owner as the semantic backstop. Workflows preserve a proven
  process; the app runtime owns claims, retries, validation, and atomic task
  mutation.
- Give each independent standing responsibility one stable task identity.
  Timers, semantic events, child transitions, and external observations wake
  that resource; they do not create timestamped work records or scan the task
  tree for something to schedule.
- Keep responsibilities explicit: the app declares the goal boundary,
  topology, ownership, and domain policy; the owner prioritizes the highest
  value unresolved frontier and judges progress; workflows preserve learned
  ordered experience; infrastructure owns queues, claims, concurrency,
  retries, recovery, and Condition correlation.
- Task persistence is host-private and reconciler-owned. `tasks/seed.json` is
  bootstrap intent; Apps and agents consume only bounded task views.
- Workflows use their reconciliation context and exact `ctx.read.task` views;
  agents use bounded task readouts. They return `converged`, `waiting` with
  exact Conditions, or `needs-owner`, plus typed actions for the host to
  validate and apply.
- When an app looks stuck, inspect the app and canonical task state first.
  Reuse its existing task and Condition, wake the owner through a declared app
  action, and follow the same trace through a typed response to a terminal
  domain result. Treat the generated tree as read-only. Reject duplicate tasks
  and direct state/tree edits; merely waking work is not terminal success. A
  complete plan must explicitly name both the typed owner response and terminal
  domain result; do not infer or compress either step.
- Project comments enter through a declared App subscription. Several requests
  may attach one stable task, but each keeps its own inbox identity and response
  correlation.
- Resource `spec` is desired state and resource `status.phase` is observed
  reconciliation state. The old task-state vocabulary may appear only in a
  derived human projection, never as a second execution authority.
- Use Conditions only for observable external facts. Use direct children for
  decomposition and `dependsOn` for internal ordering; never model task phase,
  child completion, retry, or refill as a Condition.
- Make a standing parent own its finite leaves directly. Let meaningful child
  convergence or attention wake the parent through the shared controller;
  reject sibling layouts that require an app-local refill or recovery handler.
- An `achieve` task is absorbed into a completion receipt and removed from the
  live graph. A `maintain` task stays live for later wake events. Parent/child
  structure is decomposition, not scheduling.
- Treat completion receipts as immutable. Never recreate a completed task ID;
  create a deterministic successor only when a genuinely new desired outcome
  exists.
- Bound passive review of an unchanged external Condition. If repeated reviews
  produce no new evidence, change the owner approach or settle into the
  event-driven wait; reject endless empty checkpoint loops.
- Derive priority from the unresolved current goal and frontier. Passed,
  superseded, or completed work cannot remain the active priority merely
  because an old list still names it.

## Metrics And Runtime Health

Treat metrics as signals, not decisions.

- Inspect the metric row, recent snapshots, related events/sessions, project
  context, and current value before acting.
- Resolve ownership by runtime convention: explicit `metrics.owner` first;
  project-scoped metrics enter an explicit App/task subscription;
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
- Watch runtime health through event delivery/admission, stale App requests and
  dependencies, stale active tasks, heartbeat darkness, invalid config,
  pending deliveries, stale metrics, and session/provider failures.
- When handling metric alerts, choose exactly one operation from the manual:
  investigate then final operation, fix root cause, calibrate, downgrade,
  upgrade/escalate, resolve stale/transient, or document exception.
- Use safe runtime write paths for metric calibration, priority changes,
  exceptions, and manual alert resolution. Do not edit `.state/*.db` directly
  from shell or ad hoc scripts.
- Use scoped `ctx.read`/`ctx.metrics` capabilities in App workflows and typed
  runtime controls for explicit maintenance. Do not add raw query/command
  escape hatches to the public SDK or mutate projection tables behind a
  read-shaped API.

## Blockers And Escalations

Distinguish local blockers from ownership-boundary escalations.

- A workflow `ctx.blocked(...)` result is local and synchronous. The caller
  records it, returns it to the task/project owner, or promotes it only when it
  crosses an owner boundary.
- A task workflow that cannot decide returns `needs-owner`; an owner waiting on
  an external fact returns `waiting` with an exact Condition. The reconciler
  records the attempt and performs the bounded same-App owner handoff—do not
  emit a parallel task-completion event.
- Work without task context enters through a typed App input/action or a
  declared event subscription that creates one correlated App request. Do not
  address an owner string or workflow event as an alternate inbox.
- When another App must answer or act, return typed App delegation with the
  exact request, evidence, source obligation, severity, and stable semantic
  correlation key. The parent waits on that exact child result.
- Route human attention through a typed child request to the `may` App. May
  owns channel policy and returns one correlated result; a human owner label or
  notification event is not delivery.
- Historical `escalation.*` events remain audit evidence only. New escalation
  ownership is the parent/child App dependency or exact human/task Condition.
  A child disposition is not proof the source project is fixed; the source
  owner still applies it and judges completion.
- Do not hide human notification, retry loops, or project-specific workarounds
  inside escalation code.

## Agent And Chat Conventions

- Keep normal prompt assembly lean: shared common sense plus the agent
  `AGENTS.md`; put situational or long knowledge in `knowledge/` with an
  index.
- Put app-scoped task agents under `projects/<id>.app/agents/<name>/`.
  Reserve global `agents/` for May and explicitly justified standalone
  system-level agents.
- Put operational settings in `agent.json`, not prose instructions.
- For human interaction, preserve chat/job separation: chat is a persistent
  observed REPL without `finish()`; jobs are bounded task sessions with
  terminal cleanup.
- Human, CLI, Telegram, web, and socket actions enter through canonical App
  admission, fact publication, typed App actions, or deterministic runtime
  controls rather than untracked side channels.
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
  a future event or external condition, return control to the enclosing App or
  task so it can persist an exact dependency or Condition and start a new
  bounded attempt after the wake. `ctx.blocked(...)` reports execution failure;
  it does not create a durable wait or resumable workflow stack.

## Runtime Restart

For restart, deploy, binary activation, or supervisor work, read
[`references/runtime-operations.md`](references/runtime-operations.md) before
acting. Keep that situational procedure out of ordinary project, event, metric,
and task-tree work.

## Change Checklist

Before finishing:

- Confirm the relevant design doc still supports the behavior.
- Confirm every new event has a responsible consumer or explicit owner path.
- Confirm Agent App changes preserve App/domain boundaries.
- Confirm task-resource changes preserve `spec`/`status`, valid phases,
  resolved ownership, and reconciler-only mutation.
- Confirm the host reconciler remains the sole mutable task authority and Apps
  consume only bounded task projections.
- Confirm metrics and alerts remain signals requiring owner judgment.
- Confirm blockers either return to the owner loop or become structured
  escalations with resume evidence.
- Confirm every human-rooted turn has one semantic intent, explicit per-turn
  trace propagation, terminal evidence, and channel-delivery evidence when a
  response is claimed.
- Confirm every accepted project comment has one correlated App inbox item and
  App result; task attachment is explicit, dependency completion wakes the
  parent, durable waits use task Conditions, and human delivery is recorded
  separately.
- Confirm typed actions expose descriptions and input schemas, reject invalid
  input before emission, and return one semantic event receipt without wrapper
  lifecycle events.
- Confirm every newly closed lifecycle pair writes a persisted closure link in
  the normal path rather than depending on backfill.
- Confirm unclaimed owned events remain visibly pending and do not hide a
  missing domain consumer behind bookkeeping acceptance.
- Confirm retention cannot delete an opener or closure still referenced by
  active/retained work.
- For event/trace changes, add or update golden-trace tests and run semantic
  integrity checks in addition to schema/dangling-reference checks.
- Run the narrowest meaningful checks and report any verification gap.
