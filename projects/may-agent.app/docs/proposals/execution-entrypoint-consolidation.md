# Consolidate execution entry points

**Supports:** [Agent Cooperation](../2a-design/agents.md). Converges bounded execution paths so callers receive the same scope, limits and results.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#context-is-discovered-not-dumped); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Implemented and submitted as [Host PR #186](https://github.com/hao1939/may-agent/pull/186),
September 14, 2026. Paired App/design source is merged locally; Host merge and deployment remain separate.
The [consolidation PoC record](../archive/reviews/execution-consolidation-poc-20260914.md)
owns exact revisions, validation results and remaining limits. Original source
review: Host `b478bc5cf1a8ff8f93583d7ed8bf9a17b3f0815d` and App/design `56c9179442`. This follows the
[execution-feedback PoC](../archive/reviews/execution-feedback-poc-20260913.md).
The earlier PoC did not verify all callers; this candidate extends their scopes
and tests. PR #186 starts from current Host main `6935b325`; it includes the ten
remaining execution-feedback commits, without already merged prerequisites.

## Candidate outcome

The shared `ExecutionScope` owns one invocation's timer and abort signal. It
adds no storage, task state, observer loop or automatic review. Manager, direct
execution and workflow steps use it; provider adapters retain protocol and
process cleanup. Agents still call tools directly and receive their results.

| Gap | Candidate change |
| --- | --- |
| G1 | Remove the silence watchdog and its Task-identity exception. Quiet and active work use their admitted fixed allowance. |
| G2 | Resolve the generic tool's live caller at invocation; inherit its Task binding, workspace, restriction, cancellation and deadline. Reject a missing caller. |
| G3 | One-shot waits for the exact terminal result, returns its text/output/error and derives exit status from it. |
| G4 | Share invocation bounds across manager and direct execution. Join child cleanup before returning; repeated cancellation cannot make draining work appear idle. |
| G5 | Clamp workflow steps to the remaining allowance and join cancelled helpers, nested workflows and corrective steps before settlement. Fence late calls through the existing signal. |
| G6 | Remove error-count stopping, automatic standalone resume and their escalation wiring. Keep Task recovery, explicit permitted resume and stale-process cleanup. |
| G7 | Update owning docs and May/Bob dispatch guidance; keep historical evidence as historical evidence. |

Two review findings refined the implementation: old chat-turn cleanup could
close a new turn, and child receipt failure could leave its chat parent looking
running. Cleanup now uses the exact scope; chat terminal handling reports helper
cleanup failure. The old turn clears its trace links before publishing idle.

The supported model-facing `fork` action remains for scoped concurrency, with a
portable test exercising that action under a live caller. It shares the manager
scope and returns existing session evidence; it does not emit a second dispatch
message or revive itself after restart. No executable App workflow found in the
consumer inventory requires detached forks. Guidance that requested detached
dispatch now requests durable Tasks. Keeping the generic action preserves its
useful capability without keeping an independent background-work lifecycle.

**Behavior changes to review:** an omitted execution limit now resolves to
30 minutes, matching the existing Task workflow default. Configured shorter or
longer positive limits remain effective, subject to the caller deadline. The
one-shot CLI keeps its five-minute default; timeout now returns an exact error
receipt instead of a separately manufactured `timeout` response. Invalid or
overflowing effective limits are rejected; invalid CLI minute flags use its
existing default. Idle direct-chat time consumes no active-turn allowance.

Publish the paired Host and guidance changes through normal review. No stored
Task identities or historical session records need rewriting. Before rollout,
inventory installation-specific direct/fork consumers and effective timeout
configuration; an external caller depending on detached sessions must use the
normal Task route. Test a live provider separately after source review.

## Problem and useful outcome

The same quiet helper can receive different treatment depending on how it was
started. The Task route can use a fixed execution allowance while another route
also cancels for silence. Generic agent calls carry less execution context than
workflow calls. One-shot CLI execution has its own timer and reconstructs the
result from session status. Detached sessions can acquire separate resume rules.

These are incomplete consolidation, not distinct kinds of work that users or
agents should learn. The target is simple:

> Agents use capabilities to do work. Tasks preserve responsibility for
> unfinished outcomes. Execution code runs capabilities and reports what happened.

Success means quiet useful work can finish within its allowance, cancellation
reaches the exact owned execution, and every supported caller receives an honest
result. Required background work keeps an existing Task owner. No new work
registry, notification daemon, mandatory reviewer or polling agent is needed.

The [execution boundary](../2a-design/system-boundary.md#execution) owns the
contract; [agent cooperation](../2a-design/agents.md) and
[sessions](../2a-design/sessions.md) describe its interfaces and evidence.
Running and waiting remain independent facts. Consolidation does not make every
tool call a Task or make every direct response an Event.

## Decisions and feature preservation

| Entry or capability | Keep | Consolidate or remove |
| --- | --- | --- |
| User invokes an unrelated CLI in a terminal | Native CLI behavior; user is the caller | No May discovery, registration, supervision or recovery of arbitrary processes |
| May direct/one-shot execution or a local evaluation | One local bounded invocation, output, transcript where supported, exit/result status | Reuse execution limits and results; no Task, daemon or database required just to run a model |
| CLI submits durable App work | Normal validated App input and Task identity | No CLI-owned background job or alternate App-agent launch route |
| Agent invokes a CLI tool | Direct tool response; adapter-owned process handling | Inherit caller cancellation and remaining allowance; keep provider protocol outside core |
| `ctx.agents.call` and model-facing `agents.call` | Bounded helper calls, structured results, permitted context and workflow parallelism | Thin scoped wrappers over shared execution rules, without independent recovery |
| `agents.fork` | Supported model-tool concurrency within its live caller | Remove detached responsibility; durable consumers use Tasks and unfinished helpers stop with their caller |
| Persistent direct chat | Reusable conversation context and idle terminal | Bound active work, not the lifetime of an idle chat; do not treat silence as a reason to intervene |

Keep the existing call names for now. Removing `ctx.agents.call` would break
Scout exploration and maintenance, Evaluation workflows, and Gym helpers.
An agent-backed ordinary tool could replace the generic model-facing action,
but that requires migrating discovery, permissions, context and results. A rename
alone provides no execution simplification. Do not add per-agent tools solely
to make the generic action disappear.

A direct invocation may leave diagnostic artifacts without acquiring a durable
work obligation. A caller requesting work that must survive its execution uses
the existing Task route. A supported external operation, such as a pipeline,
keeps its provider identity and the caller Task's result link; it need not become
a child Task. These promises belong to capabilities, not agent-authored timeout
or event registration instructions.

## Source findings and their limits

Runtime paths below are relative to the reviewed Host; `2a-design/` paths are
relative to this documentation tree at the reviewed App/design revision.
These are the original source findings. The candidate changes and portable
reproductions are recorded above and in the linked PoC evidence; the original
review itself reproduced no production failure or timing benchmark.

| Gap | Evidence | Proposed treatment |
| --- | --- | --- |
| G1: watchdog policy depends on entry identity | `src/lib/manager.ts`, `withObservationDeadline`, skips silence cancellation only for `taskBinding` plus finite positive `admittedTimeoutMs` | Prove finite execution and cleanup for supported entries, then remove silence cancellation. Some remaining sessions already have configured limits; calling them all unbounded is inaccurate. |
| G2: generic calls omit execution context | `src/lib/manager-agents-tool.ts`, call/fork dispatch, forwards parent/workflow/project/trace but not Task binding, caller abort signal or remaining allowance; `manager.createAgentsTool` adds control validation only | Resolve trusted live caller context at invocation and pass it through the existing execution options. An agent name or lineage label alone is not ownership. |
| G3: one-shot duplicates timeout and completion | `src/app/modes/oneshot.ts`, `runOneshotMode`, installs a timer, calls `waitForIdle`, then queries `status()`; an absent session is reported as success | Await the exact returned execution result, preserve output/error and set exit status from it. Keep CLI parsing and rendering outside the runner. Test failures after the manager removes a finished session. |
| G4: execution bounds and settlement have several owners | `src/lib/agent-execution.ts`, `executePreparedAgent`, has an optional timeout and no caller signal option; `src/lib/manager.ts` separately wraps prompt/recovery/completion. `src/app/direct-agent.ts` calls the direct runner. | Share the necessary deadline, cancellation and settlement mechanics within the existing execution modules. Keep persistence and Task admission outside the model loop. Check actual direct callers before claiming they lack limits. |
| G5: workflow scope is not the same as a step's admitted bound | `src/lib/workflow-tool.ts` supplies Task binding, outer abort/timer and active-step cancellation; individual dispatch uses optional `stepOpts.timeoutMs`, and replay waits have another timer | Preserve the outer scope; clamp nested work to its remaining allowance, including replay and corrective steps. Verify nested cancellation before removing redundant timers. |
| G6: session recovery can own a second continuation policy | `src/lib/session-subscribers.ts`, `createAutoResume`, resumes interrupted non-call work with operations; `createStuckDetector` cancels after error-only turns. Wiring is in `src/app/daemon-events.ts`; startup resume is selected in `src/app/composition/background-startup.ts` and `manager.resumeStaleSessions`. | Migrate durable consumers and remove heuristic cancellation/automatic standalone continuation. Keep stale-state cleanup, Task recovery, explicit permitted user resume and diagnostic evidence. |
| G7: current docs describe exceptions as the contract | `2a-design/sessions.md` describes a general five-minute silence deadline and independent job recovery; the earlier PoC calls remaining entries unbounded | Correct the contract and retain the exact candidate limitation. “Legacy” is a temporary migration inventory, not a supported alternative policy. |

The current Task worker relay does not supply the error-only detector's
`turn_end` inputs. G6 identifies retained policy and reachable wiring, not a
newly observed Task cancellation; verify actual consumers before migrating it.

Existing implementations to reuse:

- `src/lib/agent-runner.ts`: provider/model loop without Task, EventBus or storage.
- `src/app/adapters/executors/managed-agent.ts` and `src/app/conversations/turn-agent.ts`:
  exact Task execution binding, finite configured allowance and existing results.
- `src/lib/cli-agent.ts` and `src/lib/tools/run-cli-agent.ts`: validated finite
  CLI timeout, caller signal, bounded progress and process cleanup. Verify scope
  inheritance; do not rewrite these into core or remove their provider limits.
- `src/app/adapters/executors/codex/codex-goal-executor.ts`: candidate fixed native
  invocation deadline across startup, turns and result correction, with client cleanup.
- `src/app/adapters/executors/session-control.ts`: exact public control checks.
  Task-bound sessions remain controlled through their owner; helper exceptions
  require trusted live ancestry and matching scope.

## Shared execution rules

1. At invocation, capture the exact live caller, allowed tools/workspace, Task
   binding when present, abort signal and applicable limit. Use existing context
   and options; do not add a persisted execution-owner registry. A standalone
   caller needs no fabricated Task binding. Child tools and workspace follow the
   selected role within the caller's granted authority, not an unrestricted copy
   of another agent's definition. Late helper creation after caller cancellation
   is rejected before effects start.
2. Establish one finite execution allowance from trusted configuration or the
   existing bounded default. A shorter child/provider limit may apply; no child
   can outlive its caller scope. Pass the remaining allowance or existing deadline,
   not the parent's original duration. Resolve omitted limits from caller/config
   defaults; reject invalid or overflowing effective limits at admission.
   Document any changed effective defaults; do not silently shorten
   long-running callers to the former five-minute silence threshold.
3. Tool activity, provider retries and output-schema correction do not renew the
   invocation allowance. An explicit later Task attempt or human invocation has
   its own admission. There is no lifetime timeout for a months-long Task.
4. Completion, cancellation and expiry settle the exact invocation once through
   existing result/receipt paths. Preserve accepted results and partial evidence;
   reject stale effects. Cancellation acceptance is not proof of process exit.
   Do not infer success from an absent session or turn cleanup failure into success.
5. A promise timeout cannot stop abandoned work. Propagate abort, drain owned
   processes/clients using their existing bounded cleanup, and release capacity
   only when the owning runtime can safely do so. In-process code must cooperate;
   use existing worker isolation for an unresponsive supported execution. If
   cleanup cannot be confirmed, expose the failure and require intervention through
   existing controls rather than start an overlapping replacement.
6. Required helpers are joined or stopped before their caller completes. Caller
   expiry/cancellation ends those helpers; an independent Task or provider operation
   follows its own declared cancellation contract. Cancelling a local API request
   does not prove that a remote operation was cancelled.
7. Return direct results directly. For async work, preserve the accepted Task/input
   or supported provider reference and use the existing notification and periodic
   recovery route. Missing owners produce visible unresolved feedback, not a guessed
   replacement owner. Automatic supervisor review remains deferred.
8. Silence and repeated tool errors remain observations. Remove automatic nudges,
   cancellation and independent session revival based on those observations.
   Keep explicit user/owner controls, provider/protocol limits, schema validation,
   bounded mechanical repair and daemon liveness recovery. These do not judge
   whether the assignment is worthwhile.

Shared rules do not require one giant executor. Core admits/fences Task attempts
and stores accepted outcomes. Execution helpers and provider adapters implement
the rules; composition supplies trusted context. CLI rendering, provider parsing,
process groups and tool catalogs remain outside core. A small common helper is
appropriate only where it deletes demonstrated duplicate behavior.

## Implementation order and review boundaries

**First: scoped helper execution (G2, G4, G5).** Inventory production entry points
and separately maintained consumers, including direct evaluation, active chat turns,
workflow replay, generic calls and nested helpers. Record their owner, effective limit, cancellation,
result route and required continuation. Add only the missing context propagation
and common execution mechanics. Retain `ctx.agents.call` and its result schema.
Do not bundle unrelated provider, permission or storage redesigns.

**Second: direct CLI completion (G3).** Make one-shot mode a thin invocation/result
wrapper. Preserve supported flags, output format and effective limits while returning
the actual result and error. If moving it to the direct runner would change available
tools or transcripts, reuse the managed executor until parity is demonstrated. No new durable CLI mode
or export command is required; App submission already has an entry route.

**Third: retire detached recovery (G6).** For each supported fork/job consumer,
choose the existing caller scope or an existing Task. Migrate durable consumers
with exact outcome/input/return links and preserve useful concurrency. If no scoped
fork consumer remains, delete the action; otherwise keep only caller-owned behavior.
After consumer migration remove automatic standalone resume and its wiring. Keep
explicit permitted standalone user resume, stale-row cleanup and exact process drain
where needed. Task-bound work remains controlled through the exact Task.
An old artifact is evidence, not permission to recreate a goal. Do not rewrite
historical records or infer new Tasks during startup.

**Fourth: remove heuristic stopping (G1, G6).** Once all supported entries have
verified bounds and cleanup, delete silence-based cancellation and error-count
cancellation/automatic escalation. Keep useful existing error evidence without a
new reviewer or timer loop. Remove unused configuration, tests for retired policy
and inaccurate guidance together. Temporary retained callers must be named with a
specific migration or retirement step; an indefinite “legacy” exemption is not done.

Source PRs should be focused and ordered with their App consumers. Run the relevant
boundary tests while iterating and full Host CI for implementation review. Publish
or deploy separately; design approval is not production rollout evidence.

## Acceptance checks and PoC

| Scenario | Required evidence |
| --- | --- |
| Quiet useful helper through Task, generic call, workflow and direct invocation | Completes inside its allowance without silence cancellation; no periodic model review |
| Hung helper and continuously noisy helper | Both reach the same fixed allowance; progress/retry/correction cannot extend it |
| Child starts near parent expiry; nested parallel/replayed steps | Child inherits remaining time, abort reaches all required children, and no late child starts or stale result is admitted |
| Cancellation races completion or output pipes remain open | Exact result retained, no false success, owned processes drained; accepted cancellation distinguished from completed cleanup |
| One-shot success, model failure, malformed required output, timeout and interrupt | Correct exact result/output and exit status even after active session removal; no App Task admitted |
| Agent call feature parity | Scout exploration and maintenance retain schema/finish evidence; permitted discovery/context/skill/tool scope and parallel workflow calls still work |
| Fork migration and restart | Required work has one surviving Task owner or ends with its caller; no heuristic session resume and no sibling Task created |
| Async result before wait, repeated/lost notification, closed owner | Existing accepted results/Conditions and recovery preserve correlation; late events do not reopen closed work |
| Repeated interactive chat turns separated by long idle time | Each active invocation is bounded; idle time and earlier turns do not consume a later turn's allowance |
| Unavailable owner | Failed work remains visible, with operator intervention when needed; no guessed owner or automatic session restart |

Start with portable fixtures: the same quiet/hung behavior through the affected
entries, a real cancellable subprocess, and a one-shot subprocess that fails after
its session leaves the live map. Use injected limits and observed lifecycle edges;
do not add five-minute sleeps or flaky startup races. Reuse existing Task/observer
tests for unchanged async semantics rather than copy their implementations.

After those pass, run one isolated workflow with an agent helper and CLI helper,
checking parent cancellation and structured results. A bounded model-backed trial
may then test whether the agent understands the tools unchanged. Record exact
revisions, failures, timings and limits; synthetic checks do not prove unattended
production reliability. A live trial follows separately after source review.

## Value, cost and explicit exclusions

The expected value is fewer false interruptions, truthful CLI results, predictable
helper cleanup and one place to reason about execution limits. The maintenance
benefit comes from deleting alternate policy and recovery branches, not renaming
APIs. No additional always-on process, registry, model call or polling cadence is
required. Measure execution/cleanup latency and idle overhead against the same
fixture baseline; this review makes no performance claim.

Cost is moderate: context propagation, cancellation races, fork consumers and
separately maintained workflows need coverage. Quiet but unproductive work may
use more of its admitted allowance before its owner reviews it. Accept that cost
instead of adding concurrent supervision now. Cheap redo is acceptable; replaying
an external effect without checking its existing identity is not.

Do not remove useful helper calls, force every invocation into a Task, move provider
code into core, add a generic async-operation API, automatically adopt arbitrary
CLI processes, redesign session storage, or build recursive fallback handling.
If a migration needs new durable machinery just to preserve an unused detached
session feature, retire that feature instead. Completion means every supported
entry follows the same rules, and remaining differences are capability behavior
or presentation rather than alternate work ownership.
