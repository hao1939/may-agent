# One execution feedback model

**Design status:** Refined September 13, 2026. The user prioritizes one simple
mental model and explicitly defers review during execution. Keep the shared
contract; implement only demonstrated gaps. Deferred capabilities are not
prerequisites for alignment or an automatic implementation backlog.
**Implementation status:** The two immediate repairs are implemented on the Host
`fix/execution-feedback` branch: `014804da` forwards native activity and
`8e744a18` reports worker execution, based on v3.0.1. Isolated CLI subprocesses
and Task workers exercise the production paths. The local installation has not
been changed by this experiment. Concurrent review and automatic fallback remain
deferred.

Source reviewed: Host v3.0.1 `6935b325` and release-derived candidate `db5e548c`,
whose affected execution/routing files agree; App source `3ca8696a90`.
Existing working design drafts supplied context, not release evidence.

## The common model

Code executes work, records facts and makes the relevant feedback available
to its owner. The owning agent judges the next action when it can handle that
feedback. Code executes the decision. Starting work establishes its feedback
path by convention; the agent does not separately register a watch or poll.

    agent chooses an action
      -> code executes and records evidence
      -> result or relevant change reaches the owner
      -> agent judges the next action

The same responsibilities apply to a tool result, a background Task result,
a PR update and a periodic check. They do not need identical transport or
timing. An awaited tool returns directly. Asynchronous facts use existing
Events and exact Task admission. A periodic source read supplies facts through
that same route. Do not wrap every tool result in a second notification.

This refines [execution feedback and wakes](../2a-design/events.md#execution-feedback-and-agent-wakes)
and the [code/agent boundary](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).
It introduces no new service, Task lifecycle, public handler category or
requirement for continuous supervision.

## Ownership, evidence and delivery

Use the existing trusted App, Task, attempt, session and operation identities.
The App owns meaning; the Task owns durable work; a session is its execution.
The CLI result's historical `taskId` is a call correlation key, not an App Task.
An executor supplies available ownership automatically. External resource
adapters use documented ownership conventions as part of their normal support.
An uninstrumented external action cannot promise automatic discovery.

An observation identifies its source, time, relevant revision, bounded facts
and evidence references. Large logs stay with the execution. Source text cannot
grant permissions or choose a privileged recipient. Worker activity, a successful
status probe, lease renewal and progress toward the goal remain different facts.

| Feedback | Normal handling |
| --- | --- |
| Ordinary worker output | Record evidence and refresh status; no model invocation per line |
| Awaited tool result | Return it to its caller for judgment |
| Background result or relevant resource change | Preserve it through the owning App's existing exact Task/input route |
| Existing wait/recovery checkpoint is due | Recheck current facts and let normal Task handling reconsider the wait |
| Owner is busy | Keep feedback pending; do not start a competing Task attempt |
| Session disappeared | Use existing execution recovery for the same work |
| Delivery cannot be accepted | Preserve the failure and original ownership; expose the problem rather than claiming delivery |

Recording an event, accepting responsibility, handling it and completing the
work are distinct facts in existing records. They are not a new notification
state machine. Status and human interfaces read the same accepted evidence;
human updates emphasize useful results, decisions and attention needs.

## Periodic checks provide another delivery opportunity

Reuse existing observer scans, pending admission recovery and Task/Condition
checkpoints. A source reread can find a change whose notification was lost.
Pending-input recovery can find feedback that was saved but not handled.
Replaying the event journal alone cannot recover an unrecorded source change.

Repeated hints may coalesce without losing distinct results or accepted human
input. Handling older feedback must leave newer evidence available. Before an
action, read current authority and validate the exact execution/resource target.
Late observations must not reopen cancelled work or control its replacement.
Ambiguous external effects require source inspection or provider idempotency
before retrying. A successful probe does not prove the external operation passed.

After restart, an extra observation or ordinary agent turn is acceptable.
There is no promise to reconstruct intermediate changes no longer retained by
the source. Checks should page through unfinished work and relevant known
resources, without scanning all historical logs or invoking a model each tick.

These are common recovery rules, not a requirement to add a global scan or
periodic LLM review of every running helper. Where a concrete adapter has a
missing feedback path, fix that path and prove its recovery.

## Unavailable owners: preserve the simple extension point

The intended fallback remains one explicit installation route: the owning App
receives normal feedback; May can receive a delivery-problem report when that
App cannot accept it. This is a direction for a demonstrated need, not a new
fallback feature required by the current progress/status repairs.

Today exact-target admission rejects missing owners and preserves its failure
evidence. Do not describe automatic delivery to May as implemented. Until that
route is added and tested, existing diagnostics and operator handling apply.

If needed, add only a Host-authored delivery-problem observation and normal
May input mapping in installation composition. Preserve the original owner,
event and failure reason. Do not rewrite frozen admission, resend the original
action to May, or create a hierarchy of fallback handlers. Missing Task reports
belong to the same App; missing sessions and busy owners use normal recovery.
If May is unavailable, retain visible attention without recursive reporting.

This would be a narrow extension to [Events](../2a-design/events.md) and
[exact-caller feedback](caller-feedback-and-waiting.md). Malformed public input
and unknown event types still fail. The owed answer stays linked to its caller.
A delivery problem grants no authority to enable Apps, transfer ownership or
revive cancelled work. Generic Host code does not hardcode a privileged May agent.

## Immediate gaps and system impact

Keep the immediate implementation scope to two independently useful repairs:

| Gap in v3.0.1 | Smallest repair | Impact |
| --- | --- | --- |
| Native CLI output is captured but never forwarded as parent tool progress | Connect the existing JSONL collector to `run_cli_agent`'s `onUpdate`; persist `tool_execution_update` activity in `manager.bridgeEvents` without increasing tool-call counts | Correct observation using existing callbacks and storage; no new model calls |
| Socket status reads only the daemon's in-memory sessions | Compose the Host-wide read from shared current Session/Task execution authority; reuse it for maintenance, including workflows without agent sessions | Truthful status across worker processes; no new worker registry or agent judgment |

These paths are in `src/lib/cli-agent.ts`, `src/lib/tools/run-cli-agent.ts`,
`src/lib/manager.ts`, `src/app/app-runtime.ts` and `src/app/modes/maintenance.ts`.
Read failures must remain unknown, not appear idle. Current process/attempt
ownership must distinguish active execution from stale rows.

The retained investigation recorded 19 five-minute interruptions of one Task,
including CLI output shortly before cancellation. An earlier subprocess
reproduction produced 39 child-command events and zero parent updates. Saved
status reads also omitted running Task workers. These historical observations
justify the repairs; they are not new tests of this document or evidence that
every long-running operation will then succeed.

Existing publication-aware observer snapshots are already implemented in the
reviewed Host. Reuse them. Scout adoption and provider discovery remain scoped
in the [observer proposal](observer-feedback-and-resource-conventions.md); neither
is a prerequisite for fixing CLI progress or status. No bulk data migration,
new SDK review schema or notification store is needed for these two repairs.

## What we explicitly defer

Review during an awaited helper, live steering, nested review sessions, review
checkpoints, automatic May fallback and a separate `eventwatchd` are deferred.
Do not add empty interfaces, state fields or configuration to reserve them.
An actual consumer should establish their value and required execution boundary.

The current managed-agent adapter forwards events through `manager.send()`,
which queues steering. While the agent awaits `run_cli_agent`, an immediate
model decision is not guaranteed. The native wrapper ignores stdin. Feedback
can wait until the normal execution boundary; this is an accepted limitation,
not a reason to claim the common feedback model is misaligned.

If later evidence justifies intervention during execution, keep the same
ownership and feedback contract. Evaluate its ability to act while the call is
pending, model capacity, cancellation races and steering cost then. The earlier
expanded trial remains in Git history; it is no longer the required next stage.

Timeout policy is also separate from notification delivery. The reviewed code
has a five-minute silence deadline, a ten-minute default CLI timeout and a
fifteen-minute managed-agent execution budget. Attempt leases are separate and
renew mechanically. The immediate repairs retain these bounds and cancellation.
Forwarding actual progress can prevent false silence for active output, but a
legitimately quiet operation can still expire. Do not claim that problem solved.
Any later relaxation needs its own evidence and must preserve ownership and
cleanup. A runtime limit is not an LLM judgment that the goal should be abandoned;
the same Task retains responsibility through existing recovery.

## Value, cost and completion criteria

The immediate value is reliable evidence and understandable status, with no
additional review model calls. The common model reduces special cases in how
we explain and extend the system. It does not require moving all related code
into one component or implementing every possible notification source.

Implementation cost is limited to existing callback/storage and status-reader
boundaries, plus meaningful integration checks. Measure write frequency and
status latency under concurrent work; throttle progress without inventing it.
Observer polling and ordinary recovery already have costs, so broad scans and
per-event model turns should not be introduced merely for uniformity.

Complete the immediate repairs when:

- A real fixture CLI reports meaningful progress through the actual tool and
  manager connection, updates stored activity, and completes beyond a shortened
  silence interval. Cancellation, explicit deadlines and process drain still work.
- Real Task workers appear in public status during execution and disappear on
  completion/recovery; workflows without agent sessions still count as work.
  Unavailable reads do not report idle, and command latency stays acceptable.
- Existing exact Task/caller links, pending input, disabled Apps, cancellation
  and normal result delivery are preserved. No competing worker or duplicate
  notification is introduced for an already returned tool result.

When an external feedback adapter is changed, test lost/repeated notifications
and recovery through its real admission path. That is the adapter's acceptance
gate, not a mandatory expansion of this slice. No nested-review experiment,
new fallback route or model-backed trial is required to complete the two repairs.
The design is aligned when each implemented path follows the common contract
and states its limitations; complete source coverage is a separate product choice.

## Implementation and PoC findings

The implementation keeps the existing paths and adds one shared execution read:

- The native JSONL collector recognizes completed commands/tool results and
  relevant turn/item boundaries. `run_cli_agent` forwards a bounded update through
  its existing tool callback. The manager refreshes stored activity without
  incrementing the parent tool-call count. Raw logs, reasoning and token deltas
  do not count. Updates occur at most once per second, only when a recognized
  native event arrives; there is no timer that invents activity.
- Public socket status reads current sessions from SQLite and verifies their
  existing process markers. Task-bound sessions must match the current attempt
  and generation. Historical session directories are not scanned.
- The same read also checks current, running, unexpired Task claims. This covers
  workflows with no agent session. Socket status adds `activeWork` separately
  from its existing `activeAgents` list; an idle or synthetic ready chat is not
  active work. Maintenance uses this field, or the same shared read when the
  socket is unavailable. Existing array-returning socket callbacks still work.
- Database read failures produce an unavailable-status error. The maintenance
  probe records a failed observation without treating it as idle or leaking an
  unhandled rejection. A failure-path test caught and corrected the socket error
  field: clients read `message`, not `error`.

The real subprocess fixture runs for 3.4 seconds against a two-second silence
deadline. Both Codex and Claude protocol fixtures complete with three to four
forwarded updates, stored activity spanning more than two seconds, one parent
tool operation and one final result. The scripted agent makes exactly two model
steps: requesting the tool and consuming its result. No network model is used.
The token-only fixture still expires. A separate case keeps emitting recognized
activity and still reaches the explicit CLI deadline; progress is not an
extension of that budget. Existing cancellation/process-drain tests remain the
owner of process cleanup behavior.

A real Conversation Task worker is checked while its local fixture provider is
handling a request. The public socket reports exactly that child session and
maintenance reports active work. Completion removes it from status. A later
turn after reopening storage passes the same checks without duplicating the
Task. Two measured status requests took approximately 5.2 ms and 1.2 ms; these
small-fixture observations are not a production load benchmark.

A real workflow worker with no agent session reports active work until exact
cancellation. Parent-loss recovery clears its active claim. Additional reader
tests cover multiple current sessions, terminal and ended sessions, dead or
missing markers, stale generations/attempts, expired leases and unavailable
storage. The existing worker tests also verify exact feedback delivery and
cancellation without duplicate Events.

The useful distinction is now explicit: **activity**, **current execution** and
**goal progress** are different facts. A live process may be stuck, and a fresh
workflow claim can briefly remain after a crash until ordinary recovery or
lease expiry. Status reports/protects that claim; it cannot prove the workflow
process is alive. This accepted limit avoids another process registry. The
five-minute silence policy can still interrupt a legitimately quiet command.

No schema migration, App change, observer rewrite, new daemon or review model
call is needed. Keep direct tool returns direct and use Events for asynchronous
feedback. Revisit timeout policy or concurrent review only when their concrete
value justifies a separate change.

## Reproduction and validation scope

From the Host checkout:

```sh
bun test src/lib/cli-progress.test.ts src/lib/cli-agent.test.ts src/lib/session-observation-timeout.test.ts
bun test src/app/adapters/reporting/execution-status.test.ts packages/control/src/control-socket.test.ts src/app/modes/maintenance.test.ts src/app/task-worker-integration.test.ts
bun test/integration/fixtures/task-interaction-scenario.ts conversation
bun run ci
```

The first two commands exercise the owning contracts. The third prints timing
samples through the public socket while actual worker processes run. The final
command is the full Host gate, including browser checks. These portable fixtures
use temporary state and a deterministic local provider; they do not require
credentials or an existing installation. They prove the repaired execution
boundaries, not live provider behavior or long-running production stability.

At Host `8e744a18`, `bun run ci` passed: 2,993 tests, zero failures and 13,252
assertions in 150.78 seconds for the test phase. The three existing skips cover
installation-specific agent catalog checks; browser tests executed and passed.
Host/SDK type checks, the canonical App-boundary check and lint error gate passed.
No image build, release, deployment or external provider experiment was run.

`bun run check:may-design` passed against that Host source. These checks cover
design integrity, proposal links, SDK/control
examples, seeded Task admission/replay, Condition/dependency result admission
and canonical App integrity. Historical live investigation evidence was
reviewed, not rerun. Existing unrelated design drafts remain untouched.
