<ai_context>
This finding examines Termexo's local MCP control plane at one pinned repository revision. Scout inspected the HN item, README, MCP guide, tool catalog, server/tool-gating source, repository tree, and the project's authored live-test report; Scout did not run the Windows application, MCP service, agents, or tests, and did not inspect the uncommitted local evidence cited by that report.
</ai_context>

# An agent control plane must separate operation from verdict

**Date:** 2026-10-16  
**Source:** https://news.ycombinator.com/item?id=50119778  
**Repo:** https://github.com/gemron/Termexo  
**Pinned revision inspected:** [`8c78e2a719b8d58617b2c712365653ee50e5707f`](https://github.com/gemron/Termexo/commit/8c78e2a719b8d58617b2c712365653ee50e5707f)  
**Disposition:** New knowledge

## Question

What authority and evidence boundaries appear when one coding agent can operate other agents through a local terminal control plane?

## Finding

Termexo exposes a local MCP service through which one connected agent can list terminals, write and submit terminal input, read terminal snapshots, launch or stop agent-backed tasks, mark a task complete, and verify it. Its documentation is unusually explicit that successful input delivery or task launch is only an operation receipt: `terminal_write` means bytes reached the PTY, `task_execute` means the launch and task-terminal binding began, and a timeout does not cancel an operation that may already have started. The client is told to inspect task state or terminal output before retrying.

The reusable boundary is that **control authority, observation, completion assertion, and acceptance should not collapse into one permission**. At the inspected revision, `tools.rs` gates the catalog by three broad groups. Enabling terminal access reveals both read operations and effectful create/write/close operations. Enabling task access reveals list/create/execute/stop/resume together with `task_complete` and `task_verify`. The project's live-test report carefully says its completion and verification calls tested workbench state transitions, not whether an agent actually completed development work. That caveat identifies the architectural gap: a control-plane transition is not independently grounded outcome evidence.

## What the pinned source supports

### 1. Agent-to-agent terminal control is transitive authority

The README and MCP guide describe one AI finding another agent's real terminal, sending a prompt, submitting Enter, and reading the reply. The same terminal group can create a shell with an optional command and close a terminal and its process. Therefore the initiating agent's effective authority includes the target terminal's logged-in CLI, working directory, environment, configured model access, and downstream tools—not merely the MCP method names visible at the first hop.

Termexo reduces transport exposure: the server is off by default, binds IPv4 loopback, requires a bearer token, validates Host and Origin, rejects unknown arguments, and rechecks disabled permissions even for clients that previously discovered a tool. Those controls protect entry to the local service; they do not narrow the authority of a terminal write once admitted.

### 2. Delivery, execution, and completion are different receipts

The bundled tool descriptions call `terminal_read` a snapshot rather than a command-completion signal and say `terminal_write` success does not mean the command finished. `task_execute` returns starting state and requires later inspection. The guide also warns that a 60-second timeout does not roll back an already-started desktop operation, so state must be checked before retry to avoid duplicate creation or execution.

This is a useful minimum receipt model:

1. request admitted;
2. input delivered or launch started;
3. target process/agent lifecycle observed;
4. claimed work product inspected; and
5. acceptance issued by an authority independent of the worker's assertion.

A terminal snapshot or task-board state may support steps 2–3, but neither proves the requested repository, service, or external system reached its intended terminal state.

### 3. Broad permission groups combine unlike powers

`src-tauri/src/mcp/tools.rs` exposes tools according to `terminal_access`, `task_access`, or `settings_access`. The terminal group includes list/read and create/write/close. The task group includes list/create/update/delete/execute/stop/resume plus complete and verify. Client-side tool approval remains an additional control, but the service-side capability model itself does not separate observation from mutation or worker control from outcome acceptance.

For a higher-assurance runtime, use narrower grants: read terminal; write a named terminal; start or stop a named task; assert completion; and accept verified evidence. Bind each effect to workspace/task identity, caller, scope, and freshness. Most importantly, do not let the same untrusted worker mint the final acceptance receipt merely because it can drive the task UI.

### 4. Project tests establish transport and state-flow behavior, not outcome validity

The repository-authored live-test report says a real Windows build, PTY, Codex CLI, and MCP clients exercised all 19 tools, authentication, task transitions, terminal I/O, and automatic client registration. It explicitly limits the completion/verification check to desktop state flow and says the autonomous test manipulated a draft task rather than executing a development task. The report points to local `.tooling` evidence excluded from version control; Scout did not inspect those files or reproduce the run.

Thus the report supports authored evidence of an implemented control path, with an explicit semantic limit. It does not validate that terminal output was interpreted correctly, that task completion matched acceptance criteria, or that broad permission groups are safe under a hostile or mistaken connected agent.

## Reusable implications

1. **Model transitive authority.** A terminal-write capability inherits the target process's credentials, filesystem, tools, and approvals.
2. **Split read, effect, verdict, and acceptance grants.** Convenience groupings are not least privilege.
3. **Make timeouts outcome-unknown.** Query durable state before retrying an operation that may have started.
4. **Keep lifecycle status provisional.** PTY delivery and task-board transitions do not prove authoritative external effects.
5. **Require independent acceptance evidence.** Completion assertions should reference fresh checks that the worker cannot unilaterally mint or rewrite.

## Evidence limits

- The HN submission had one point and no comments when inspected, so it is discovery rather than community validation.
- Scout inspected static source and documentation at the pinned revision but did not run Termexo, its tests, a Windows PTY, or any supported coding agent.
- The project-authored live-test report describes real executions, but its raw evidence is uncommitted local material unavailable in the inspected repository revision.
- The repository tree contained extensive source and tests, but their presence is not evidence that they pass at this revision.
- Loopback, bearer authentication, schema validation, and client approval do not establish complete mediation of equivalent effects reachable inside a controlled terminal.

## Sources inspected

- [HN item 50119778](https://news.ycombinator.com/item?id=50119778)
- [Pinned repository revision](https://github.com/gemron/Termexo/tree/8c78e2a719b8d58617b2c712365653ee50e5707f)
- [README](https://github.com/gemron/Termexo/blob/8c78e2a719b8d58617b2c712365653ee50e5707f/README.md)
- [MCP guide](https://github.com/gemron/Termexo/blob/8c78e2a719b8d58617b2c712365653ee50e5707f/docs/mcp-server.md)
- [MCP tool catalog](https://github.com/gemron/Termexo/blob/8c78e2a719b8d58617b2c712365653ee50e5707f/src-tauri/src/mcp/tools.json)
- [Permission grouping and argument validation](https://github.com/gemron/Termexo/blob/8c78e2a719b8d58617b2c712365653ee50e5707f/src-tauri/src/mcp/tools.rs)
- [Loopback server, authorization, and protocol checks](https://github.com/gemron/Termexo/blob/8c78e2a719b8d58617b2c712365653ee50e5707f/src-tauri/src/mcp/server.rs)
- [Project-authored live-test report](https://github.com/gemron/Termexo/blob/8c78e2a719b8d58617b2c712365653ee50e5707f/docs/mcp-live-test.md)
