# Native Coding Workers

**Design status:** Accepted.
**Implementation status:** Implemented foundation with the explicit gaps and
acceptance work below.

May can delegate bounded coding work to native coding agents such as Codex CLI
and Claude Code. These tools are not terminal tabs and they are not project
owners. They are worker runtimes behind May's event system.

## Mental Model

```text
human or project owner asks May to delegate coding work
        |
        v
May agent decides whether delegation is useful
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
  returns evidence to the owner for judgment
```

The owner decides whether to accept, retry, ask for review, or create follow-up
work. The worker only reports what it did.

The native worker result is not automatically accepted as truth. It is an input
to the owner. May or the project owner still judges whether the answer is good
enough, whether the patch should be used, and what follow-up event or task is
needed.

The split is intentional:

- The tool call records May's decision to delegate work; `cli.task.requested`
  is the durable lifecycle opener in the existing trace.
- The event is the durable handoff.
- The runner is the runtime owner of the external process.
- The native CLI process is replaceable implementation detail.
- The owner-facing completion is compact; full native output stays in
  artifacts.

May should not block inside a long Codex or Claude process. Once the tool has
accepted the task, May can keep working while the runner tracks the native
worker.

## Why This Exists

External coding agents are useful when May needs a second opinion, a focused
review, or a patch attempt that can run independently. They are bad as hidden
terminal automations because terminals are human surfaces, not durable process
state.

The correct boundary is an adapter:

- May owns task intent, routing, review, and project state.
- The CLI worker owns one native coding-agent process.
- The adapter translates May events into native CLI calls and native streams
  back into May events and artifacts.

This is the same core pattern used by OpenClaw/Hermes-style coding-agent
integration: the framework owns orchestration, while Codex or Claude owns code
execution. The "magic" is small:

- teach the owner when to use the native coding agent;
- launch the native runtime in the right mode;
- remember the native session id;
- parse the native event stream;
- return a durable result for owner review.

The native worker does not become May's planner.

## Current Implementation

The current runtime has two layers:

| Layer | File | Responsibility |
|-------|------|----------------|
| Tool surface | `src/lib/tools/run-cli-agent.ts` | Create task id, write prompt/request files, emit `cli.task.requested`, return immediately. |
| Runtime runner | `src/app/cli-task-runner.ts` | Subscribe to `cli.task.requested`, spawn Codex/Claude, persist task record, parse output, emit terminal events. |
| Event schema | `src/app/event-bus.ts` | Defines `cli.task.requested`, `started`, `completed`, `failed`, and `orphaned`. |
| Restart recovery | `src/app/daemon-events.ts` | Marks in-flight CLI tasks as orphaned after runtime restart. |

Legacy direct tools such as `codex_worker` may remain for manual compatibility,
but they are not the production delegation path because they block the caller
and do not provide durable event state, owner-routed completion, orphan
recovery, or metrics.

Shipped behavior today:

- `run_cli_agent` writes `prompt.md` and `request.json`.
- `cli-task-runner` writes `task.json`, `events.jsonl`, `result.md`, and
  `result.json`, plus `session.json` when the native session id is known.
- Completion is based mostly on process exit code plus a compact summary from
  `result.md`.
- The source May session receives a compact `session.steer.requested` update
  with paths and session id when `sourceSessionId` is available.
- `files` are added to the worker prompt as scoped context.
- `worktree` is used as the native process cwd when provided.
- Relative `files` resolve against `worktree` when present, otherwise `cwd`.
- `structuredResultPath` points at `result.json` in terminal events.

## Runtime Flow

When a user says "ask Codex to review this", the expected flow is:

```text
May calls run_cli_agent({
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

Only a compact completion is injected back into May's session. The full native
stream stays in the task artifacts.

```text
May session receives:
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

Do not paste the full native tool stream into May's conversation by default.
That would pollute May's context and make owner judgment harder. May can read
the artifact files when it needs details.

## Skill-Guided Operation

Hermes packages its Claude/Codex knowledge as skills: when to use print mode,
when to use tmux/PTY, which flags avoid prompts, how to resume, how to monitor
background work, and when to isolate work with git worktrees. That is worth
copying as an operating pattern.

May should use the same split:

- A skill or design guide teaches agents how to decide and packetize native
  coding work.
- Runtime code executes the packet through `run_cli_agent` and `cli.task.*`.

Do not encode every vendor-specific habit in project workflows. Keep workflows
business-focused and let the native-worker guide plus adapter handle CLI
details.

## Event Contract

The current event contract is intentionally small. `cli.task.requested` is the
handoff to the runtime. `cli.task.started` is observability. Exactly one of
`cli.task.completed`, `cli.task.failed`, or `cli.task.orphaned` closes the task.

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

## State Semantics

The CLI task state describes the worker process, not the project outcome.

| Event | Meaning | Owner response |
|-------|---------|----------------|
| `cli.task.started` | The runner accepted the request and spawned the native process. | Usually observe only. |
| `cli.task.completed` | The native worker produced a usable result artifact. | Review the result and decide whether the original work is resolved. |
| `cli.task.failed` | The native worker could not produce a usable result. | Retry, adjust prompt/config, or handle the failure directly. |
| `cli.task.orphaned` | May restarted while the native worker was running, so runtime ownership was lost. | Inspect artifacts/session id, then resume or retry. |

Do not close the original project task just because `cli.task.completed` fired.
Close it only after the owner judges the result.

## Native Session Continuity

Each external runtime has its own session concept:

- Codex emits a thread id from JSONL events.
- Claude emits a session id in stream output.

May stores these as native worker session ids. If `reuseSession` is true, May
can resume the latest native session for that owner and tool. If
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

## Runtime Auth

May should use the same native CLI authentication that works for the daemon
user. Do not silently point Codex at a fresh empty `CODEX_HOME`; that creates a
clean session directory with no auth and the worker fails with 401.

Codex auth rule:

- If `CODEX_HOME` is set, pass it through.
- Else if `MAY_CODEX_HOME` is set, use it for May's Codex workers.
- Else leave `CODEX_HOME` unset and let Codex use its normal authenticated
  home for the daemon user.

Claude auth/base URL rule:

- Pass through `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` when configured.
- Otherwise use the local LiteLLM defaults already used by May's container.

The practical check is simple:

```bash
codex exec --json --skip-git-repo-check --sandbox read-only -o /tmp/codex-smoke.md "Reply with exactly: ok"
```

If that works for the daemon user, May can launch Codex through
`run_cli_agent`. If it fails only when `CODEX_HOME` points at a new directory,
the issue is missing native CLI auth, not the event adapter.

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

| Mode | Expected behavior |
|------|-------------------|
| `investigate` | Read, reason, and produce an evidence-backed report. |
| `review` | Inspect code/design and produce findings; no mutation unless explicitly requested. |
| `patch` | Change files in a bounded scope and report diff plus verification. |

Mutation-heavy work should prefer an isolated worktree when practical. Full
permission modes are acceptable only inside the trusted May container or an
explicitly prepared worktree.

The runner should record both requested sandbox and effective sandbox. If the
runtime must normalize or override a stale request, the task record and events
must explain the effective value and reason. Hidden permission changes make
worker output hard to audit.

Worktree isolation is the default answer for parallel patch work:

```text
main repo
  -> worktree A for issue/spec A
  -> worktree B for issue/spec B
  -> worktree C for issue/spec C
```

Each worker receives one worktree, one task, and one expected artifact. May or
the project owner reviews and merges; the worker does not own broad repo state.
The runner accepts worktrees inside the project parent, so sibling git
worktrees are supported.

Do not rely only on process exit code. Some native tools can emit failure
details in a structured stream even when the process exits successfully. The
runner must inspect the event stream, stderr, final result, and expected
artifacts before declaring the task completed.

## Review Boundary

The runner never mutates the task tree or project plan directly. It emits the
terminal CLI event to the owner and optionally steers the source session with a
compact update. The owner can then:

- accept the result;
- ask May to review it;
- retry with a better prompt;
- create a follow-up task;
- reject the result and keep the original work open.

This keeps code responsible for process lifecycle and agents responsible for
judgment.

## Validation Checklist

A correct implementation should satisfy these checks:

1. `run_cli_agent` returns quickly with `{ taskId, status: "accepted" }`.
2. A durable task directory exists before the external CLI starts.
3. `cli.task.requested` is addressed to `runtime:cli-task-runner`.
4. `cli-task-runner` emits `started` and exactly one terminal event.
5. Terminal events are addressed back to `sourceOwner`.
6. Source chat sessions receive only compact steering text.
7. Full native output is recoverable from artifact paths.
8. Restart recovery marks in-flight tasks `orphaned`.
9. Session ids are stored for explicit resume or `reuseSession`.
10. Patch work can be isolated from the main checkout before mutation.

## Human Surface

Humans should not need to know whether the worker is Codex, Claude, a terminal,
or a subprocess unless they explicitly ask. Natural requests such as these
should route through May's judgment:

- "ask Codex to review this"
- "get a second opinion"
- "compare Claude and Codex"
- "delegate this investigation"
- "let Claude try a patch"

May may still answer directly when the task is small or already clear. External
workers are capacity, not an obligation.

## Open Design Gaps

1. The Codex and Claude stream parsers should classify partial success,
   permission failures, tool failures, and no-output failures explicitly.
2. `run_cli_agent` should support an optional expected output schema.
3. Patch mode should optionally create or require an isolated worktree, not
   only use a provided worktree as cwd.
4. Add a native-coding-worker skill so owners have reusable operational
   guidance without bloating project workflows.
5. UI should show active CLI worker tasks with native session id, status,
   result path, and events path.
6. Metrics should track request count, completion rate, orphan count, timeout
   rate, average duration, and failed-parser/no-output rate.

## Recommended Next Step

Keep the existing `cli.task.*` events. Improve the adapter in place:

1. Strengthen Codex/Claude stream parsing.
2. Add the native-coding-worker skill with operating rules and examples.
3. Add UI/read-model visibility.
4. Retire direct `codex_worker`/`cc_worker` from production guidance once
   `run_cli_agent` covers the same convenience.
