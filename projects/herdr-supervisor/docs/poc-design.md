# Proof-of-concept design

**Status:** Stage 3 verified; Stage 4 restart and identity recovery verified
**Date:** 2026-08-28

## 1. Purpose

Prove that one sleeping supervisor agent can keep a small set of existing
Herdr workers moving toward explicit goals with low idle overhead and without
building another task system.

The PoC is successful only if it works smoothly with workers that finish,
pause, ask questions, stall, crash, or produce an incomplete result.

## 2. User scenario

1. The human starts or selects a normal Herdr agent pane.
2. The human tells the supervisor: supervise this worker toward a stated goal,
   with stated acceptance evidence.
3. The supervisor confirms the exact worker and records the goal binding.
4. The worker continues independently. The supervisor is not consuming model
   turns while nothing meaningful is happening.
5. Herdr events wake the supervisor when review is useful.
6. The supervisor explains important progress, asks only necessary human
   questions, and steers the same worker when more work is possible.
7. The supervisor stops supervising only after it verifies the acceptance
   evidence or the human explicitly stops it.

## 3. Mental model

There are only three active roles:

| Role       | Responsibility                                                |
| ---------- | ------------------------------------------------------------- |
| Human      | States goals, provides decisions, and retains final authority |
| Worker     | Executes one goal in one ordinary Herdr pane                  |
| Supervisor | Reviews evidence and helps that worker continue               |

Herdr remains the runtime:

- Herdr owns panes, processes, sessions, live state, identity, and events.
- The worker owns implementation work and its evidence.
- The supervisor owns the judgment about whether the registered goal is
  progressing or accepted.

A goal binding is not another task. It does not have its own pending/running/
waiting lifecycle. It only attaches human intent and acceptance criteria to an
existing worker identity. The worker receives that goal normally and does not
need to know that Herdr or a supervisor exists.

## 4. Boundary

### In scope

- explicitly register and unregister an existing worker;
- observe multiple registered workers;
- react to Herdr state changes and native worker messages;
- perform a stale-progress review at a configured deadline;
- read bounded current output or structured history;
- steer the same worker;
- notify or ask the human;
- recover a disappeared or crashed worker conservatively;
- verify completion evidence;
- show a concise supervision view.

### Out of scope

- task trees, dependencies, queues, priorities, or project planning;
- automatically decomposing a goal into more workers;
- worktree creation, merging, deployment, or CI ownership;
- replacing Herdr status detection;
- parsing every terminal update with an LLM;
- automatically approving permissions or destructive actions;
- supervising workers that were not explicitly registered;
- a web UI, Telegram bridge, or May integration.

## 5. Initial deployment

The first supervisor is one persistent Pi session in a normal Herdr pane. Its small
extension connects directly to Herdr's local socket for snapshots, lifecycle
events, bounded reads, and identity-fenced prompts. This is enough on the
installed Herdr 0.8.0 protocol, so Bellwether is not a required dependency.
It remains useful prior art and may be reconsidered only if later stages reveal
a capability that the direct contract cannot provide simply.

The supervisor's model is configurable. Workers can use any agent Herdr can
observe. An optional Herdr plugin may later display supervisor metadata, but it
must not own reasoning or duplicate the watch loop.

No standalone daemon is required for the first PoC. The Pi session is both the
human-facing supervisor conversation and its long-lived judgment context; its
watches are dormant while workers run.

## 6. Minimal durable state

One versioned file owned by the extension contains registered goal bindings
and recovery checkpoints:

```json
{
  "version": 1,
  "workers": [
    {
      "paneId": "w1:p2",
      "terminalId": "term_abc123",
      "agentSession": {
        "source": "herdr:codex",
        "agent": "codex",
        "kind": "id",
        "value": "native-session-id"
      },
      "goal": "Make the requested behavior true.",
      "acceptance": [
        "The focused test passes.",
        "The user-visible behavior is demonstrated."
      ],
      "lastObservedStateChangeSeq": 42,
      "lastReviewStateChangeSeq": 42,
      "nextReviewAt": "2026-08-28T10:10:00Z",
      "observationCursor": {
        "kind": "codex-jsonl",
        "path": "/exact/native/session.jsonl",
        "offset": 12345
      }
    }
  ]
}
```

It must not store a worker status. Every display and decision reads the current
status from Herdr. `terminalId` and `agentSession` fence a pane against occupant
replacement. Sequence, deadline, and observation cursor exist only to resume
review safely after interruption.

Writes use an atomic temporary-file rename. The PoC needs no database.

## 7. Event flow

```text
register worker
  -> read and fence exact Herdr identity
  -> save goal binding
  -> arm state/result watches
  -> review immediately when the worker is already settled or blocked
  -> return immediately

Herdr event or stale deadline
  -> coalesce latest signal for that worker
  -> read a fresh Herdr snapshot
  -> reject identity mismatch
  -> start one scoped supervisor turn
  -> observe that exact worker once
  -> make and apply at most one steering or acceptance decision
  -> end the turn
  -> wait for the next Herdr event or stale deadline
```

### Signals

| Signal                                   | Default behavior                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Output/activity while `working`          | No lifecycle wake; the bounded review deadline remains the safety net   |
| `blocked`                                | Review immediately and determine whether the worker or human can answer |
| `idle` or Herdr `done`                   | Review the result; never assume goal completion                         |
| `pane.exited`                            | Review identity and choose conservative recovery                        |
| Stale deadline                           | Inspect current evidence before deciding whether to steer               |
| Human message                            | Review immediately with the new authority or information                |

The event means "reconsider this goal now." It never decides success by
itself.

One review turn is deliberately bounded. It may successfully observe only its
exact worker once. After steering or accepting, no more supervisor tool calls
are allowed in that turn. Worker events received while the turn is active are
coalesced; after the turn settles, the extension rereads Herdr's authoritative
state and starts another review only when the latest state warrants one. The
model never polls a worker while waiting for its instruction to run.

## 8. Worker-transparent observation

The worker is responsible only for pursuing its goal and communicating
normally through its native agent interface. It must not call a supervisor
command, emit a protocol marker, know its Herdr pane, or maintain supervision
state.

The infrastructure boundary is a small observation operation:

```text
observe(exact worker identity, previous cursor)
  -> new native assistant messages
  -> current cursor
  -> source and truncation facts
```

The adapter performs only mechanical collection. It does not classify text,
guess progress from keywords, or decide whether the goal is complete. The
supervisor model makes those semantic decisions from the goal, acceptance
criteria, and collected evidence.

The initial Codex adapter resolves the native session ID reported by Herdr and
reads only new assistant messages from that session's JSONL record. It excludes
user, developer, and reasoning records. A cursor prevents rereading the whole
session. A new goal binding begins with only the latest assistant message, so
earlier goals from a reused worker session cannot become evidence for the new
goal. Later reviews receive every new bounded assistant message after that
cursor. Other agents use a bounded terminal fallback until their native adapters
are justified and implemented.

Herdr lifecycle events answer "when should this goal be reconsidered?" Native
agent records answer "what did the worker communicate?" Neither one alone
decides success.

## 9. Supervisor decision

Code collects context and applies a decision. The model makes the semantic
decision. The model returns one small validated object:

```json
{
  "decision": "leave | steer | ask_human | recover | accept",
  "summary": "Plain-language explanation",
  "message": "Optional exact message for the worker or human",
  "evidence": ["Required when accepting"],
  "reviewAfterMs": 600000
}
```

Meaning:

- `leave`: progress is healthy; do not interfere.
- `steer`: send one useful instruction to the same worker.
- `ask_human`: a real decision or missing fact requires the human.
- `recover`: restore or resume the same goal only after identity checks.
- `accept`: acceptance criteria are supported by current evidence.

The executor contains no keyword router for these judgments. It validates the
shape, authority, identity, evidence requirements, and one-decision turn
boundary, then performs the selected operation.

`ask_human` is an explicit supervisor operation because it has different
effects from steering: it shows one question, closes the review turn, and leaves
the worker untouched. The human's answer may then steer that same worker once.
No waiting task or durable message queue is created.

## 10. Shared supervisor context

The PoC deliberately uses one persistent supervisor session. Each review is a
new, self-contained request inside that session. The model retains the useful
history of the overall supervision conversation while the new request clearly
re-establishes which worker and goal it must judge.

Only one registered worker is the subject of a review turn. Its request
includes:

- goal and acceptance criteria;
- exact current Herdr identity and state;
- the event or deadline that caused review;
- new native assistant messages since the previous observation cursor;
- a bounded terminal fallback only when native evidence is unavailable;
- new human steering, if any;
- allowed decisions and safety limits.

The model may use relevant earlier session history, including relationships the
human established between goals and its own previous action for this worker. It
must not treat another worker's evidence as evidence for the current worker. We
first trust the model to follow the explicit worker scope in each request.
Separate model sessions, generated summaries, retry counters, and retrieval
machinery are deferred unless a controlled trial shows a real failure that they
would solve.

## 11. Concurrency and coalescing

- Workers run concurrently, while the one supervisor session makes one semantic
  judgment at a time.
- Each worker has at most one pending review signal. Repeated signals coalesce;
  the eventual review always rereads authoritative Herdr state.
- Pending workers are reviewed in first-observed order, so a noisy worker cannot
  continually displace another worker.
- Events received during a worker review cause at most one later review of that
  worker.
- A review fence rejects another pane, a repeated successful observation, and
  every tool call after steering or acceptance until the model turn settles.
- The persistent supervisor session exposes its previous steering decisions to
  the next bounded review; code does not guess whether semantic actions are
  duplicates.
- No durable work queue is introduced. On restart, a fresh Herdr snapshot plus
  the saved sequence checkpoints reconstructs what needs review.

The small in-memory set of workers needing reconsideration is coordination for
the shared model session, not another work queue. Human commands and Herdr
workers remain responsive while the model reviews one worker.

## 12. Stale progress

The stale-progress deadline means a registered goal has gone too long without
a supervisor review. It is a recovery safety net, not a claim that the worker
made no progress and not merely an idle terminal.

Use one nearest-deadline timer for all registered workers:

1. Compute the earliest `nextReviewAt`.
2. Sleep until it or an event arrives.
3. Review only the workers whose deadline elapsed.
4. Recompute the next deadline.

Do not run a global polling scan. A stale review reads current Herdr state and
bounded native messages before deciding because an event may have been missed
or delayed. The next deadline starts after the review turn settles, so a slow
model turn cannot enqueue another review behind itself.

## 13. Failure handling

| Failure                       | Behavior                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Supervisor or Herdr reconnect | Load bindings, fetch one session snapshot, validate identities, and re-arm watches                 |
| Worker occupant changed       | Stop and ask the human; never prompt the replacement automatically                                 |
| Malformed model output        | Apply no action, record a visible diagnostic, and retry only on the next signal or bounded backoff |
| Prompt/send failure           | Re-read current identity and state before one bounded retry                                        |
| Herdr reports blocked         | Read new native evidence and determine whether existing context can unblock it before asking the human |
| Worker repeatedly stalls      | Improve the steer from shared history, then ask the human when further steering is not useful      |
| Completion claim lacks proof  | Steer the same worker to verify; do not accept or spawn another worker                             |
| Supervisor session disappears | Workers continue unaffected; recovery resumes from Herdr and the small binding file                |

## 14. Safety

The same extension has three explicit authority modes:

- `observe` displays meaningful signals but starts no model turn and cannot
  mutate a worker;
- `dry-run` wakes the model and displays its proposed action but cannot mutate
  a worker or accept a goal;
- `live` may prompt an identity-matching registered worker and accept its goal.

The PoC starts in `observe`, followed by `dry-run`.

Live mode permits only:

- prompting a registered, identity-matching worker;
- starting or resuming that exact worker when the recovery policy allows it;
- notifying the human;
- marking the local goal binding accepted or stopped.

Registering, replacing, and explicitly stopping a binding are human
control-plane operations exposed through commands and the CLI. Event-driven
model turns cannot perform them. This prevents a review wakeup from silently
changing the goal it is supposed to judge.

The PoC may not close panes, delete worktrees, approve permissions, merge,
push, deploy, or create another worker. Those capabilities require separate
evidence and authorization.

## 15. Human view

The default view should answer four questions without exposing internal
machinery:

```text
Worker     Goal                         Now               Next
codex-api  Fix request cancellation     testing fix       review on settle
claude-ui  Simplify task presentation   needs your input   choose layout A/B
```

Opening one row shows:

- current progress and evidence;
- why the supervisor last acted or chose not to act;
- what the worker is doing next;
- what the human needs to do, if anything;
- the exact worker pane and goal acceptance criteria.

Progress and result notifications are delivered at most once per meaningful
event. Transport metadata remains secondary.

## 16. PoC stages

### Stage 1: passive observation

- **Implemented:** register existing workers and update one binding per pane.
- **Implemented:** arm non-blocking Herdr lifecycle subscriptions.
- **Implemented:** show fresh state and meaningful transitions.
- **Implemented:** exact terminal and native agent-session identity fencing.
- **Verified:** passive mode starts no model calls and performs no worker
  mutation.

### Stage 2a: event-driven dry-run review

- **Implemented:** collect new native Codex assistant messages without worker
  participation.
- **Implemented:** invoke the model on blocked, settled, and exited signals.
- **Implemented:** display proposed steering or acceptance without applying it.
- Compare dry-run decisions with human judgment on controlled workers.

### Stage 2b: stale-progress review

- **Implemented:** use one nearest-deadline timer across all registered workers.
- **Implemented:** wake only workers whose review deadline elapsed.
- **Implemented:** re-read live state and bounded native evidence before
  proposing an action.
- **Verified:** a legacy binding without a deadline received one recovery
  review, then moved to the configured next deadline.
- **Verified:** a short-interval test exposed and fixed overlapping review
  wakeups; signals now coalesce while a worker review is in flight.

### Stage 2c: shared-session context switching

- **Implemented:** one persistent Pi session serializes semantic reviews while
  workers continue concurrently.
- **Implemented:** every review request restates the exact worker, goal,
  acceptance criteria, trigger, and next review operation.
- **Implemented:** signals for other workers coalesce in a fair in-memory set
  until the current model turn settles.
- **Verified:** one controlled dry-run reviewed two distinct Codex panes in the
  same Pi session. It accepted only the completed Alpha goal, then observed and
  proposed further work only for the active Beta goal. Each tool call used the
  correct pane and goal evidence, and dry-run mode made no worker mutation.
- Keep testing with longer histories and related goals before enabling live
  steering broadly; add isolated model contexts only if those trials expose a
  concrete context-switch failure.

### Stage 3: bounded live steering

- **Implemented:** permit `leave`, one-message `steer`, and one explicit
  plain-language question to the human without touching the worker.
- **Implemented:** enforce one exact-worker observation and at most one applied
  decision per event-driven model turn.
- **Verified:** an idle Codex worker that had created the requested file without
  verification was observed once and steered once. The supervisor turn then
  settled instead of polling while the worker ran.
- **Verified:** a missing human choice produced one direct question and no
  worker prompt. The plain answer steered the same worker once; its next event
  supplied the evidence used for acceptance.
- **Verified:** one recoverable refusal was resolved by a more concrete second
  steer. A hard-refusal worker received three distinct attempts, then the same
  supervisor session asked whether to replace or reset it; no retry counter or
  task was needed.

### Stage 4: acceptance and recovery

- **Implemented:** permit evidence-backed `accept`.
- **Verified:** the worker's later idle event began a new review turn; the
  supervisor observed the new byte-exact output once and accepted the binding.
  The first turn contained exactly observe/steer, and the second exactly
  observe/finish.
- **Verified:** Pi was stopped after steering while the worker remained active.
  The worker finished while the supervisor was down; resuming the same Pi
  session reloaded the binding, observed only sequence-new evidence, accepted,
  and did not repeat the steer.
- **Verified:** replacing the Codex session in the same pane produced an exact
  native-session mismatch. The replacement received no prompt. The first run
  exposed that the turn fence did not count a verified mismatch as collected
  evidence; the minimal correction now permits a safe human question or
  evidence-backed stop without exposing replacement output.
- Test reconnect and conservative process recovery.
- Decide from evidence whether Shepherd or any additional component is needed.

## 17. Acceptance criteria

The PoC is successful when all of these are demonstrated:

1. Two workers with different goals can run concurrently under one supervisor.
2. Working output does not cause repeated model calls.
3. A blocked or settled worker wakes the supervisor promptly.
4. An incomplete completion claim causes useful steering of the same worker.
5. A genuine human decision is presented plainly and only once.
6. A stale worker is reviewed and either left alone with reason, steered, or
   escalated; it is never silently lost.
7. Restarting the supervisor recovers bindings and watches without creating
   duplicate work.
8. Replacing a pane occupant fails closed instead of steering the wrong agent.
9. Herdr remains the sole source of live worker state.
10. With no due registered goal, idle operation performs no LLM call and no
    global terminal scan.
11. Sequential reviews of two different workers remain correctly scoped while
    useful shared supervisor history remains available.
12. A live steer ends its review turn; acceptance happens only in a later turn
    triggered by fresh Herdr state.

## 18. Questions the PoC must answer

- Are Herdr's bounded pane reads sufficient across Codex, Claude Code, Pi, and
  OpenCode, or is Shepherd's structured history materially better?
- Which Herdr transitions are reliable enough across all worker CLIs?
- Are ordinary native assistant messages sufficient evidence across worker
  agents, or does one agent need a richer mechanical adapter?
- What stale interval catches real stalls without nagging healthy workers?
- Can one persistent Pi supervisor switch cleanly among five workers without
  confusing their evidence, and does normal session compaction keep the history
  manageable?
- Does a later stage prove Bellwether's crash probe or watch lifecycle is worth
  adding instead of retaining the direct Herdr subscription?

## 19. Stage 1 findings

- The installed runtime is Herdr 0.8.0 using protocol 19. Its direct socket API
  already provides every Stage 1 capability and the later bounded prompt path.
- Lifecycle subscription messages do not carry `state_change_seq`. The
  extension therefore treats an event only as a wakeup and immediately reads a
  fresh snapshot for the authoritative sequence, status, and identity.
- Pi Bellwether is not installed locally. Making it mandatory would add setup
  and another compatibility boundary without improving this slice.
- A standalone CLI is useful for inspecting workers and preparing bindings,
  but the Pi extension owns active subscriptions. A binding added externally
  is picked up when the extension starts or reloads; dynamic cross-process
  binding notification is intentionally deferred until a real use case proves
  it necessary.
- Stage 2a deliberately began without a stale timer so native observation,
  event wakeups, and dry-run decisions could be validated independently. Stage
  2b then added one nearest-deadline timer without adding a queue or scan loop.
- A live passive smoke test bound an idle Codex pane, loaded the Pi extension,
  emitted one review notice, and left the worker on the same Herdr state and
  `state_change_seq`. This confirms the observe path does not prompt the worker.
- Requiring a worker to call `herdr-supervisor update` would leak infrastructure
  into goal execution. Stage 2 instead introduces a supervisor-side observation
  adapter; Codex workers remain unchanged and unaware of supervision.
- A controlled Stage 2a run exposed an important boundary failure: a normal Pi
  session could inspect the worker's repository with built-in coding tools.
  The dedicated supervisor now activates only its identity-fenced supervisor
  tools. Launching with `--no-builtin-tools` provides the same boundary before
  extension initialization.
- The repeated dry-run then used only supervisor observation, status, and
  proposed-steering tools. It made no workspace call and did not mutate the
  worker. The run also showed that registration must not be a model tool: an
  event review tried to restate the existing binding before observing it.
  Registration and explicit stopping are now command/CLI-only.
- The first short-deadline smoke test found that a deadline could expire while
  its prior model turn was still running, repeatedly queueing review messages.
  One in-flight fence per worker now coalesces intervening signals, and the next
  deadline is measured from the settled review. A clean rerun produced one
  wakeup and one bounded observation, then returned to sleep.
- The first two-worker shared-session trial showed that a separate model session
  per worker is not presently justified. One Pi conversation handled Alpha and
  Beta sequentially, retained the useful overall history, selected the correct
  pane-specific tools, and did not use Alpha evidence to complete Beta. The
  extension now admits only one semantic review turn at a time and coalesces the
  other workers' signals until that turn settles.
- The first live steering trial exposed model-side polling: after steering, the
  supervisor repeatedly observed the worker within the same turn. Prompt wording
  alone was insufficient. A small in-memory review fence now enforces the natural
  event boundary without adding a queue or scheduler.
- The repeated live trial used one disposable Codex worker with an intentionally
  incomplete result. Its transcript contains two distinct Herdr-triggered model
  turns: `observe -> steer`, then, after the worker returned idle,
  `observe -> finish`. Each turn read the exact worker once, and the accepted
  evidence was the literal byte output `38 34 0a`.
- The first human-decision trial reached the goal, but the model unnecessarily
  told an already-waiting worker to keep waiting before it asked the human. The
  extension had described `ask_human` as a decision without providing that
  operation, so the model used the nearest available action, `steer`.
- Adding one matching `supervisor_ask_human` operation removed that ambiguity.
  The clean rerun followed `observe -> ask human`, plain human answer,
  `steer`, then a later `observe -> finish`. The worker was untouched while the
  question was open, and no human-priority queue or second session was needed.
- Reusing that Codex session for another goal exposed old assistant messages on
  the first observation. The supervisor rejected the unrelated evidence but
  spent an unnecessary correction turn. New bindings now expose only the latest
  assistant message, then advance normally from a cursor; this is a context
  collection rule rather than a semantic heuristic.
- A restart trial stopped Pi immediately after one steer while the Codex worker
  continued for roughly a minute. Herdr advanced from state sequence 372 to 374
  while Pi was absent. The resumed session read the saved cursor, observed only
  the new progress and final response, and accepted with no duplicate steer.
- A same-pane replacement trial changed only the native Codex session identity.
  Identity fencing correctly prevented all observation and prompting of the
  replacement. It also exposed a small authority dead end: the verified mismatch
  had not satisfied the review fence, so even asking the human was rejected.
  Treating that mechanical mismatch as the complete safe observation for the
  turn fixed the dead end without weakening the prompt fence.
- Two ineffective-steering trials did not justify a retry subsystem. In the
  first, a clearer second instruction resolved a contradictory worker constraint.
  In the hard-refusal case, the shared Pi history recognized three ineffective
  attempts and asked whether to replace or reset the worker. The PoC therefore
  keeps semantic retry judgment in the model and enforces only the
  one-action-per-event boundary in code.

These questions are evidence goals for the PoC, not reasons to add mechanisms
before testing.
