---
name: may-agent-system
description: Guide for the agent investigating or changing May Host or Apps. Read the owning design, diagnose the affected boundary, and verify the smallest justified change.
---

# May Host System

Use this skill when maintaining May Host behavior, Apps, executor definitions,
task views, event flows, metrics, alerts, or escalation loops. `may-agent` is a
retained repository, package, and App identifier; it is not an architectural
component or a second name for May.

## Architecture Overview

The May Host runs Apps. Preserve this mental model:

`event or addressed request -> App Task -> bounded attempt -> accepted result`

For human interaction, preserve the more specific shape:

`human -> stable Conversation Task -> bounded turn -> response or delegated Task`

Conversation holds discussion and Task references; its stable Task owns execution.
May can act directly in an authorized bounded turn or assign independent work
to another ordinary Task. Delegate for existing ownership,
required authority, or useful expertise, not merely a matching App name.
Linked outcomes return as input to the assigning Task. There is no separate
follow-up supervision Task or second executing inbox handler in the Host.

For project-directed interaction, preserve:

`project.comment.created event -> declared App route -> App Task -> accepted result`

An addressed request only remembers which caller is owed a result. The Task is
the App's sole work authority. An executor performs one bounded attempt and
owns no Task. Events are durable new information; traces are causal evidence.

Core primitives:

- Event: persisted new information and wake for declared consumers.
- Request: caller correlation for one eventual result, not a work loop.
- App: accountable owner that resolves input and reconciles Tasks.
- Task: durable desired and observed App work, not a scheduler queue.
- Executor: one replaceable agent, workflow, CLI, or adapter attempt.
- Metric: signal for investigation, not a target.
- Escalation: structured handoff across an ownership boundary.

Keep the agent core portable:

`model + prompt + context + supplied tools -> agent run -> result + neutral notifications`

The agent core does not import EventBus, SQLite, metrics, tasks, scheduling, or
recovery. Autonomous infrastructure may wrap the same run, and explicitly
supplied tools may access databases or remote services behind their capability
interfaces.

## Using this guidance

This canonical guide is in May's local catalog. Apply it to your current
investigation or change. When a teammate's expertise or independent judgment
is useful, give them the outcome, constraints, and relevant source references;
the teammate chooses their method.

If the teammate needs this guide, pass its full readable `SKILL.md` path through
`context_files`. Ordinary file reading works without catalog registration.
For skill installation and external CLI discovery, consult the
[skill contract](/app/projects/may-agent.app/docs/2a-design/skills.md#codex-interoperability).

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
- Apps: `/app/projects/may-agent.app/docs/2a-design/agent-app.md`
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

1. Locate the responsibility boundary: Host mechanics or App meaning. The App
   owns the Task; an agent, workflow, or CLI is only its bounded executor.
2. Read the active project/app files that own the work: `app.ts`,
   `project.json`, bounded canonical task views, agent `AGENTS.md`, workflows,
   metrics, and recent traces as needed. Do not make raw task persistence an
   App or agent contract.
3. Preserve the loops:
   `human event -> May turn -> direct result or exact Task admission`, and
   `event -> Task -> bounded attempt -> accepted result or exact wait`.
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

- Treat a human `conversation.message.created` on `Conversation may:primary` as
  shared durable context and input for its existing Conversation Task, not a new Task.
  Do not add `human.input.received`, a second `app.input.requested`, or a mutable
  current-session lifecycle for the same turn.
- Understand human intention inside that May request. A question, request for
  explanation or advice, correction, or uncertain response is not an approval
  decision. Answer what accepted context supports. Before asking, use the
  Conversation, focused resources, durable preferences, and safe reversible
  defaults. When the intended next action remains materially uncertain, state
  the likely interpretation and recommendation and ask for the smallest
  remaining human decision. Keep consequential state pending until the
  intention is clear.
- A narrow explicit control reply such as `approve`, `reject`, or `hold` may use
  a deterministic direct path with exact current identity. Route longer,
  mixed, questioning, or uncertain replies to May for meaning-based judgment;
  never default unmatched text to a decision.
- Agent, tool, and command-authored Conversation messages may add meaningful
  shared context but create no work. `transient: true` adds neither durable
  context nor work.
- Treat every human message as its own request. Reply anchors and channel IDs
  add context; they never reopen an older request or select a session.
- A session is one replaceable attempt. Carry the exact May request, Topic, and
  destination Task identities through bounded calls and outbound presentation.
  Closure belongs to the accepted response and App results, not
  `session.idle`, `session.end`, or adapter delivery state.

### Project-intent traces

- Explicit project HTTP/UI intent may persist `project.comment.created`
  directly as its receipt and trace root. Conversational intent remains one May
  request; May returns a typed `followUp` when durable work or exact Task
  feedback is needed. It may target May's own goal input. The bounded turn can
  finish while independent work continues; accepted Requests remain tracked.
- External actors state intent; they do not choose task IDs, owners, workflows,
  or sessions. The app owner reads current project and task context and decides
  answer, reject, no-op, task change, exact wait, or workflow reuse.
- A declared App subscription translates project intent into typed Task input.
  App policy resolves the stable Task identity; it does not edit Host storage
  or create another request lifecycle.
- Runtime validates and applies Task changes. Typed child App dependencies
  return exact outcomes through saved input links (`app.dependency.updated`),
  so the assigning Task can judge the evidence and return its own result.
- Compatible addressed work may batch and task wakes may coalesce, but every
  addressed request keeps its own identity and result. A shared task does not
  absorb the request lifecycle.
- Work or waiting that must survive an attempt belongs in the same durable
  Task. Express exact waits as Conditions, not ephemeral response state.

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

## Apps And Tasks

Keep domain projects portable and App policy separate from Host mechanics.
For authorized Task cleanup, read
[`references/task-controls.md`](references/task-controls.md) for exact reads,
the installed CLI, and closure verification; do not rediscover runtime internals.

- Put App policy in `projects/<id>.app/`; domain tools and artifacts
  stay in the domain workspace.
- Keep `app.ts` small: one default agent, one `task(input)` resolver,
  fact-publishing schedules, optional schema-backed actions, and explicit
  subscriptions that translate events into typed App inputs.
- A targeted event, resolved app event, Condition change, and periodic resync
  all enqueue the same per-app controller. Do not recreate task Cron handlers.
- Resolve a declared task workflow from the selected agent's local
  `agents/<agent>/workflows/` directory. With no workflow or named executor,
  invoke that agent once. Do not add workflow maps or agent-entry wrappers.
- Treat the App as the semantic owner. Executors apply a bounded attempt;
  Runtime owns claims, retries, validation, and atomic Task mutation.
- Keep one executor call active while it can still make progress. Internal
  model turns are not Task attempts. Return only an accepted result or an exact
  external wait; a crash or restart retries the same Task automatically.
- Give each independent standing responsibility one stable task identity.
  Timers, semantic events, explicit returned inputs, and external observations wake
  that resource; they do not create timestamped work records or scan the task
  tree for something to schedule.
- Keep responsibilities explicit: the App declares the goal boundary,
  topology, and domain policy; the selected executor judges one bounded
  attempt; workflows preserve learned ordered experience; the Host owns queues,
  claims, concurrency, retries, recovery, and Condition correlation.
- Task persistence is host-private and reconciler-owned. `tasks/seed.json` is
  bootstrap intent; Apps and agents consume only bounded task views.
- Workflows use their reconciliation context and exact `ctx.read.task` views;
  agents use bounded task readouts. They return `converged`, `waiting` with
  exact Conditions or typed App dependencies, `incomplete` for failure, or `needs-agent` before an
  executor is selected, plus typed actions for Runtime to validate and apply.
- When an App looks stuck, inspect the App and canonical Task state first.
  Reuse its existing Task and Condition, wake it through a declared App
  action, and follow the same trace through a typed response to a terminal
  domain result. Treat the generated tree as read-only. Reject duplicate tasks
  and direct state/tree edits; merely waking work is not terminal success. A
  complete plan must explicitly name both the typed App response and terminal
  domain result; do not infer or compress either step.
- Project comments enter through a declared App subscription. Several requests
  may attach one stable task, but each keeps its own request identity and response
  correlation.
- Resource `spec` is desired state and resource `status.phase` is observed
  reconciliation state. The old task-state vocabulary may appear only in a
  derived human projection, never as a second execution authority.
- Use Conditions only for observable external facts. Use direct children for
  decomposition and `dependsOn` for internal ordering; never model task phase,
  child completion, retry, or refill as a Condition.
- A parent link describes organization, not a wake or return route. Use typed
  dependencies when the assigning Task needs an answer; their saved input links
  return the exact result. Use Conditions for external facts with a known producer.
- Tasks accept outcomes and rest between inputs. Only
  the assigning owner closes a Task. `done` alone does not mean closed; inspect
  `closed`. Historical completion receipts remain evidence, not runtime authority.
- `incomplete` reports an unsuccessful attempt with evidence and needed help;
  it does not abandon work. Runtime retries with backoff until progress or
  owner closure. A worker cannot change its own assignment.
- Assign new work through typed App dependencies, never `create-task` or
  `close-task` actions. Update existing child assignments using exact fences.
- Bound passive review of an unchanged external Condition. If repeated reviews
  produce no new evidence, change the execution approach or settle into the
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
- An unresolved executor selection may return `needs-agent`; an App Task waiting
  on an external fact returns `waiting` with an exact observable Condition.
  Runtime records the attempt and owns retry and recovery—do not emit a
  parallel task-completion event.
- Durable work without task context enters through a typed App input/action or a
  declared event subscription that creates one correlated App request. Do not
  address an owner string or workflow event as an alternate inbox.
- When a Task needs another App's result, return a typed Task dependency with the
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
- May Console and Telegram turns use `finish()` and shared execution tools
  inside one stable Conversation Task. Independent work uses another Task.
  The separate direct-agent chat interface is a persistent observed REPL
  without `finish()`; do not confuse its session lifecycle with Conversation.
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
- Explicit direct invocation may activate one primary skill. Delegation shares
  guide references for the receiver to read. Preserve the enclosing event/session
  trace; named activation records `skill.loaded`, while ordinary reads retain
  their tool evidence. Neither is proof of task completion.
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
- Confirm App changes preserve App/domain boundaries.
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
