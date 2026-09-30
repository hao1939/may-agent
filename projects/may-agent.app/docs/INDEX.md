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
| How do Conversation, ordinary work and maintenance share execution? | [One lifecycle](2a-design/architecture.md#one-reconciliation-model), [outcomes and closure](2a-design/task-resource-engine.md#one-lifecycle-baseline), and [implementation costs](proposals/conversation-input-unification.md#options-and-their-cost) |
| What are the four core components, their dependencies and code homes? | [architecture.md](2a-design/architecture.md) |
| How do human messages, Task results and timer reviews enter Conversation? | [One conversation input path](2a-design/message-lifecycle.md#one-conversation-input-path) |
| How does May track and close an accepted ask? | [message-lifecycle.md](2a-design/message-lifecycle.md#requests-acceptance-and-closure) |
| How do Message, inbox item, Turn, Request and model step differ? | [Message vocabulary](2a-design/message-lifecycle.md#mental-model) |
| Which Conversation guarantees are core and which behavior is replaceable? | [Conversation boundary](2a-design/architecture.md#conversation-core-and-capability-boundary) |
| How should Conversation, Request and Topic reads/writes be coordinated? | [Conversation state API](2a-design/storage.md#conversation-state-api) |
| Is this Host or App responsibility? | [system-boundary.md](2a-design/system-boundary.md) |
| How do code execution and agent judgment share the feedback loop? | [Execution feedback and wakes](2a-design/events.md#execution-feedback-and-agent-wakes) |
| How do agents offload polling without knowing event wiring? | [Resource observations](2a-design/agent-app.md#task-driven-resource-observation), [implementation/trial record](proposals/task-observation-implementation-20260930.md) |
| How do CLI runs, agent helpers and Tasks share execution rules? | [Execution boundary](2a-design/system-boundary.md#execution), [agent cooperation](2a-design/agents.md), and [consolidation proposal](proposals/execution-entrypoint-consolidation.md) |
| How do contracts and conventions keep extensions local? | [Convention over configuration](1-principles/core-principles.md#convention-over-configuration) and [resource ownership](2a-design/agent-app.md#resource-ownership-by-convention) |
| Is this a request, task, or fact? | [work-model.md](1-principles/work-model.md) |
| How does an App declare behavior? | [agent-app.md](2a-design/agent-app.md) |
| Which state is authoritative and rebuildable? | [storage.md](2a-design/storage.md) |
| How does the Host start, recover and shut down? | [runtime.md](2a-design/runtime.md) |
| How are desired-state Tasks reconciled? | [task-resource-engine.md](2a-design/task-resource-engine.md) |
| How does current Task context reach a worker? | [Context passing](2a-design/agents.md#context-passing) and the [decision-context integration record](proposals/task-decision-context-integration-20260926.md). |
| What instructions, tools and context actually reach the model? | [Model context assembly](2a-design/agents.md#model-context-assembly), [assembly manual](2b-manual/agent-convention.md#system-prompt-assembly), and [source review](proposals/agent-prompt-assembly-review-20260927.md) |
| How does admitted input/fact routing work? | [events.md](2a-design/events.md) |
| When should an event update a resource, wake reconciliation or react directly? | [Resource responsibility and immediate reactions](2a-design/events.md#resource-responsibility-and-reconciliation) |
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
| [sessions.md](2a-design/sessions.md)                           | Bounded execution, continuity and retained evidence.           |
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
| [task-resource-read-interface.md](2a-design/task-resource-read-interface.md) | Bounded App, operator, and adapter Task read contracts. |
| [default-project-ui.md](2a-design/default-project-ui.md)     | Shared project readout and steering contract.                          |

### Events, scheduling, and reliability

| Document                                                         | Purpose                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| [events.md](2a-design/events.md)                                 | Event admission, routing, and acceptance.             |
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

## Proposal and implementation records

The current contracts are indexed above. These records retain decisions, trials
and implementation history at stable paths. Inclusion here does not mean a
change is pending, unmerged or deployed. Read the record's evidence and the
current owning contract together; use Git for current PR/source status.

- [Recover current work from execution evidence](proposals/recovery-from-execution-evidence-20260922.md)
- [Task context discovery](proposals/task-context-discovery-20260917.md)
- [Design documentation live-truth review](proposals/design-doc-live-truth-review-20260920.md)
- [Ordinary commands from Task workers](proposals/task-worker-command-context-20260919.md)
- [Explicit Task result scope](proposals/explicit-task-input-consideration-20260930.md)
- [Wait corrections and unanswered input recovery](proposals/task-wait-recovery-20260918.md)
- [Reduce context cost through App knowledge and agent methods](proposals/focused-session-continuation.md)
- [Keep domain policy in Apps, keep the Host generic](proposals/app-policy-and-host-boundary-cleanup.md)
- [A recurring task to review and improve May](proposals/may-project-review-loop-20260912.md)
- [Review Host scripts and retire completed PoCs](proposals/poc-retirement-and-knowledge-20260912.md)
- [Teaching agents: from a correction to dependable behavior](proposals/agent-behavior-and-capability-extension.md)
- [guidance PoC](proposals/agent-adoption-poc-20260912.md)
- [workflow process-stability follow-up](proposals/workflow-stability-poc-20260912.md)
- [real-daemon teaching / natural procedure selection](proposals/conversation-adoption-poc-20260912.md)
- [Telegram: a natural conversation with reliable follow-through](proposals/telegram-conversation-experience.md)
- [Conversation and Task: one reconciliation model](proposals/conversation-input-unification.md)
- [Workflow tracing by default and useful health metrics](proposals/workflow-tracing-and-health-metrics.md)
- [External components: simple, solid, and clearly organized](proposals/external-components-simplification.md)
- [Reliable observer feedback without a subscription system](proposals/observer-feedback-and-resource-conventions.md)
- [Storage: a state service backed by SQLite](proposals/storage-state-service.md)
- [Task controller pattern](proposals/task-controller-pattern.md)
- [Stable core and replaceable capabilities](proposals/task-runtime-organization.md)
- [Simplify the system: fewer paths, clear owners](proposals/authority-boundary-simplification.md)
- [design-implementation-convergence.md](proposals/design-implementation-convergence.md)

Earlier reviewed drafts were resolved as follows:

- service composition: accepted only as explicit typed Host-internal
  composition; the public service-loader/service-locator proposal was rejected;
- work admission: accepted with responsibility-based request/task/fact and
  bounded-attempt rules; source-based routes and rigid thresholds were rejected;
- Herdr terminal: the retained custom xterm/gateway proposal was rejected in
  favor of full-window ttyd attached directly to Herdr.

The decision records and current authorities are indexed under
[archive/](archive/README.md).

Keep records at stable paths. Update status and links when a decision lands;
current contracts belong in the design tier, and dated evidence does not define
the running installation. See the [documentation review](archive/reviews/design-doc-hygiene-20260927.md).
