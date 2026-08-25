# Native Coding Workers

**Design status:** Accepted.
**Implementation status:** Implemented as both a direct Task executor adapter
and a compatibility execution tool, using the same persistent worker records,
classified failures, expected-output validation, and native process runner.

Tasks that select `codex-goal` use the
[persistent Codex goal executor](../proposals/codex-goal-executor.md): Codex
keeps working toward the Task goal, receives live Task events, and resumes the
same thread after process failure. The older `codex` executor remains a
one-shot compatibility adapter.

Direct execution sessions can delegate bounded coding work to native coding
agents such as Codex CLI and Claude Code. These tools are not terminal tabs,
project owners, App requests, or tasks. They are worker runtimes behind the
event system.

A Task may select `executor: "codex-goal"`, `executor: "codex"`, or
`executor: "claude"`; Runtime then
awaits the native result inside that exact fenced attempt and admits it through
the ordinary `TaskReconcileResult` boundary. An owner may still call
`run_cli_agent` for a bounded second opinion, but that compatibility tool
returns an accepted worker record and the caller must await/review its terminal
evidence before using it. Work that must outlive the caller belongs to a Task
or cross-App dependency, never a detached CLI process.

Codex and Claude are default entries behind the same named executor boundary
used by Host extensions. Replacing one adapter does not change Task intent,
events, result admission, or recovery.

## Mental Model

```text
an execution session needs bounded native-worker evidence
        |
        v
the calling agent decides whether delegation is useful
        |
        v
tool call: run_cli_agent(...)
  writes prompt.md and task metadata
  emits cli.task.requested
        |
        v
cli-task-runner
  owns process lifecycle and native session continuity
        |
        v
Codex CLI or Claude Code
  performs one bounded task
        |
        v
cli.task.completed / cli.task.failed / cli.task.orphaned
  returns evidence to the caller for judgment
```

For a direct Task executor, the Task Runtime validates and fences the returned
JSON; for `run_cli_agent`, the live caller reviews it. In both cases the worker
only reports what it did. Its record and native session never become durable
unfinished work.

The native worker result is never accepted merely because the process exited
successfully. It must satisfy the declared JSON shape and then pass normal Task
result validation and acceptance, or be reviewed by the bounded compatibility
caller.

When the purpose is a second or third opinion, independence matters:

- Follow a tool named by Hao.
- Otherwise select an available capable worker without inventing claims about
  vendor strengths.
- Start a fresh native context for an independent opinion. Resume only to
  continue the same worker's unfinished line of work.
- Ask one neutral question and attach only the trusted evidence needed to
  answer it. Do not give the next worker another worker's conclusion.
- Resolve disagreement with primary evidence. A majority vote is not proof.
- Ask for a third opinion only when the decision is material and the evidence
  still leaves meaningful uncertainty.
- The accountable App owns the final decision, action, and follow-through.

The split is intentional:

- The tool call records the caller's decision to start a worker;
  `cli.task.requested` is the persistent process-lifecycle opener in the
  existing trace.
- The event is the process handoff, not an App/task ownership transfer.
- The runner is the runtime owner of the external process.
- The native CLI process is replaceable implementation detail.
- The owner-facing completion is compact; full native output stays in
  artifacts.

Event publication does not block inside the Codex or Claude process. The
asynchronous runner owns it, while the bounded Task/caller awaits the terminal
event when the result is required for its own decision.

Accepted is not completed. Before a caller uses a result, it waits for
`cli.task.completed`, `cli.task.failed`, or `cli.task.orphaned`, then inspects
`result.md`, `result.json`, and `events.jsonl`. A retry must name the observed
failure category and change the failed assumption, such as timeout, context,
permission, output contract, or hypothesis. Repeating the same request is not
recovery.

## Why This Exists

External coding agents are useful for a second opinion, focused review, or
isolated patch attempt within a bounded execution. They are bad as hidden work
queues because worker records do not own eventual completion.

The correct boundary is an adapter:

- The caller owns the bounded intent and review; the App owns project state.
- The CLI worker owns one native coding-agent process.
- The adapter translates May events into native CLI calls and native streams
  back into May events and artifacts.

This is the same core pattern used by OpenClaw/Hermes-style coding-agent
integration: the framework owns orchestration, while Codex or Claude owns code
execution. The "magic" is small:

- teach the caller when to use the native coding agent;
- launch the native runtime in the right mode;
- remember the native session id;
- parse the native event stream;
- return a persisted worker result for caller review.

The native worker does not become an App planner or owner.

## Current Implementation

The current runtime has two layers:

| Layer            | File                                                | Responsibility                                                                                                  |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Task adapter     | `projects/may-agent/src/app/app-task-cli-executor.ts` | Translate one fenced Task attempt into a CLI request and return its terminal JSON to normal Task admission.     |
| Tool surface     | `projects/may-agent/src/lib/tools/run-cli-agent.ts` | Create task id, write prompt/request files, emit `cli.task.requested`, return immediately.                      |
| Runtime runner   | `projects/may-agent/src/app/cli-task-runner.ts`     | Subscribe to `cli.task.requested`, spawn Codex/Claude, persist task record, parse output, emit terminal events. |
| Event schema     | `projects/may-agent/src/app/event-bus.ts`           | Defines `cli.task.requested`, `started`, `completed`, `failed`, and `orphaned`.                                 |
| Restart recovery | `projects/may-agent/src/app/daemon-events.ts`       | Marks in-flight CLI tasks as orphaned after runtime restart.                                                    |

The old blocking `codex_worker`, `cc_worker`, and `dual_review` tools are
retired. Both the Task adapter and compatibility tool use the same
`cli.task.*` process boundary; only the caller and final result admission
differ.

Shipped behavior today:

- `TaskIntent.executor` selects `codex` or `claude`; Runtime creates a
  deterministic worker identity per Task attempt, renews the Task lease, and
  admits the returned JSON through the ordinary Task fence.
- A Git-backed direct CLI Task receives an isolated task-generation worktree;
  process and native-session records remain attempt evidence.
- `run_cli_agent` writes `prompt.md` and `request.json`.
- `cli-task-runner` writes `task.json`, `events.jsonl`, `result.md`, and
  `result.json`, plus `session.json` when the native session id is known.
- Completion requires a successful process, usable output, and any requested
  JSON/required-field contract. Failures are classified by category.
- A still-live source session receives a compact `session.steer.requested` update
  with paths and session id when `sourceSessionId` is available.
- `files` are added to the worker prompt as scoped context.
- `worktree` is used as the native process cwd when provided.
- Relative `files` resolve against `worktree` when present, otherwise `cwd`.
- `structuredResultPath` points at `result.json` in terminal events.

## Runtime Flow

Within a compatible bounded execution session, the flow is:

```text
caller invokes run_cli_agent({
  tool: "codex",
  mode: "review",
  prompt: "...focused review packet...",
  cwd: "/app/projects/...",
  reuseSession: true
})
        |
        v
run_cli_agent writes:
  .state/cli-tasks/<taskId>/prompt.md
  .state/cli-tasks/<taskId>/request.json
        |
        v
run_cli_agent emits:
  cli.task.requested {
    taskId,
    tool,
    mode,
    cwd,
    promptPath,
    resultPath,
    eventsPath,
    sourceOwner,
    sourceSessionId
  }
        |
        v
cli-task-runner starts native process:
  codex exec ...    or    claude -p ...
        |
        v
cli-task-runner writes:
  .state/cli-tasks/<taskId>/task.json
  .state/cli-tasks/<taskId>/events.jsonl
  .state/cli-tasks/<taskId>/result.md
  .state/cli-tasks/<taskId>/result.json
  .state/cli-tasks/<taskId>/session.json  (when native id is known)
        |
        v
cli-task-runner emits one terminal event:
  cli.task.completed | cli.task.failed | cli.task.orphaned
```

Only a compact completion is injected back into a still-live source session.
The full native stream stays in the task artifacts.

```text
source session receives:
  CLI task <taskId> completed.
  Tool: codex
  Summary: ...
  Result: .../result.md
  Events: .../events.jsonl
  CLI session: ...

Disk receives:
  prompt.md
  request.json
  task.json
  result.md
  result.json
  events.jsonl
  session.json
```

Do not paste the full native tool stream into the caller's context by default.
The caller can read the artifact files when it needs details.

## Skill-Guided Operation

Hermes packages its Claude/Codex knowledge as skills: when to use print mode,
when to use tmux/PTY, which flags avoid prompts, how to resume, how to monitor
background work, and when to isolate work with git worktrees. That is worth
copying as an operating pattern.

The runtime uses the same split:

- A skill or design guide teaches agents how to decide and packetize native
  coding work.
- Runtime code executes the packet through `run_cli_agent` and `cli.task.*`.

Do not encode every vendor-specific habit in project workflows. Keep workflows
business-focused and let the native-worker guide plus adapter handle CLI
details.

## Event Contract

The current event contract is intentionally small. The historical `cli.task.*`
name identifies a native-worker process record, not a canonical App task.
`cli.task.requested` is the handoff to the runtime, `cli.task.started` is
observability, and exactly one of `cli.task.completed`, `cli.task.failed`, or
`cli.task.orphaned` closes the worker run.

```typescript
cli.task.requested {
  taskId: string;
  tool: "codex" | "claude";
  mode: "investigate" | "review" | "patch";
  cwd: string;
  promptPath: string;
  resultPath: string;
  structuredResultPath?: string;
  eventsPath?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  effectiveSandbox?: "read-only" | "workspace-write" | "danger-full-access";
  sandboxFallbackReason?: string;
  timeoutMs?: number;
  sourceOwner: string;
  sourceSessionId?: string;
  resumeSessionId?: string;
  reuseSession?: boolean;
  files?: string[];
  worktree?: string;
  worktreePolicy?: "use-existing" | "require";
  expectedOutput?: {
    format: "markdown" | "json";
    requiredFields?: string[];
  };
}

cli.task.started {
  taskId;
  tool;
  mode;
  cwd;
  promptPath;
  resultPath;
  structuredResultPath?;
  eventsPath?;
  pid?;
  attempt?;
  sourceSessionId?;
  effectiveSandbox?;
  sandboxFallbackReason?;
  reuseSession?;
}

cli.task.completed {
  taskId;
  tool;
  resultPath;
  structuredResultPath?;
  eventsPath?;
  exitCode;
  summary;
  sourceSessionId?;
  cliSessionId?;
  resumeCommand?;
  effectiveSandbox?;
  sandboxFallbackReason?;
  reuseSession?;
}

cli.task.failed {
  taskId;
  tool;
  resultPath?;
  structuredResultPath?;
  eventsPath?;
  error;
  failureCategory?:
    | "timeout"
    | "permission"
    | "tool"
    | "no_output"
    | "output_schema"
    | "process";
  exitCode?;
  sourceSessionId?;
  cliSessionId?;
  resumeCommand?;
  effectiveSandbox?;
  sandboxFallbackReason?;
  reuseSession?;
}

cli.task.orphaned {
  taskId;
  tool?;
  pid?;
  reason;
  structuredResultPath?;
  sourceSessionId?;
  cliSessionId?;
  resumeCommand?;
  effectiveSandbox?;
  sandboxFallbackReason?;
  reuseSession?;
}
```

`cli.task.requested` targets `runtime:cli-task-runner`. Terminal events return
to `sourceOwner`, usually the agent that requested the worker.

The originating trace is part of the durable CLI record. A live source session
receives the terminal update. If that session is gone, the runtime retains the
artifacts but does not invent a replacement owner or human reply. Work that
must survive caller loss belongs in an App request or task before the caller
ends.

## State Semantics

The CLI task state describes the worker process, not the project outcome.

| Event                | Meaning                                                                               | Owner response                                                             |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `cli.task.started`   | The runner accepted the request and spawned the native process.                       | Usually observe only.                                                      |
| `cli.task.completed` | The native worker produced a usable result artifact.                                  | Review the result and decide whether the original work is resolved.        |
| `cli.task.failed`    | The native worker could not produce a usable result.                                  | Retry, adjust prompt/config, or handle the failure directly.               |
| `cli.task.orphaned`  | Runtime restarted while the native worker was running, so process ownership was lost. | Inspect artifacts/session id, then resume or retry from an owning attempt. |

The runner owns the deadline. Once it expires, the task fails as `timeout`
regardless of the native process exit code. The runner stops the whole CLI
process group, first gracefully and then forcibly after a short fixed grace
period. A zero exit code alone is insufficient for completion: Codex must emit
`turn.completed`, Claude must emit a successful `result`, and the result
artifact must contain usable output.

Do not close the original project task just because `cli.task.completed` fired.
Close it only after the owner judges the result.

## Native Session Continuity

Each external runtime has its own session concept:

- Codex emits a thread id from JSONL events.
- Claude emits a session id in stream output.

The runner stores these as native worker session ids. If `reuseSession` is true,
it can resume the latest native session for that owner and tool. If
`resumeSessionId` is provided, it wins for that request.

Session reuse is useful for continuity, but it is not a substitute for a clear
task packet. Every request still needs enough context to be independently
auditable.

## Command Shapes And Execution Modes

Claude should be headless-first. Prefer print mode because it returns and does
not need terminal dialog handling:

```bash
claude -p "$PROMPT" --output-format stream-json --verbose --permission-mode "$MODE"
```

Use Claude interactive PTY/tmux only when the job is truly conversational:
slash commands, human-in-the-loop choices, or exploratory multi-turn work.

Codex should also prefer structured non-interactive execution when it works in
the service environment:

```bash
codex exec --json --skip-git-repo-check --sandbox "$SANDBOX" -o "$RESULT_PATH" "$PROMPT"
```

For native continuation:

```bash
codex exec --json --skip-git-repo-check --sandbox "$SANDBOX" -o "$RESULT_PATH" resume "$THREAD_ID" "$PROMPT"
```

If a native CLI requires a PTY in a specific version or environment, the PTY is
an adapter implementation detail. May should still expose the same durable
`cli.task.*` events rather than terminal polling as the public model.

## Runtime Model Endpoint

May Runtime, Codex, and Claude use the shared model API configured by
`MODEL_BASE_URL` and `MODEL_API_KEY`. The clients only depend on their standard
wire protocols; LiteLLM is the current external implementation, not a runtime
concept.

At container startup, May writes Codex's endpoint configuration into
`CODEX_HOME`, then `MAY_CODEX_HOME`, then `$HOME/.codex`, in that order. The CLI
runner uses the same precedence so native session state and configuration stay
together. Claude receives the shared URL and credential through its
`ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` interface.

The practical check is simple:

```bash
codex exec --json --skip-git-repo-check --sandbox read-only -o /tmp/codex-smoke.md "Reply with exactly: ok"
```

If that works for the daemon user, a compatible execution session can launch Codex through
`run_cli_agent`. A custom Codex home must contain the generated endpoint
configuration before the worker starts.

## Result Contract

The worker writes `result.md` plus `result.json`. `result.md` is optimized for
human reading. `result.json` is optimized for owner workflows that need to judge
the result without parsing prose. The minimum `result.json` includes:

```typescript
{
  status: "completed" | "failed" | "partial" | "timed_out";
  summary: string;
  changedFiles?: string[];
  verification?: Array<{ command: string; outcome: "passed" | "failed" | "not_run"; outputRef?: string }>;
  evidenceRefs: string[];
  nativeSessionId?: string;
  nextAction?: string;
  exitCode?: number;
  error?: string;
}
```

Raw stdout/stderr and JSONL streams are evidence, not the primary project
decision format.

The runner should not decide project truth from this result. It only decides
whether the native worker process produced a usable worker result. The owner
decides whether that result resolves the original project problem.

## Policy

Modes describe intent, not trust:

| Mode          | Expected behavior                                                                  |
| ------------- | ---------------------------------------------------------------------------------- |
| `investigate` | Read, reason, and produce an evidence-backed report.                               |
| `review`      | Inspect code/design and produce findings; no mutation unless explicitly requested. |
| `patch`       | Change files in a bounded scope and report diff plus verification.                 |

Mutation-heavy work should prefer an isolated worktree when practical. Full
permission modes are acceptable only inside the trusted May container or an
explicitly prepared worktree.

The runner records both requested sandbox and effective sandbox. The current
trusted-container adapter normalizes requests to `danger-full-access` and
records the reason when that differs from the request. Callers must treat the
effective value, not the requested value, as the execution fact.

Worktree isolation is the default answer for parallel patch work:

```text
main repo
  -> worktree A for issue/spec A
  -> worktree B for issue/spec B
  -> worktree C for issue/spec C
```

Each worker receives one worktree, one task, and one expected artifact. The
bounded caller reviews the evidence and the owning App admits any result; the
worker does not own broad repo state.
The runner accepts worktrees inside the project parent, so sibling git
worktrees are supported.

Do not rely only on process exit code. The current runner also rejects missing
output and invalid requested JSON shapes. Richer partial-success interpretation
from native streams remains a follow-up.

## Review Boundary

The runner never mutates the task tree or project plan directly. It emits the
terminal CLI event to the owner and optionally steers the source session with a
compact update. The owner can then:

- accept the result;
- return it to the owning App for review;
- retry with a better prompt;
- create a follow-up task;
- reject the result and keep the original work open.

This keeps code responsible for process lifecycle and agents responsible for
judgment.

## Validation Checklist

A correct implementation should satisfy these checks:

1. `run_cli_agent` returns quickly with `{ taskId, status: "accepted" }`.
2. A persistent worker directory exists before the external CLI starts.
3. `cli.task.requested` is addressed to `runtime:cli-task-runner`.
4. `cli-task-runner` emits `started` and exactly one terminal event.
5. Terminal events are addressed back to `sourceOwner`.
6. Still-live source sessions receive only compact steering text.
7. Full native output is recoverable from artifact paths.
8. Restart recovery marks in-flight tasks `orphaned`.
9. Session ids are stored for explicit resume or `reuseSession`.
10. Patch work can be isolated from the main checkout before mutation.

## Human Surface

Humans should not need to know whether a bounded worker is Codex, Claude, a
terminal, or a subprocess unless they explicitly ask. Natural requests such as
these enter the May App first:

- "ask Codex to review this"
- "get a second opinion"
- "compare Claude and Codex"
- "delegate this investigation"
- "let Claude try a patch"

May's task may converge directly or request the outcome from the accountable
App task. That App may use a bounded awaited worker call as implementation
capacity; it cannot turn `run_cli_agent` into an asynchronous ownership path.

## Open Design Gaps

1. The Codex and Claude stream parsers should classify partial success
   explicitly. Permission, tool, timeout, process, output-schema, and no-output
   failures are classified today.
2. Expected JSON output with required fields is implemented; richer JSON Schema
   validation remains optional follow-up.
3. Direct CLI Task execution creates and finalizes a task-generation worktree
   for Git-backed Apps. Compatibility `run_cli_agent` calls still require an
   explicitly supplied prepared worktree when mutation isolation is needed.
4. UI should show active CLI worker records with native session id, status,
   result path, and events path.
5. Metrics should track request count, completion rate, orphan count, timeout
   rate, average duration, and failed-parser/no-output rate.

Improve the existing adapter in place: add partial-result parsing, UI/read-model
visibility, and worker metrics without introducing another execution path.
