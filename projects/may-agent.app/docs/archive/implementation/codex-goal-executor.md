# Resumable Codex Goal Executor

**Status:** Historical evaluation proposal; the accepted behavior and current
correction/wait boundaries are authoritative in
[`native-coding-workers.md`](../../2a-design/native-coding-workers.md).

**Scope:** records the evidence and reasoning used to introduce Codex as a
resumable Task executor while preserving App Task authority.

## Accepted decision

Keep one durable work model:

```text
App owns one Task goal
  -> Host wakes and fences one reconciliation attempt
  -> selected executor keeps working until the goal is done or truly waiting
  -> events carry facts, findings, progress, approval, and steering
  -> Host admits one result or resumes the same Task after an execution failure
```

Codex is a replaceable executor, not another App, Task owner, scheduler, or
completion authority. A Codex thread supplies working-memory continuity for the
same App Task. Its goal mirrors the Task outcome so Codex can work effectively,
but only the owning App may say that the Task is fulfilled.

Use Codex app-server over local stdio for this integration. Official OpenAI
documentation recommends the Codex SDK for ordinary CI automation and
app-server for deep product integrations. May needs persistent threads, live
steering, goals, and streamed lifecycle observations, so app-server is the
intentional fit here rather than an incidental process wrapper. Its supported
surface includes persistent threads, thread goals, thread resume/read/status,
streamed turn events, live `turn/steer`, and `turn/interrupt`. Do not infer
these semantics from terminal output. Generate protocol types from the pinned
Codex version used by the image.

Codex's `features.goals` capability provides persisted goals and automatic
continuation and is stable and enabled by default. Activating a thread goal may
therefore start and own the next turn. The May adapter observes the
authoritative `turn/started`; it must not also call `turn/start` and create a
competing continuation loop.

Reference: [official Codex app-server documentation](https://learn.chatgpt.com/docs/app-server).

## One goal, two different records

The names are deliberately explicit:

| Record            | Meaning                                                         | Authority         |
| ----------------- | --------------------------------------------------------------- | ----------------- |
| App Task          | Durable desired outcome, acceptance, events, and observed state | App and Host      |
| Reconcile attempt | One fenced execution of the Task goal                            | Host              |
| Codex thread      | Resumable executor context for the same Task                    | Executor evidence |
| Codex thread goal | Mirror of the current Task outcome and budget                   | Executor hint     |
| Codex turn        | One internal reasoning/action turn inside one reconcile attempt | Executor          |

The Codex thread ID is an execution attachment to the App Task. It never
becomes a second task ID. Codex goal status is useful evidence, but it cannot
close, pause, or block the App Task by itself.

A terminal Codex goal update is not even the native turn boundary: Codex may
mark the goal complete before its final assistant output and
`turn/completed`. The adapter waits for both the relevant terminal goal
observation and authoritative turn completion before normalizing a candidate
Task result. App verification remains a separate final step.

Automatic continuation may create several turns. The terminal goal update's
`turnId` identifies which turn must complete; the adapter must not assume that
the first goal-created turn is the final one.

## Required invariants

1. `(appId, taskId)` remains the only durable work identity.
2. The App remains the only owner of outcome and acceptance semantics.
3. Runtime fences every attempt by Task generation and accepts the final result.
4. A Codex thread is bound to at most one live App Task.
5. A Task has at most one active attempt and therefore at most one active Codex turn.
6. Every external event is persisted against the Task before best-effort live steering.
7. Missing or unincorporated live steering is repaired by the next Task
   attempt's durable event batch; only an admitted result may consume it.
8. Raw Codex stream traffic is diagnostic evidence, not a new event log or task state.
9. Restart may repeat work; workspace changes and event publication must remain idempotent.
10. Changing `codex` to the native May executor does not change App code or Task semantics.

## Result boundary

No additional Task result state is needed. Codex automatic continuation keeps
the execution active across internal turns. The adapter returns only
`converged` or an exact `waiting` result. If the process fails, the Host retries
the same Task and resumes its bound Codex thread.

## Canonical attempt input

Native May, Codex, Claude, and later executors must be compared using one
canonical attempt packet built once by Runtime:

```text
identity: app, Task, generation, attempt
desired: outcome, acceptance, mode, input
role: selected agent name, instructions, allowed capabilities
events: bounded unaccepted Task event batch and checkpoint
observations: bounded current child and dependency facts
workspace: Runtime-selected cwd and declared output paths
contract: admitted Task result schema
limits: attempt deadline, remaining Task budget, and sandbox
```

Adapters may render this packet differently, but may not silently omit the
selected role, capabilities, events, or acceptance rules. Repository
`AGENTS.md` discovery may enrich Codex execution; it does not replace the
selected May agent role packet.

The packet is not another public resource or durable state machine. It is a
bounded projection of the Task and already-durable events for one attempt. The
PoC must compare the field-level packet received by native May and Codex before
claiming executor parity.

Codex transport has one important constraint. The documented thread-goal
objective is limited to 4,000 characters, and replacing that objective resets
Codex goal usage accounting. Therefore:

- `developerInstructions` carries the selected role, executor protocol, and
  complete canonical attempt packet before goal activation;
- the Codex goal objective is a compact, generation-stable pointer to the May
  Task outcome, not a second copy of every event;
- retries of the same May generation reuse the same goal objective;
- live events use `turn/steer` and durable next-attempt replay, never a goal
  rewrite; and
- a new May generation may replace the goal objective, while May retains the
  authoritative overall budget.

This mapping still needs a fixture that proves equivalent semantic fields for
native May and Codex. It is a production gate, not an assumption.

## Executor contract

Keep the existing small function. Add only mechanical cancellation:

```ts
type TaskAttempt = {
  appId: string;
  task: TaskDetail;
  cwd: string;
  declaredOutputPaths: string[];
  children: { live: TaskReconciliationChild[]; completed: TaskReconciliationChild[] };
  events: TaskReconciliationEvents;
  signal: AbortSignal;
  publish(localKey: string, event: AppEvent): Promise<{ eventId: number }>;
  onEvent(listener: (event: AppEvent, accept: () => void) => void): () => void;
};

type TaskExecutor = (attempt: TaskAttempt) => Promise<TaskReconcileResult>;
```

`accept()` is attempt-local, idempotent, and has no immediate durable effect.
Runtime removes that exact event only in the same fenced transaction that
admits the returned result. A failed, interrupted, or stale attempt therefore
replays it. An executor calls `accept()` only after the event is incorporated
into its candidate result, not merely because transport delivery succeeded.

Do not add a public executor session controller. Completion is the returned
promise, output is `publish`, input is `onEvent`, and cancellation is `signal`.
Codex-specific thread, turn, approval, and process operations stay inside the
Codex adapter.

## Codex attempt flow

```text
claim current Task generation
  -> start local app-server connection
  -> resume bound thread, or start one when absent
  -> supply role plus canonical attempt packet before goal activation
  -> set/update and activate the compact, generation-stable thread goal
  -> observe the authoritative goal-created turn
  -> stream bounded activity evidence
  -> steer the active turn when a new Task event arrives
  -> let Codex continue automatically while the goal is active
  -> receive terminal goal status and authoritative turn/completed
  -> normalize final output
  -> return converged or exact waiting
  -> stop app-server process and release the Task attempt
```

The Task's Codex thread normally survives across attempts; the app-server
process does not need to. A fresh local process may resume the persisted thread
for each attempt. This avoids a global Codex service lifecycle and makes
process-tree cleanup local and testable.

If a Task generation changes, update the same thread goal and include the new
generation in the next turn. Start a new thread only when the existing context
is unavailable, bound to another Task, or demonstrably incompatible with the
workspace. Record supersession as evidence.

### Result admission and correction

`thread/goal/updated(status: "complete")`, `turn/completed`, and valid JSON are
three observations, not Task success. After all three are available, the
adapter calls the SDK's real `admitTaskReconcileResult` boundary. Only an
admitted result proceeds to normal App verification.

If parsing or admission fails:

1. do not run the App verifier or mutate Task status;
2. send the exact admission problem back to the same thread; and
3. keep the same Task attempt active while Codex corrects its output on the
   next automatic turn.

Do not silently translate Codex's `complete` into May's `converged`, and do not
accept malformed output as progress. A process failure ends the attempt;
ordinary Runtime recovery then resumes the same Task and thread. A usage or
budget limit is also an execution failure. Runtime must not invent a timed
wait for it.

## Event bridge

Task events remain the shared interface.

### Input to Codex

- If a turn is active, `TaskAttempt.onEvent` sends the canonical event through
  `turn/steer` with the active turn ID as a precondition.
- After the correlated terminal turn yields an admitted Task result, the
  adapter calls the event's attempt-local `accept`; Runtime consumes it
  atomically with that result.
- If steering races with turn completion, retain the event for the next attempt;
  do not retry it against an unknown turn.
- If the thread is idle, the next reconcile attempt includes the event in the
  ordinary durable batch and starts another turn.

### Output from Codex

The opt-in adapter projects the app-server's small authoritative surface into
`project.task.executor.progress` events:

- `turn/started`, `thread/goal/updated`, and `turn/completed` provide lifecycle;
- completed commentary and plan items provide bounded intermediate text;
- unsuccessful commands provide only status, exit code, and duration;
- unsuccessful tool calls provide only tool/server, status, and duration; and
- a file-change item produces a warning without paths or diffs because the
  current trial is read-only.

The bridge deliberately ignores token and reasoning deltas, command output,
tool arguments/results, diffs, phase-less messages, and completed
`final_answer` items. The final answer belongs only to the terminal Task-result
admission path and must not appear twice.

Commentary and plan text are semantic output, so they cannot be mechanically
guaranteed secret-free. The canonical attempt instructions tell Codex that
this text may be durable and must summarize without secrets, raw output, tool
payloads, or diffs. The structural allow-list is the hard boundary; this
instruction is defense in depth, not a claim that prose redaction is solved.

Protocol notification handling does not await event storage. Publications are
serialized on a separate promise chain, deduplicated by attempt-scoped
thread/turn/item keys, capped at 64 meaningful events per attempt, and flushed
before the attempt returns. Repeated active-goal usage heartbeats collapse to
one event per turn/status transition. Long opaque item IDs are represented by
stable compact hashes rather than copied into the event. A publication failure
degrades observation and is reported in result evidence; it does not discard
an otherwise valid completed Task result.

These passive progress events have no exact Task target. The existing hidden
attempt fence still stores their Task and attempt ownership atomically, so they
remain queryable with the Task, but they do not wake their own Task and create
an event loop. A Codex event never closes the Task; only the admitted reconcile
result can.

Human Task detail reads project only the newest progress event through a small
partial `(project_id, task_id, id)` index. Task lists do not join or scan event
history. An active Console or Telegram `/watch` receives an identity-only wake,
re-reads that one Task, and lets each adapter render the same progress in its
native format. The event payload is not copied into the wake. Terminal Task
results omit the projection, so the authoritative result naturally replaces
in-flight progress. With no watcher there is no adapter read or UI work.

An MCP capability for arbitrary structured `attempt.publish` remains a later
experiment. It is not needed for useful progress because Codex can emit normal
commentary and plans and the adapter can safely project their authoritative
completed items.

## Liveness without blind pushing

"Keep pushing" means level-triggered reconciliation, not repeated prompts on a
timer regardless of state.

| Observation                                                  | Action                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Active turn with recent protocol activity                    | Observe; do not interfere                                                    |
| New Task event during active turn                            | `turn/steer` once; durable replay remains authoritative                      |
| Turn completes while the Codex goal remains active           | Observe automatic continuation; do not start a competing turn                |
| Thread is idle while its Codex goal remains active           | Re-activate/resume through the adapter's bounded liveness policy             |
| Process exits or connection fails                            | End attempt as retryable failure; lease recovery requeues                    |
| Active turn has no protocol activity past the soft threshold | Send one diagnostic/nudge steering event                                     |
| Still silent past the hard threshold                         | Interrupt the turn, retain evidence, and requeue with backoff                |
| Codex reports blocked                                        | Accept an exact wait; otherwise ask it to continue on the same goal           |
| Usage or token budget is exhausted                           | Exact time/quota Condition when observable; otherwise attention              |
| Human explicitly pauses the App Task                         | Do not wake or override it                                                   |

The adapter records `lastActivityAt`, active turn ID, bounded nudge count, and
process health as attempt diagnostics. These do not become another desired
state machine. Thresholds must be measured in the PoC; production defaults are
not chosen in this proposal.

Codex `paused`, `blocked`, `usageLimited`, `budgetLimited`, and `complete` goal
statuses are observations. They never directly map to App Task completion.
For example, Codex `complete` still requires App verification; Codex `paused`
without a May Condition causes another bounded reconcile rather than permanent
waiting.

## Restart and recovery

May remains the daemon:

1. Persist the Codex thread binding and latest turn evidence before relying on it.
2. If May restarts, its normal expired-attempt repair makes the Task pending.
3. The next attempt starts a fresh app-server process and resumes the thread.
4. It reads thread/goal/status and the last terminal turn before starting new work.
5. A stale result from the old Task generation is rejected by the existing fence.
6. A lost native process tree is terminated or positively shown absent.

No exactly-once claim is made. The Task workspace, event keys, and result fence
make replay safe.

## Native-agent learning and replacement

If the opt-in and canary gates pass, Codex may become the production executor
for selected categories first; native May then learns against the same contract
asynchronously:

```text
production Codex attempt
  -> admitted result + verifier outcome + human corrections
  -> sampled evaluation event
  -> native May shadow attempt in an isolated workspace
  -> compare accepted behavior, evidence, safety, latency, and cost
  -> Gym turns recurring native failures into reviewed scenarios
  -> promote native May per App/task category after held-out proof
```

Do not put shadow execution on the user-facing acceptance path. Do not treat
Codex prose as ground truth. The App acceptance verifier, observed repository
state, tests, and human correction are the truth sources. Mutation shadows use
separate worktrees and have no result-admission authority.

Promotion is explicit and reversible. A Task resolves one executor for an
attempt, records it, and never silently changes executor after failure. Start
with one low-risk task category, then canary broader categories. Keep Codex as
an optional fallback and benchmark after native May becomes the default.

## What to reuse from DeepSeek Harness

DeepSeek Harness validates the provider shape, not a second orchestrator:

- one normalized provider/consumer seam;
- product-specific IDs and protocols remain private;
- explicit workspace, cancellation, and whole-process-tree ownership;
- authoritative terminal protocol events rather than exit code or stdout prose;
- unattended permission handling that fails closed;
- bounded sanitized failures and optional, reversible provider registration.

Its current Codex provider starts one fresh app-server thread/turn per run and
does not implement May's desired resume, Task event bridge, or daemon liveness
policy. Reuse its process and protocol discipline, not its one-shot lifecycle.

## Resumable adapter

The current implementation lives in
`projects/may-agent/src/app/adapters/executors/codex/`. Historical selection and
trial aliases below describe the evaluated source; the executor README and
native-worker design own current behavior. Protocol drift verification remains
supported directly under `scripts/` and in the container smoke gate.

The resource sampler and manual model smoke are retired by the
[scripts decision](../../proposals/poc-retirement-and-knowledge-20260912.md).
Their final main source remains at Host `38a048da5c105bea91dc7163010d94483a60b747`,
under `scripts/poc/codex-goal-smoke.ts` and `codex-goal-resources.ts`.
No maintained diagnostic consumed the sampler independently. The original
observations below retain their own tested revisions and limitations; code
retirement creates no new model evidence. Runtime never imports these trials.

Current focused fixture and protocol commands are:

```bash
bun test src/app/adapters/executors/codex/ scripts/codex-goal-protocol.test.ts
bun run check:codex-goal-protocol
```

### Stage A: protocol fixture

Use an injected fake app-server process to prove:

- initialize/initialized ordering;
- start and resume of one thread;
- goal set/get;
- turn start and authoritative completion;
- live steering with expected turn ID;
- interrupt and process-tree shutdown;
- malformed/oversized line handling;
- request timeout, process exit, and late notification races.

The executor watches protocol activity while the same attempt is running. A
Task event is steered immediately. One bounded quiet check nudges a silent
turn; a later hard check interrupts it and returns an execution failure so
Runtime resumes the same Task and persisted thread. There is no second
liveness policy or Task state machine.

### Stage B: real read-only smoke

Against the pinned Codex binary in a disposable workspace:

- start a persisted thread and goal;
- ask for a bounded repository observation;
- inject one steering event while the turn is active;
- verify the steering appears in thread history or the next durable turn;
- stop app-server, start another process, resume the same thread, and continue;
- measure startup, first activity, completion, memory, and event volume.

### Stage C: disposable write and stale recovery

In a disposable Git worktree only:

- make one deterministic edit and verify it;
- simulate Host interruption between streamed progress and result admission;
- resume the thread and prove replay does not corrupt the workspace;
- simulate a silent process, nudge once, interrupt at the hard threshold, and
  prove the Task is requeued with bounded backoff.

## Acceptance gates

Do not start production migration until all are true:

1. One App Task maps to one resumable Codex thread without duplicate task state.
2. A new Task event reaches an active turn or is provably replayed next attempt.
3. Restart resumes the same thread and the May generation fence rejects stale output.
4. Soft nudge and hard interrupt are bounded and cannot create an event storm.
5. Raw stream memory and retained artifacts are bounded.
6. Process-tree cleanup passes normal exit, timeout, interruption, and catchable Host-shutdown tests. An
   uncatchable Host `SIGKILL` requires external process supervision or startup orphan repair because no in-process
   adapter can run cleanup after it.
7. The canonical packet gives native May and Codex equivalent role/task context.
8. The public result contract remains `converged` or exact `waiting`; internal
   progress does not end execution.
9. App verification remains the only completion authority.
10. The legacy one-shot `codex` adapter remains separate from `codex-goal`.

Resource gates are intentionally not assigned optimistic thresholds from one
sample. Compare one-shot Codex and goal mode at 1, 2, and 4 concurrent attempts
before choosing a fresh app-server per attempt or a shared process. A shared
process is acceptable only if measured savings justify its added lifecycle and
failure coupling.

## Staged migration

1. **Draft and PoC — complete:** the document, protocol fixtures, and real
   read-only smoke are present.
2. **Opt-in — complete:** the manual, read-only `evaluation.app` trial passed.
3. **Evaluation canary — current:** open-ended owner review and addressed
   Evaluation requests select `codex-goal`; deterministic evidence,
   persistence, metric, and delivery workflows remain workflows.
4. **Resource proof:** measure resume, steering, recovery, memory, latency, and
   event volume under controlled failure.
5. **Contract decision — complete:** no `progress` state; retain the minimal
   thread binding needed to resume the same Task.
6. **Learning:** sample accepted attempts into Evaluation/Gym and run native May shadows.
7. **Promotion:** switch proven categories to native May without changing Apps
   or Task semantics.

## Explicit non-goals

- Codex does not become an App or Task owner.
- The Codex thread goal is not synchronized as a second Task state machine.
- The Host does not publish every Codex protocol delta as a May event.
- The canary does not replace deterministic Evaluation workflows or change the
  default executor for other Apps.
- The design does not promise exactly-once execution.
- Native-agent promotion is not based on imitation or output-text similarity alone.

## Implementation evidence

The existing `codex` and `claude` executors remain unchanged. The new behavior
is registered as explicit executor name `codex-goal`; the former
`codex-goal-poc` name remains only as a compatibility alias.

- Pinned local protocol under test: Codex CLI `0.147.0`. The PoC's small
  handwritten protocol subset was checked against the schema emitted by that
  binary. Checked-in generated types and version-drift detection remain a
  production gate.
- Focused fixtures cover initialize, start, goal, authoritative goal turn,
  steering, completion, resume, interruption, fail-closed server requests,
  process failure, malformed JSON, bounded lines, process-tree RSS accounting,
  exact JSON parsing, real SDK Task result admission, Task-generation fencing,
  shutdown escalation, request-timeout cleanup, and canonical packet parity.
- A real read-only goal automatically created a turn. Live steering was
  accepted and persisted in that turn, and the final answer incorporated it.
- A goal may reach `complete` before its active turn and final answer complete;
  accepting goal status alone would truncate the result.
- A new app-server process resumed the same persisted thread and completed a
  second goal with new live steering.
- A paused goal remained idle until explicitly reactivated, then completed
  normally. This supports level-triggered daemon recovery rather than polling.
- A real goal returned an exact JSON `TaskReconcileResult`; live steering
  changed its caller-facing response, and parsing occurred only after the
  terminal goal's correlated turn completed.
- Exact-turn interruption followed by a later resumed goal completed normally.
- A disposable write replay created `proof.txt` once. After interruption and
  resume it remained exactly five bytes (`once\n`) rather than duplicating the
  effect.
- That write proof first returned valid JSON with `state: "complete"`. The real
  SDK admission boundary correctly rejects it because May accepts only
  `converged`, `waiting`, or (where allowed) `needs-agent`. JSON parsing alone
  is therefore proven insufficient.
- The adapter now keeps the same Task attempt and thread active when Codex
  returns invalid output, sends the admission correction into the next
  automatic turn, and accepts only the corrected result. Process failure still
  resumes the same thread through ordinary Task recovery.
- One small real read-only run initialized in 341 ms, observed first protocol
  activity in 342 ms, completed in 23.8 s, peaked at 194,124 KiB for the
  app-server process tree, and produced 200 notifications / 131,774 protocol
  bytes. Its thread snapshot was 2,609 bytes. A resumed correction run
  initialized in 130 ms, peaked at 198,312 KiB, and produced 112 notifications
  / 76,709 bytes. These are single-run observations, not capacity defaults.
- Raw thread history is excluded from ordinary smoke output. The PoC keeps
  counts and sizes and only includes the full thread with an explicit debug
  flag. The event volume supports the decision not to project every Codex
  notification into May's durable EventHub.
- A first real manual `evaluation.app` Task converged through
  `codex-goal-poc` in about 178 seconds, using a persisted Codex thread and
  read-only sandbox. That useful but silent run motivated the progress bridge.
  A second real trial converged in 119 seconds and emitted multiple concise
  commentary updates plus safe lifecycle and command metadata while it worked.
  It emitted no final-answer duplicate, command text/output, tool payload, or
  diff. The trial also exposed long opaque item IDs and repetitive active-goal
  heartbeats; the projector now hashes those IDs and coalesces unchanged goal
  status. Focused tests prove bounded event count, stable key uniqueness,
  passive no-target publication, payload exclusion, and
  degraded-observation behavior.
- A later end-to-end Task trial converged with the Task still authoritative and
  37 passive progress events, but 28 were ordinary successful command
  completions that repeatedly hid the four useful commentary updates in exact
  Task detail. The projector now drops successful command/tool noise and keeps
  only semantic commentary/plans, lifecycle, failures, and read-only file-change
  warnings.
- The checked protocol fingerprint now includes
  `ItemCompletedNotification` in addition to goal and turn lifecycle schemas.
  This follows the official app-server contract that `item/completed` carries
  the authoritative final item, rather than reconstructing it from deltas.
- The hard-stale controller nudges once, interrupts the exact turn, waits for
  authoritative terminal status, and only then requeues with exponential
  backoff capped at 60 seconds. A human-paused App Task performs no protocol
  action.
- A real Task-store fixture advances the Task specification to a new
  generation after admitting valid Codex JSON. Applying that old admitted
  result returns `stale`; Codex admission cannot bypass May's generation fence.
- The adapter keeps one thread binding for `(appId, taskId)` across Task
  generations, updates the mirrored goal for the new generation, and extracts
  a candidate result only from the exact turn named by the terminal goal.
- The client now proves graceful stdin shutdown, SIGTERM fallback, SIGKILL
  fallback, already-closed handling, and removal of timed-out requests. An
  uncatchable Host `SIGKILL` remains outside in-process cleanup guarantees and
  needs an external lifecycle decision before production wiring.
- One isolated canonical packet fixture carries identity, desired Task state,
  role, durable events/checkpoint, observations, workspace, result contract,
  and limits. Native and Codex renderers receive equal semantic fields. New
  events and attempts change Codex attempt context without rewriting the
  generation-stable goal; a new Task generation changes it, and the goal stays
  within 4,000 characters. Runtime now loads the selected App-agent role and
  supplies bounded direct-child facts and declared outputs through the shared
  `TaskAttempt` contract.
- The first production `runtime/owner-review` canary used executor
  `codex-goal`, bound thread `01a03031-aab2-75d1-9823-71dfbe9505cb`, emitted
  bounded progress, returned an admitted no-op in 131 seconds, resumed the same
  thread for later Task events, and applied one generation-checked evaluator
  child creation when a genuinely uncovered local metric breach arrived.
- Task events `5976152`, `5976189`, and `5976216` proved durable replay across
  resumed attempts. They also exposed that automatic Codex continuation had
  moved beyond the adapter's initially observed turn ID, so best-effort live
  steering could race and fall back to replay. The adapter now follows every
  authoritative `turn/started`, clears completed turn IDs, retains at most 64
  pending steering events, and steers them into the next exact active turn.
- Production resume exposed progress-key collisions when the same Task
  generation emitted a pre-turn goal status from more than one attempt.
  Progress keys are now attempt-scoped while remaining bounded and readable.
- A simple owner review consumed about 75k Codex tokens before first
  convergence and repeated open-alert metric updates could immediately wake it
  again. Evaluation now reserves Codex for a new breach, recovery, explicit
  request, or daily owner heartbeat; repeat updates for an already-open alert
  remain durable facts without starting another owner attempt.
- Production event `5976972` (`LIVE-STEER-DELTA`) reached turn
  `57710273-47ff-42cd-ae52-d33f4992de5d` inside attempt
  `r_49_cc19283c-e66f-4b22-bbbc-3d1a4b429cdc`; the admitted result at event
  `5976987` explicitly incorporated it after 28.9 seconds with no progress
  degradation. Runtime nevertheless scheduled
  `r_49_8c2b53a1-2af0-4bf4-b2fe-027da9f70f2e` because live delivery had no
  result-coupled consumption signal. The shared `TaskAttempt.onEvent` contract
  now supplies an attempt-local `accept` callback. Unit and Runtime integration
  fixtures prove that accepted live input is consumed only with the fenced
  result, while unaccepted or later input remains replayable.
- The deployed fix then passed the same production test. Attempt
  `r_49_af202562-eae0-42c6-80d6-d84dac1a58df` resumed thread
  `01a03031-aab2-75d1-9823-71dfbe9505cb` and started turn
  `e909ad49-6897-4d5a-bf96-fcc3f9785adb`. Event `5977512`
  (`LIVE-STEER-ACK-FENCE`) arrived after that turn started; the one admitted
  result at event `5977550` explicitly incorporated it after 114.2 seconds.
  The maintain Task returned to waiting with no pending trigger, and the latest
  attempt remained `r_49_af202562-eae0-42c6-80d6-d84dac1a58df`: no replay
  attempt was scheduled. This closes the result-coupled live-steering gate.

Still required before promoting this beyond the Evaluation canary:
checked-in generated protocol types beyond the current drift fingerprints,
concurrent and one-shot resource comparison, retained-artifact bounds, an
external policy for orphan cleanup after uncatchable Host death, and production
evidence for restart recovery. The current one-shot executors remain unchanged.
