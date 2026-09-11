# Documentation Index

Start with [README.md](README.md) for task-oriented reading paths. This index
lists every current design/manual and routes historical material to the
archive.

## Which document owns the answer?

| Question | Authority |
| --- | --- |
| How do we apply the philosophy to actual work and reviews? | [Decision and review guide](1-principles/core-principles.md#review-rule) |
| What is May for, and what counts as progress? | [May's goal](1-principles/design-philosophy.md#mays-goal) |
| How do we define a project goal clearly enough to choose work? | [Define the goal first](1-principles/design-philosophy.md#define-the-goal-first) |
| What do we value, and how do we judge a technical choice? | [Design Philosophy](1-principles/design-philosophy.md) and [Core Principles](1-principles/core-principles.md) |
| Can the same choice create both value and cost? | [Value and cost](1-principles/design-philosophy.md#value-and-cost) |
| How do lifetime, usage, and the cost of being wrong change a decision? | [Match the horizon and risk](1-principles/design-philosophy.md#match-the-horizon-and-risk) |
| What wins when design preferences conflict? | [Fundamental tradeoff rules](1-principles/design-philosophy.md#how-to-decide-a-tradeoff) |
| What is the whole mental model? | [system-model.md](2a-design/system-model.md) |
| What are the four core components, their dependencies and code homes? | [architecture.md](2a-design/architecture.md) |
| How do human messages, Task results and timer reviews enter Conversation? | [One conversation input path](2a-design/message-lifecycle.md#one-conversation-input-path) |
| How does May track and close an accepted ask? | [message-lifecycle.md](2a-design/message-lifecycle.md#requests-acceptance-and-closure) |
| How do Message, inbox item, Turn, Request and model step differ? | [Message vocabulary](2a-design/message-lifecycle.md#mental-model) |
| Which Conversation guarantees are core and which behavior is replaceable? | [Conversation boundary](2a-design/architecture.md#conversation-core-and-capability-boundary) |
| How should Conversation, Request and Topic reads/writes be coordinated? | [Conversation state API](2a-design/storage.md#conversation-state-api) |
| Is this Host or App responsibility? | [system-boundary.md](2a-design/system-boundary.md) |
| Is this a request, task, or fact? | [work-model.md](1-principles/work-model.md) |
| How does an App declare behavior? | [agent-app.md](2a-design/agent-app.md) |
| Which state is authoritative and rebuildable? | [storage.md](2a-design/storage.md) |
| How does the Host start, recover and shut down? | [runtime.md](2a-design/runtime.md) |
| How are desired-state Tasks reconciled? | [task-resource-engine.md](2a-design/task-resource-engine.md) |
| How does admitted input/fact routing work? | [events.md](2a-design/events.md) |
| How do humans share context across adapters? | [human-control-surfaces.md](2a-design/human-control-surfaces.md) |
| How does a particular subsystem behave? | Its Tier 2a subsystem document |
| How do I perform an operation? | The corresponding Tier 2b manual |

Do not restate a subsystem contract in a whole-system document. Link to its
owning document and keep implementation details there.

## Tier 1 — Principles

| Document                                              | Purpose                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| [design-philosophy.md](1-principles/design-philosophy.md) | Project goal, sufficient outcomes, value and cost, learning, and judgment. |
| [core-principles.md](1-principles/core-principles.md) | Technical decision rules: simple first, stable core, events, authority, and conventions. |
| [work-model.md](1-principles/work-model.md)           | Projects hold context; signals wake; agents judge.     |
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
| [sessions.md](2a-design/sessions.md)                           | Durable execution lifecycle and persistence.                  |
| [workflows.md](2a-design/workflows.md)                         | App-local reusable process and execution contract.            |
| [skills.md](2a-design/skills.md)                               | Scoped reusable judgment guidance.                            |
| [sdk.md](2a-design/sdk.md)                                     | Stable agent and workflow capability surface.                 |
| [native-coding-workers.md](2a-design/native-coding-workers.md) | Codex/Claude adapter and continuity model.                    |

### Apps and projects

| Document                                                     | Purpose                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [agent-app.md](2a-design/agent-app.md)                       | App package, ownership, input, and Task policy.                         |
| [projects.md](2a-design/projects.md)                         | Durable goal context, project posture, and workspace layout.           |
| [task-resource-engine.md](2a-design/task-resource-engine.md) | Canonical tasks, key queue, Conditions, claims, results, and recovery. |
| [default-project-ui.md](2a-design/default-project-ui.md)     | Shared project readout and steering contract.                          |

### Events, scheduling, and reliability

| Document                                                         | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| [events.md](2a-design/events.md)                                 | Event admission, routing, and acceptance.             |
| [event-graph.md](2a-design/event-graph.md)                       | Causality, closure, and trace read model.            |
| [cron.md](2a-design/cron.md)                                     | Time-based event production.                         |
| [heartbeat.md](2a-design/heartbeat.md)                           | Agent heartbeat workflows and App schedules.         |
| [metrics.md](2a-design/metrics.md)                               | Metrics, alerts, pairs, and blind spots.             |
| [guards.md](2a-design/guards.md)                                 | Detection signals and observability.                 |
| [escalation.md](2a-design/escalation.md)                         | Cross-App and human-boundary requests.               |
| [practice-learning-loop.md](2a-design/practice-learning-loop.md) | Evaluation evidence to learned improvement.          |
| [session-eval-trail.md](2a-design/session-eval-trail.md)         | Session summary and append-only evaluation evidence. |

### Human and network interfaces

| Document                                                         | Purpose                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| [human-control-surfaces.md](2a-design/human-control-surfaces.md) | Shared Task controls and views; current-turn Stop/Steer contract and gaps. |
| [http-boundary.md](2a-design/http-boundary.md)                   | HTTP adapter boundary.                                  |
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
| [user-guide.md](2b-manual/user-guide.md)                                   | CLI flags, Docker, socket, and chat commands.               |
| [sdk-quickstart.md](2b-manual/sdk-quickstart.md)                           | Checked App quickstart and public capability guide.                                         |
| [handler-authoring.md](2b-manual/handler-authoring.md)                     | Task reconciler results, waits and mutation rules.                                    |
| [workflow-authoring.md](2b-manual/workflow-authoring.md)                   | Workflow authoring and invocation.                          |
| [agent-app-adoption-playbook.md](2b-manual/agent-app-adoption-playbook.md) | Adoption checklist using the shared quickstart.                   |
| [agent-convention.md](2b-manual/agent-convention.md)                       | Agent directory and definition conventions.                 |
| [metric-alerts.md](2b-manual/metric-alerts.md)                             | Alert triage, repair, calibration, and escalation.          |
| [event-runtime-audit.md](2b-manual/event-runtime-audit.md)                 | Compare event runtime behavior with design.                 |
| [guard-runtime-audit.md](2b-manual/guard-runtime-audit.md)                 | Inspect guard volume and signal quality.                    |
| [app-operations-recovery.md](2b-manual/app-operations-recovery.md)         | Restart, recovery, migration, and deployment verification.  |

## Tier 3 — Active proposals and trackers

Active reviews are:

- [One conversation input flow](proposals/conversation-input-unification.md)
  — accepted human/Task/timer handling unification, whole-system review, scope
  tradeoffs and pending replacement of the separate supervision Task;

- [Workflow tracing by default and useful health metrics](proposals/workflow-tracing-and-health-metrics.md)
  — first source slice under review: run diagnostics, replaceable outcome
  observations, explicit limits and remaining investigation/UI work;
- [External components: simple, solid, and clearly organized](proposals/external-components-simplification.md)
  — three focused fixes, explicit feature/reliability tradeoffs, and conditional
  evaluation, metric, and layout follow-ups;
- [Storage: a state service backed by SQLite](proposals/storage-state-service.md)
  — implemented input-to-Task attachment, Conversation state/handler separation
  and consistent naming, merged through #129;
- [Task controller pattern](proposals/task-controller-pattern.md)
  — controller/lifecycle direction: ordinary reconciliation, bounded retries,
  recovery and evidence required before claiming simplification;
- [Stable core and replaceable capabilities](proposals/task-runtime-organization.md)
  — compact remaining-work plan; canonical boundaries live in Architecture
  and completed separation/recovery evidence lives in the archive;
- [Simplify the system: fewer paths, clear owners](proposals/authority-boundary-simplification.md)
  — design reductions before code moves: Task handoff, evaluation UI scope and
  affordable redo; retained behavioral-comparison and App-owned delivery work;
- [design-implementation-convergence.md](proposals/design-implementation-convergence.md)
  — index of known source gaps and their owning contracts, including Request
  closure, turn control, owner decisions and remaining metric migration.

Earlier reviewed drafts were resolved as follows:

- service composition: accepted only as explicit typed Host-internal
  composition; the public service-loader/service-locator proposal was rejected;
- work admission: accepted with responsibility-based request/task/fact and
  bounded-attempt rules; source-based routes and rigid thresholds were rejected;
- Herdr terminal: the retained custom xterm/gateway proposal was rejected in
  favor of full-window ttyd attached directly to Herdr.

The decision records and current authorities are indexed under
[archive/](archive/README.md).

Completed proposals do not remain in the active proposal folder. The lightweight
Event/Task decision, Codex evaluation, Task interface, human-action projection,
and earlier presentation evidence are archived below.

## Historical material

[Core simplicity and robustness review — September 10](archive/reviews/core-simplicity-review-20260910.md)
records the latest source findings and reproducible probes; follow-up priorities
remain in the active core proposal.

[Error handling, metrics and responsive conversation — paused September 10](archive/reviews/error-handling-and-conversation-discussion-20260910.md)
preserves the open choices, earlier draft and live PoC. App placement and
consolidation remain undecided. The narrower
[workflow-first proposal](proposals/workflow-tracing-and-health-metrics.md)
resumes tracing and metrics for review without adopting those alternatives.

[Documentation clarity review and cleanup](archive/reviews/documentation-clarity-20260909.md)
records the source-backed September 9 audit and fixes.

[Archive index](archive/README.md) contains:

- accepted decision records whose durable rules moved into Tier 2;
- dated design reviews;
- completed implementation plans and trackers; and
- V2 specifications and migration records.
