# Native Coding Workers

**Design status:** One Task owns each durable outcome; native workers supply
bounded execution or evidence.
**Implementation status:** Bounded `run_cli_agent` calls and the `codex-goal`
Task executor are implemented with exact Task binding, retained evidence and
shared execution limits. Caller-driven native resume is distinct from durable
Task recovery. Installation must align Host, SDK and native CLI versions;
source presence does not establish the active release.

## The simple model

There are two uses, not two work queues:

| Need | Mechanism |
| --- | --- |
| A second opinion, focused investigation, or patch during this attempt | Await `run_cli_agent`, then review its returned evidence. |
| Work that must continue across attempts or restarts | Use an ordinary App Task; it may select the `codex-goal` executor. |

An App owns the outcome and acceptance. The Host owns execution, limits,
cancellation, and recovery. Native sessions and artifacts are evidence, not
another owner or durable promise.

```text
App Task -> bounded caller attempt -> await run_cli_agent
                                   -> native CLI -> terminal result + artifacts
                                   -> caller judges evidence
         <- normal fenced Task result
```

A direct conversational session can also make a bounded call. If the work
needs durable follow-through, admit it to the responsible App's Task first.
A worker is not permission to act beyond the caller's authorized scope.

## Bounded tool contract

`run_cli_agent` runs Codex CLI or Claude Code without an interactive terminal.
The tool waits for the native process and process-group cleanup. It returns
`completed` or `failed`, never `accepted`. There is no worker queue,
`request.json`, `task.json`, auto-resume scheduler, completion steering, or
CLI-terminal Condition to wait on.

Inputs describe the tool, prompt, optional mode (`investigate`, `review`,
`patch`), working directory, files, deadline, prepared worktree, optional
expected JSON fields, and an explicit native session ID when continuing work.

- The default deadline is ten minutes. Choose a smaller packet when that is
  too long for the caller's remaining budget. Caller cancellation wins over
  a nominally successful native exit.
- Success requires zero exit, a successful native terminal protocol, usable
  output, and the requested JSON-object/own-field contract. This proves a
  usable worker result, not that the App's outcome is achieved.
- `worktreePolicy: "require"` rejects patch mode without a supplied worktree.
  The caller prepares and verifies the worktree; the tool does not create,
  merge, or clean branches.
- Working directories stay inside the project root; worktrees may be under
  its parent to allow siblings. Relative files resolve against the worktree
  or working directory. Explicit caller-agent context may also be attached.
  Real-path checks reject symlink escapes. These are input-scope checks, not
  an OS security sandbox or proof of Git worktree registration.
- Modes express intent, not permissions. The existing trusted-container
  commands use full native permissions. A requested narrower sandbox is
  normalized and reported through `effectiveSandbox` and
  `sandboxFallbackReason`; do not claim read-only isolation.

The result includes a compact summary, failure category when relevant,
artifact paths, exit code when available, and `nativeSessionId` when observed.
`taskId` is retained only as the historical CLI correlation key. It is **not**
an App Task ID or an execution-resource ID.

Failure categories are `timeout`, `cancelled`, `permission`, `tool`,
`no_output`, `output_schema`, and `process`. Diagnostics help choose the next
step; they do not grant permission to retry indefinitely. Inspect the failure
and change the failed assumption before another call.

## Evidence and continuity

Each call writes:

```text
.state/cli-runs/<cli-id>/
  prompt.md    supplied packet
  result.md    native answer, including useful partial output
  result.json terminal tool result
  events.jsonl raw native stdout/stderr capture
```

The events file includes diagnostic text and is not guaranteed to be pure
JSONL. Protocol parsing retains bounded diagnostics, skips oversized lines,
and limits result reads to 1 MiB. Full native output remains on disk; artifact
disk usage is not capped by the in-memory limit.

The historical `cli.task.requested`, `started`, `completed`, and `failed`
events remain trace observations. They do not launch work or steer a session.
Emitting `cli.task.requested` is no longer an execution API. Old cancellation
events cannot cancel new calls; cancel the actual caller/Task instead.

Use the tool's terminal return and named artifact paths. Do not poll worker
records, manufacture a `cli-task-terminal` Condition, or look up its CLI
correlation key as a Task/execution resource. If the Host stops mid-call, a
terminal artifact/event may be missing; the caller's normal recovery owns the
unfinished attempt.

If terminal event recording fails after execution, the returned result keeps
the actual worker outcome and evidence, plus `observationError`. Do not repeat
an executed patch merely to repair its observation.

Start a fresh native context for an independent opinion. Pass
`resumeSessionId` only to continue an exact known native thread.
Implicit shared `reuseSession: true` is rejected without an explicit ID.
The tool neither reads nor writes an owner-wide latest-session map.
The model-facing schema exposes exact `resumeSessionId` only. The internal
compatibility runner rejects retained implicit-reuse calls without an exact ID.

Native process groups are recorded against the exact caller session using
the same tracking and drain code as shell commands. Cancellation and timeout
drain that group before returning; a group that cannot be drained remains
recorded for normal session recovery. Process-group cleanup is not a security
boundary against a process deliberately escaping its group. Output-pipe
settlement is separately bounded so escaped descendants cannot hang the call.

## Persistent Codex Tasks

The existing `codex-goal` adapter is the persistent native Task executor.
The removed one-shot `codex`/`claude` Task adapters are not current built-ins;
the tool names above do not imply named Task executors.

Runtime creates one fenced `TaskAttempt`. Codex receives its transport
projection, and returned results go through normal Task admission.
Malformed output or admission rejection is corrected on the same native
thread within that attempt. Native process failure ends the attempt;
ordinary Runtime retry resumes the same Task's persisted thread.

Validate the installed CLI when installing, upgrading, or changing its execution
environment. Use the actual runtime user and installed permission profile to run
a real command and read a synthetic file. The Host's existing
`check:codex-goal-protocol` script verifies native restart and fresh outgoing
context with a local scripted provider; its `check:codex-goal-execution` entry
omits a sandbox override so installation configuration owns the command policy
and fails on any denial. Task start and resume follow that same installed policy;
an explicit caller sandbox remains supported. The App still owns authorized
intent and acceptance, so available executor permissions do not authorize extra
work. These checks belong to installation verification, not every Task attempt.
This separation is implemented in the PR #284 candidate; it does not establish
that the deployed executor is usable.

Later failures still use normal bounded execution, retained attempt evidence,
caller feedback and independent operational review. A failed tool command may
be useful evidence for the agent rather than a failed Task. Installation checks
do not replace those paths or authorize widening the executor's permissions.

Usage or budget exhaustion is an execution failure, not a Task wait.
Do not invent a timer Condition or claim elapsed time proves provider capacity.
Runtime's bounded recovery remains responsible for retrying the Task.

## Models and implementation

Codex defaults to `gpt-5.6-sol` with high reasoning; `CODEX_MODEL` and
`CODEX_REASONING_EFFORT` override those values. Claude defaults to
`claude-opus-5`; `CLAUDE_MODEL` overrides it. Commands use the existing shared
model endpoint configuration. Codex configuration precedence is `CODEX_HOME`,
then `MAY_CODEX_HOME`, otherwise its normal home. Claude receives the shared
endpoint through its standard Anthropic environment variables.

| Host code | Responsibility |
| --- | --- |
| `src/lib/tools/run-cli-agent.ts` | Tool schema; capture caller identity, trace, and signal; await result. |
| `src/lib/cli-agent.ts` | Native command, bounded parsing, evidence, process execution, legacy upgrade check. |
| `src/lib/tools/bash.ts` and `persistence.ts` | Shared caller-session process-group tracking and cleanup. |
| `src/app/adapters/executors/codex/codex-goal-executor.ts` | Existing persistent Codex Task adapter. |

The `native-coding-worker` skill teaches packet preparation and evidence
review. Host code enforces mechanics; it does not decide whether another
opinion is useful or whether a patch should merge.

## Upgrade and verification

Before changing the running Host:

1. Drain or cancel old CLI work with the old Host. The new Host refuses startup
   if `.state/cli-tasks` has unfinished, orphaned, or unreadable admissions.
   The old runner could mark a job orphaned without stopping its process.
   Review those artifacts and confirm their work and processes have settled
   before archiving the reviewed directories outside `cli-tasks`. The new
   Host neither guesses their outcome nor changes their evidence.
2. Integrate this App guidance and the matching Host revision together. Keep
   current user edits when applying the companion skill change. Retained
   historical records/session maps need not be deleted.
3. Apply through the authorized installation deployment procedure. A merge is
   not deployment authority.

Portable verification covers both native protocols, exact concurrent caller
identity, cancellation and descendant drain, timeout despite zero exit,
bounded output, JSON validation, explicit continuation, path scope, event
observation, and the read-only upgrade fence. Tests use local subprocess
fixtures, never model credentials. Image smoke and portable tests do not
certify a live provider or an installed App's complete behavior.

The companion Gym correction consumes `ExecutionResult.cliCalls`: compact
Host-recorded tool results bound to the calling session and tool-call ID. It
does not query `read.execution` with a CLI ID or derive observations from the
agent's reflection. It compares the reflection to observed outcomes and named
paths, counts each CLI ID once, and retains failures as well as successful
retries. Expected failures (for example timeout practice) remain assessable;
unexpected runtime failures, interrupted callers, and missing evidence mark
the attempt invalid, not an agent behavior failure. Invalid attempts do not
automatically repeat live practice.

This projection uses at most 64 records from the retained session transcript
tail, including replay. Missing records, old Hosts, and pre-upgrade transcripts
cannot prove that a CLI never ran. Artifact paths identify what the tool
produced; they do not prove the agent read it, its current availability, the
quality of its reasoning, or independent native contexts. Those remain limits
of the deterministic practice check, not passing semantic-quality claims.
Portable tests exercise local native subprocess fixtures and the Gym adapter;
they do not certify live Gym practice or authorize deployment.

For second opinions: use a neutral packet, avoid sharing another worker's
conclusion, and settle disagreements with primary evidence. More opinions
are useful only when they improve the owner's decision.
