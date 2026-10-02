# Documentation index

**Supports:** [Purpose and value](1-principles/purpose.md). Gives each behavior one discoverable owner so people and agents can understand and change May without reconstructing its history.

Start with [README](README.md) for the reading path. This page indexes current
contracts and guides. [Proposals](proposals/README.md) contain remaining choices;
[the archive](archive/README.md) contains dated decisions and evidence.

## Which document owns the answer?

| Question | Owner |
| --- | --- |
| What is May for? | [Purpose](1-principles/purpose.md) |
| Why choose this design? | [Philosophy](1-principles/design-philosophy.md), [review and conflict rules](1-principles/core-principles.md#review-rule) |
| How does work flow from an ask to an outcome? | [System Model](2a-design/system-model.md) |
| What does the agent decide and infra execute? | [Host/App boundary](2a-design/system-boundary.md) |
| How should an agent work with current capabilities? | [Task execution guide](2b-manual/task-execution-guide.md) |
| How do Task state, Conditions and recovery work? | [Task lifecycle](2a-design/task-resource-engine.md) |
| What does an attempt receive and return? | [Task attempts](2a-design/task-attempts.md) |
| How do agents and workflows call each other? | [Contributions](2a-design/execution-contributions.md) |
| When is a human ask fulfilled? | [Message lifecycle](2a-design/message-lifecycle.md) |
| How is a Conversation turn executed or stopped? | [Conversation execution](2a-design/conversation-execution.md) |
| How do input and changed facts reach their owner? | [Events](2a-design/events.md), [execution feedback](2a-design/execution-feedback.md) |
| Where should a design or implemented proposal go? | [Authoring guide](2b-manual/design-authoring.md) |

## Tier 1 — Principles

| Document                                              | Purpose                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| [purpose.md](1-principles/purpose.md) | Project purpose, value and measures of useful progress. |
| [design-philosophy.md](1-principles/design-philosophy.md) | Value, cost, sufficient outcomes and technical tradeoffs. |
| [core-principles.md](1-principles/core-principles.md) | Technical decision rules: simple first, stable core, events, authority, and conventions. |
| [work-model.md](1-principles/work-model.md)           | Choose the smallest mechanism for the responsibility.     |
| [evidence-first.md](1-principles/evidence-first.md)   | Hypothesis, evidence, and validation discipline.       |
| [code-vs-data.md](1-principles/code-vs-data.md)       | Choose code, instructions, skills, workflows, or data. |
| [evolution.md](1-principles/evolution.md)             | Evidence-backed mechanism and knowledge evolution.     |

## Tier 2a — Current design

### System and storage

| Document                                           | Purpose                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| [system-model.md](2a-design/system-model.md)       | Compact whole-system model; read first.                           |
| [architecture.md](2a-design/architecture.md)       | Current composition, execution boundaries and code map.           |
| [system-boundary.md](2a-design/system-boundary.md) | Infrastructure primitives versus agent/app patterns.              |
| [storage.md](2a-design/storage.md)                 | Authoritative artifacts, projections, migration, and maintenance. |
| [app-root-layout.md](2a-design/app-root-layout.md) | Durable source, runtime state, workspaces, and scratch layout.    |

### Agents and execution

| Document                                                       | Purpose                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [agents.md](2a-design/agents.md)                               | Agent identity, cooperation, and app-local registration.      |
| [runtime.md](2a-design/runtime.md)                             | Host process modes, startup, capacity, reload and recovery.   |
| [sessions.md](2a-design/sessions.md)                           | Bounded execution, continuity and retained evidence.           |
| [execution-contributions.md](2a-design/execution-contributions.md) | Agent/workflow helper scope, results, repair and retained evidence. |
| [workflows.md](2a-design/workflows.md)                         | App-local execution contract, enforcement owners and support limits. |
| [skills.md](2a-design/skills.md)                               | Scoped reusable judgment guidance.                            |
| [sdk.md](2a-design/sdk.md)                                     | Stable agent and workflow capability surface.                 |
| [native-coding-workers.md](2a-design/native-coding-workers.md) | Codex/Claude adapter and continuity model.                    |

### Apps and projects

| Document                                                     | Purpose                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [agent-app.md](2a-design/agent-app.md)                       | App package, ownership, input, and Task policy.                         |
| [projects.md](2a-design/projects.md)                         | Durable goal context, project posture, and workspace layout.           |
| [task-resource-engine.md](2a-design/task-resource-engine.md) | Canonical tasks, key queue, Conditions, claims, results, and recovery. |
| [task-attempts.md](2a-design/task-attempts.md) | Attempt input, execution selection, live/final actions and result admission. |
| [task-resource-read-interface.md](2a-design/task-resource-read-interface.md) | Bounded App, operator, and adapter Task read contracts. |
| [default-project-ui.md](2a-design/default-project-ui.md)     | Shared project readout and steering contract.                          |

### Events, scheduling, and reliability

| Document                                                         | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| [events.md](2a-design/events.md)                                 | Event admission, routing, and acceptance.             |
| [execution-feedback.md](2a-design/execution-feedback.md) | Progress, failure feedback, duplicate observations and agent wakes. |
| [event-graph.md](2a-design/event-graph.md)                       | Causality, closure, and trace read model.            |
| [cron.md](2a-design/cron.md)                                     | Time-based event production.                         |
| [heartbeat.md](2a-design/heartbeat.md)                           | Liveness observations versus ordinary periodic App review. |
| [metrics.md](2a-design/metrics.md)                               | Metrics, alerts, pairs, and blind spots.             |
| [guards.md](2a-design/guards.md)                                 | Detection signals and observability.                 |
| [escalation.md](2a-design/escalation.md)                         | Cross-App and human-boundary requests.               |
| [practice-learning-loop.md](2a-design/practice-learning-loop.md) | Optional Evaluation/Gym integration, not a required learning subsystem. |
| [session-eval-trail.md](2a-design/session-eval-trail.md)         | Session summary and append-only evaluation evidence. |

### Human and network interfaces

| Document                                                         | Purpose                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| [human-control-surfaces.md](2a-design/human-control-surfaces.md) | Shared Task controls and views; current-turn Stop/Steer contract and gaps. |
| [http-boundary.md](2a-design/http-boundary.md)                   | HTTP adapter boundary.                                  |
| [conversation-execution.md](2a-design/conversation-execution.md) | Bounded turns, input ordering, authority, Stop and recovery. |
| [message-lifecycle.md](2a-design/message-lifecycle.md)           | Conversation, accepted Requests and closure, Task handoff, and implementation gaps. |
| [telegram-notifications.md](2a-design/telegram-notifications.md) | Telegram Conversation adapter and transport contract.   |
| [webui.md](2a-design/webui.md)                                   | Web UI surfaces and steering.                           |
| [may-console.md](2a-design/may-console.md)                       | Terminal REPL over the daemon socket.                   |
| [web-terminal.md](2a-design/web-terminal.md)                     | Browser terminal transport and ownership.               |

Documents declare `Accepted`, `Draft`, or `Tracker` independently from their
implementation status. Trackers belong under active proposals, not this
current-design list.

## Tier 2b — Manuals

| Document                                                                   | Purpose                                                     |
| -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [task-execution-guide.md](2b-manual/task-execution-guide.md) | Agent decisions and supported capabilities, from assignment through recovery. |
| [design-authoring.md](2b-manual/design-authoring.md) | Purpose-linked writing, review, lifecycle and reusable agent guidance. |
| [user-guide.md](2b-manual/user-guide.md)                                   | CLI flags, Docker, socket, and chat commands.               |
| [source-reading-guide.md](2b-manual/source-reading-guide.md)               | Task and agent execution, model context, evidence tracing and extension ownership. |
| [sdk-quickstart.md](2b-manual/sdk-quickstart.md)                           | Checked App quickstart and public capability guide.                                         |
| [handler-authoring.md](2b-manual/handler-authoring.md)                     | Task reconciler results, waits and mutation rules.                                    |
| [workflow-authoring.md](2b-manual/workflow-authoring.md)                   | Workflow authoring, advisory best practices and checked examples. |
| [Checking App behavior](2b-manual/workflow-authoring.md#checking-app-behavior) | Common behavior review using contract tests, contrasting trials and bounded Evaluation evidence. |
| [agent-app-adoption-playbook.md](2b-manual/agent-app-adoption-playbook.md) | Adoption checklist using the shared quickstart.                   |
| [agent-convention.md](2b-manual/agent-convention.md)                       | Agent directory and definition conventions.                 |
| [metric-alerts.md](2b-manual/metric-alerts.md)                             | Alert triage, repair, calibration, and escalation.          |
| [event-runtime-audit.md](2b-manual/event-runtime-audit.md)                 | Compare event runtime behavior with design.                 |
| [guard-runtime-audit.md](2b-manual/guard-runtime-audit.md)                 | Inspect guard volume and signal quality.                    |
| [app-operations-recovery.md](2b-manual/app-operations-recovery.md)         | Restart, recovery, migration, and deployment verification.  |

## Proposals and history

Read [active proposals and implementation follow-up](proposals/README.md) for
remaining choices, and [archived reviews](archive/README.md#implementation-and-trial-records)
for completed investigations and dated evidence. A record's presence in the
archive does not mean every trial shipped or every limitation was resolved.
