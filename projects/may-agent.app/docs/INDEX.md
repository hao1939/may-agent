# Documentation Index

Start with [README.md](README.md) for task-oriented reading paths. This index
lists every current design/manual and routes historical material to the
archive.

## Tier 1 — Principles

| Document                                              | Purpose                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| [core-principles.md](1-principles/core-principles.md) | Governing architecture principles.                     |
| [work-model.md](1-principles/work-model.md)           | Projects hold context; signals wake; agents judge.     |
| [evidence-first.md](1-principles/evidence-first.md)   | Hypothesis, evidence, and validation discipline.       |
| [code-vs-data.md](1-principles/code-vs-data.md)       | Choose code, instructions, skills, workflows, or data. |
| [evolution.md](1-principles/evolution.md)             | Evidence-backed mechanism and knowledge evolution.     |

## Tier 2a — Current design

### System and storage

| Document                                           | Purpose                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| [system-model.md](2a-design/system-model.md)       | Compact whole-system model; read first.                           |
| [architecture.md](2a-design/architecture.md)       | Detailed runtime architecture and subsystem map.                  |
| [system-boundary.md](2a-design/system-boundary.md) | Infrastructure primitives versus agent/app patterns.              |
| [storage.md](2a-design/storage.md)                 | Authoritative artifacts, projections, migration, and maintenance. |
| [app-root-layout.md](2a-design/app-root-layout.md) | Durable source, runtime state, workspaces, and scratch layout.    |

### Agents and execution

| Document                                                       | Purpose                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| [agents.md](2a-design/agents.md)                               | Agent identity, cooperation, and app-local registration. |
| [runtime.md](2a-design/runtime.md)                             | Model/tool execution and runtime internals.              |
| [sessions.md](2a-design/sessions.md)                           | Durable execution lifecycle and persistence.             |
| [workflows.md](2a-design/workflows.md)                         | Agent-owned reusable process and execution contract.     |
| [skills.md](2a-design/skills.md)                               | Scoped reusable judgment guidance.                       |
| [sdk.md](2a-design/sdk.md)                                     | Stable agent and workflow capability surface.            |
| [native-coding-workers.md](2a-design/native-coding-workers.md) | Codex/Claude adapter and continuity model.               |

### Agent Apps and projects

| Document                                                     | Purpose                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [agent-app.md](2a-design/agent-app.md)                       | Agent App package, ownership, and optional autonomy.                   |
| [projects.md](2a-design/projects.md)                         | Durable goal context, project posture, and workspace layout.           |
| [task-resource-engine.md](2a-design/task-resource-engine.md) | Canonical tasks, key queue, Conditions, claims, results, and recovery. |
| [default-project-ui.md](2a-design/default-project-ui.md)     | Shared project readout and steering contract.                          |

### Events, scheduling, and reliability

| Document                                                         | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| [events.md](2a-design/events.md)                                 | Event envelope, delivery, and ownership.             |
| [event-graph.md](2a-design/event-graph.md)                       | Causality, closure, and delivery read model.         |
| [cron.md](2a-design/cron.md)                                     | Time-based event production.                         |
| [heartbeat.md](2a-design/heartbeat.md)                           | Owner heartbeat workflows and loaders.               |
| [metrics.md](2a-design/metrics.md)                               | Metrics, alerts, pairs, and blind spots.             |
| [guards.md](2a-design/guards.md)                                 | Detection signals and observability.                 |
| [escalation.md](2a-design/escalation.md)                         | Owner-boundary escalation and closure.               |
| [practice-learning-loop.md](2a-design/practice-learning-loop.md) | Evaluation evidence to learned improvement.          |
| [session-eval-trail.md](2a-design/session-eval-trail.md)         | Session summary and append-only evaluation evidence. |

### Human and network interfaces

| Document                                                         | Purpose                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| [human-control-surfaces.md](2a-design/human-control-surfaces.md) | Shared CLI, Telegram, Web, and console intent contract. |
| [http-boundary.md](2a-design/http-boundary.md)                   | HTTP adapter boundary.                                  |
| [telegram-notifications.md](2a-design/telegram-notifications.md) | Telegram delivery and interaction contract.             |
| [webui.md](2a-design/webui.md)                                   | Web UI surfaces and steering.                           |
| [may-console.md](2a-design/may-console.md)                       | Terminal REPL over the daemon socket.                   |
| [web-terminal.md](2a-design/web-terminal.md)                     | Browser terminal transport and ownership.               |

Documents declare `Accepted`, `Draft`, or `Tracker` independently from their
implementation status. Trackers belong under active proposals, not this
current-design list.

## Tier 2b — Manuals

| Document                                                   | Purpose                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| [user-guide.md](2b-manual/user-guide.md)                   | CLI flags, Docker, socket, and chat commands.      |
| [sdk-quickstart.md](2b-manual/sdk-quickstart.md)           | SDK usage examples.                                |
| [handler-authoring.md](2b-manual/handler-authoring.md)     | Event handler authoring.                           |
| [workflow-authoring.md](2b-manual/workflow-authoring.md)   | Workflow authoring and invocation.                 |
| [agent-convention.md](2b-manual/agent-convention.md)       | Agent directory and definition conventions.        |
| [metric-alerts.md](2b-manual/metric-alerts.md)             | Alert triage, repair, calibration, and escalation. |
| [event-runtime-audit.md](2b-manual/event-runtime-audit.md) | Compare event runtime behavior with design.        |
| [guard-runtime-audit.md](2b-manual/guard-runtime-audit.md) | Inspect guard volume and signal quality.           |

## Tier 3 — Active proposals and trackers

| Document                                                             | Status                      | Purpose                                                             |
| -------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| [chat-agent-separation.md](3-proposals/chat-agent-separation.md)     | Draft / partial             | Separate persistent chat turns from bounded jobs.                   |
| [system-operations-model.md](3-proposals/system-operations-model.md) | Accepted concepts / partial | Converge platform operational health under May Agent App ownership. |
| [handler-audit.md](3-proposals/handler-audit.md)                     | Tracker                     | Audit remaining handler and compatibility surfaces.                 |

Completed proposals do not remain in the active proposal folder.

## Historical material

[Archive index](archive/README.md) contains:

- accepted decision records whose durable rules moved into Tier 2;
- dated design reviews;
- completed implementation plans and trackers; and
- V2 specifications and migration records.
