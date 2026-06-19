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

Core primitives:

- Event: durable signal that something can consume.
- Owner: accountability backstop, not necessarily first responder.
- Project app: control plane that drives a portable domain project.
- Task tree: project owner's durable thinking map, not a scheduler.
- Metric: signal for investigation, not a target.
- Escalation: structured handoff across an ownership boundary.

## Source Of Truth

Read the relevant design doc before changing behavior:

- Core principles: `/app/projects/may-agent.app/docs/1-principles/core-principles.md`
- Work model: `/app/projects/may-agent.app/docs/1-principles/work-model.md`
- Events: `/app/projects/may-agent.app/docs/2a-design/events.md`
- Metrics: `/app/projects/may-agent.app/docs/2a-design/metrics.md`
- Escalation: `/app/projects/may-agent.app/docs/2a-design/escalation.md`
- Project apps: `/app/projects/may-agent.app/docs/2a-design/project-app-v3.md`
- Task trees: `/app/projects/may-agent.app/docs/2a-design/task-tree-engine.md`
- Agent directories: `/app/projects/may-agent.app/docs/2b-manual/agent-convention.md`
- Metric alert triage: `/app/projects/may-agent.app/docs/2b-manual/metric-alerts.md`
- Chat/job separation: `/app/projects/may-agent.app/docs/3-proposals/chat-agent-separation.md`

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
5. Verify with the app/runtime command surface. Use app-local `bun run check`
   or narrower scripts when available; otherwise run targeted tests, typecheck,
   or read-only integrity commands and report what was not verified.

## Events

Use events only for durable signals that can be consumed. Facts that nobody
reacts to belong in state, logs, traces, metrics, or knowledge.

- Emit canonical event envelopes: `type`, `source`, `owner`, optional
  `urgency`/`ttl_ms`/`timestamp`, and `data`.
- Put domain fields in `data`, not on the envelope. Do not duplicate `owner`
  as `data.owner`.
- Route by target first, then owner fallback. `owner` is the accountability
  backstop, not necessarily the first handler.
- Ensure each emitted event has a consumer: direct handler, app adapter,
  owner inbox/default owner route, or explicit external platform path.
- For handlers, read `event.data.*`; do not add shortcut field promotion.
- Prefer canonical project events:
  `project.owner.requested`, `project.task.assigned`,
  `project.task.completed`, `project.problem.requested`,
  `project.problem.resolved`, and `project.problem.escalated`.
- Treat `project.planning.requested`, `project.task.dispatched`, and
  `project.task.finished` as legacy compatibility names, not examples for new
  code.
- Remember retention: `events` are currently short-window operational evidence,
  not permanent history.

## Project Apps And Task Trees

Keep domain projects portable and May-agent control planes separate.

- Put May-agent app logic in `projects/<id>.app/`; domain tools and artifacts
  stay in the domain workspace.
- Keep `app.ts` readable as an event graph: schedules/actions/events route to
  handlers, adapters, or explicit external events.
- Use app-local workflows for project-specific policy. Global handlers should
  deliver, discover, route, and surface missing closure, not encode domain
  strategy.
- Use `ctx.appPath(...)` for app/control-plane files and
  `ctx.workspacePath(...)` or `ctx.workspaceCwd()` for domain files.
- Treat the project owner as the brain. Workflow code wakes sessions, passes
  compact context, and emits events; it should not own task decomposition,
  acceptance, retry policy, or project strategy.
- Use the Project App V3 shape:
  `app.ts` defines the event graph, `project.json` stores structured state and
  workspace binding, `tasks/tree.json` stores decomposition, `workflows/`
  stores app policy, and `agents/` stores app-local identities.
- In `app.ts`, keep `workflowHandlers` as static event-to-handler routes,
  `onEvent` as adapter behavior, and `eventGraph` as audit metadata.
- Follow the owner workflow pattern: `project.owner.requested` reviews the
  trigger, updates/reviews the task tree, assigns capacity, and checkpoints
  done slices; `project.task.assigned` runs one task-owned worker session and
  returns `project.task.completed` to wake the owner.
- Mutate task trees through task-tree tools when available. Direct JSON edits
  are for migration or repair only.
- Persist only these task states: `backlog`, `active`, `review`, `done`,
  `blocked`. Readiness, decomposition, acceptance, cancellation, and
  supersession are projections or metadata, not states.
- Workers handle exactly one owner-assigned leaf and submit evidence to
  `review`. They do not reshape siblings, roll up parents, mark done, or create
  planning/control branches.
- Record useful done summaries and evidence links. Keep runtime attempts in
  infra traces, not as noisy live tree branches.

## Metrics And Runtime Health

Treat metrics as signals, not decisions.

- Inspect the metric row, recent snapshots, related events/sessions, project
  context, and current value before acting.
- Resolve ownership by runtime convention: `metrics.owner`,
  project owner from `metrics.project`, metric id prefix, then May.
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
- Emit `escalation.created` only when another owner must answer or act. Include
  `escalationId`, source agent/session, project context, reason,
  requested action, severity, blocker, evidence, resume context, and a stable
  `dedupKey` when possible.
- Route `owner: "human:<role>"` through May as deputy while preserving the
  human owner on the event.
- On resolution, use `escalation.resolved` or `escalation.dismissed` with
  correlation by `escalationId`. A resolution disposition is not proof the
  source project is fixed; the source owner still judges unblock.
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

## Runtime Restart

- Do not run inline `supervisorctl restart may-agent ...` from an agent shell.
  The shell is a child of the runtime being stopped and can die before the
  restart finishes.
- Prefer the event path: emit `runtime.restart.requested` and let the runtime
  ask supervisor to start `may-agent-restarter`.
- If a shell command is explicitly needed, use
  `supervisorctl start may-agent-restarter`. That one-shot program is owned by
  supervisord and performs the actual `may-agent` / `may-agent-web` restart.
- Once supervisor accepts the start request, the restarter survives
  `may-agent` stopping or crashing. If `may-agent` crashes before sending the
  request, normal supervisor `autorestart` owns recovery.

## Build And Deploy Runtime Binary

When a runtime code change needs to become live inside the container, build the
binary in the workspace and hand the install/restart to supervisor:

```bash
cd /app/projects/may-agent
bun run check
bun test <targeted tests>
bun run deploy
supervisorctl status may-agent may-agent-web may-agent-restarter
tail -80 /tmp/may-agent-supervisor-restart.log
```

`bun run deploy` runs `bun run bundle`, writes the staged deploy marker, then
starts the supervisor-owned one-shot `may-agent-restarter`. The restarter
copies `/app/projects/may-agent/bundle/may-agent` to
`/usr/local/bin/may-agent` while the runtime is stopped, then starts
`may-agent` / `may-agent-web`. Do not inline
`cp ... /usr/local/bin/may-agent && supervisorctl restart ...` from an agent
shell.

If the live restarter does not support staged deploy, the command fails with a
recreate message. Recreate the container from the updated image; do not
silently fall back to an inline stop/copy/start sequence from May.

Treat deploy as accepted-then-async: after `bun run deploy` returns, verify the
restarter log, confirm `may-agent` and `may-agent-web` are `RUNNING`, and make
sure the deploy marker is gone.

## Key Principles

- Reactive work is event-driven and must close the loop.
- Everything has an owner; owner boundaries define accountability.
- Context is discovered as needed, not dumped into prompts.
- Evidence comes before state changes, escalation, or completion claims.
- Prefer structure and convention over prose-only instructions.
- Debug the message, route, state, or evidence before blaming the model.

## Change Checklist

Before finishing:

- Confirm the relevant design doc still supports the behavior.
- Confirm every new event has a responsible consumer or explicit owner path.
- Confirm project-app changes preserve app/domain boundaries.
- Confirm task-tree changes use valid states and owner/worker roles.
- Confirm metrics and alerts remain signals requiring owner judgment.
- Confirm blockers either return to the owner loop or become structured
  escalations with resume evidence.
- Run the narrowest meaningful checks and report any verification gap.
