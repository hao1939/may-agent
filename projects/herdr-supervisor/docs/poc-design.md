# Proof-of-concept design

**Status:** Stage 2 in progress
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

The first supervisor is one Pi session in a normal Herdr pane. Its small
extension connects directly to Herdr's local socket for snapshots, lifecycle
events, bounded reads, and identity-fenced prompts. This is enough on the
installed Herdr 0.8.0 protocol, so Bellwether is not a required dependency.
It remains useful prior art and may be reconsidered only if later stages reveal
a capability that the direct contract cannot provide simply.

The supervisor's model is configurable. Workers can use any agent Herdr can
observe. An optional Herdr plugin may later display supervisor metadata, but it
must not own reasoning or duplicate the watch loop.

No standalone daemon is required for the first PoC. The Pi session is the
long-lived supervisor; its watches are dormant while workers run.

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
      "agentSessionRef": "optional-native-session-reference",
      "goal": "Make the requested behavior true.",
      "acceptance": [
        "The focused test passes.",
        "The user-visible behavior is demonstrated."
      ],
      "lastHandledStateChangeSeq": 42,
      "lastMeaningfulActivityAt": "2026-08-28T10:00:00Z",
      "nextReviewAt": "2026-08-28T10:10:00Z",
      "lastActionFingerprint": "optional-deduplication-value"
    }
  ]
}
```

It must not store a worker status. Every display and decision reads the current
status from Herdr. `terminalId` and `agentSessionRef` fence a pane against
occupant replacement. Sequence and timestamps exist only to resume event
handling safely after interruption.

Writes use an atomic temporary-file rename. The PoC needs no database.

## 7. Event flow

```text
register worker
  -> read and fence exact Herdr identity
  -> save goal binding
  -> arm state/result watches
  -> return immediately

Herdr event or stale deadline
  -> coalesce latest signal for that worker
  -> read a fresh Herdr snapshot
  -> reject identity mismatch
  -> collect bounded evidence
  -> ask the supervisor model for one decision
  -> validate and apply that decision
  -> save the handled sequence/checkpoint
  -> re-arm the worker watch
  -> sleep
```

### Signals

| Signal                                   | Default behavior                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Output/activity while `working`          | Refresh liveness only; do not invoke the model                          |
| `blocked`                                | Review immediately and determine whether the worker or human can answer |
| `idle` or Herdr `done`                   | Review the result; never assume goal completion                         |
| `pane.exited`                            | Review identity and choose conservative recovery                        |
| Stale deadline                           | Inspect current evidence before deciding whether to steer               |
| Human message                            | Review immediately with the new authority or information                |

The event means "reconsider this goal now." It never decides success by
itself.

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
session. Other agents use a bounded terminal fallback until their native
adapters are justified and implemented.

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
shape, authority, identity, cooldown, and evidence requirements, then performs
the selected operation.

## 10. Context supplied to the model

Only one registered worker is reviewed per model call. Context includes:

- goal and acceptance criteria;
- exact current Herdr identity and state;
- the event or deadline that caused review;
- new native assistant messages since the previous observation cursor;
- a bounded terminal fallback only when native evidence is unavailable;
- previous supervisor action and whether subsequent progress occurred;
- new human steering, if any;
- allowed decisions and safety limits.

Do not dump all workers or full transcripts into every call. Cross-worker
context is included only when the human explicitly made the goals related.

## 11. Concurrency and coalescing

- At most one supervisor review runs for a worker.
- Different workers may be reviewed independently.
- Events received during a review collapse to the greatest observed Herdr
  sequence and cause at most one follow-up review.
- Repeated identical actions are suppressed with a fingerprint and cooldown.
- No durable work queue is introduced. On restart, a fresh Herdr snapshot plus
  the saved sequence checkpoints reconstructs what needs review.

## 12. Stale progress

Staleness is absence of meaningful evidence for the configured interval, not
merely an idle terminal.

Use one nearest-deadline timer for all registered workers:

1. Compute the earliest `nextReviewAt`.
2. Sleep until it or an event arrives.
3. Review only the workers whose deadline elapsed.
4. Recompute the next deadline.

Do not run a global polling scan. Ordinary output refreshes liveness without
calling the model. A stale review reads current state before steering because
an event may have been missed or delayed.

## 13. Failure handling

| Failure                       | Behavior                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Supervisor or Herdr reconnect | Load bindings, fetch one session snapshot, validate identities, and re-arm watches                 |
| Worker occupant changed       | Stop and ask the human; never prompt the replacement automatically                                 |
| Malformed model output        | Apply no action, record a visible diagnostic, and retry only on the next signal or bounded backoff |
| Prompt/send failure           | Re-read current identity and state before one bounded retry                                        |
| Herdr reports blocked         | Read new native evidence and determine whether existing context can unblock it before asking the human |
| Worker repeatedly stalls      | Explain the evidence and ask the human after a bounded number of ineffective steers                |
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

- Add one nearest-deadline timer across all registered workers.
- Wake only workers whose review deadline elapsed.
- Re-read live state and bounded native evidence before proposing an action.
- Prove that healthy workers remain quiet and a semantically stalled worker is
  not silently lost.

### Stage 3: bounded live steering

- Permit `leave`, one-message `steer`, and `ask_human`.
- Verify same-worker identity fencing, cooldown, and event coalescing.
- Keep recovery and acceptance human-confirmed initially.

### Stage 4: acceptance and recovery

- Permit evidence-backed `accept`.
- Test restart, reconnect, target replacement, and conservative recovery.
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
10. Idle operation performs no periodic LLM calls and no global terminal scan.

## 18. Questions the PoC must answer

- Are Herdr's bounded pane reads sufficient across Codex, Claude Code, Pi, and
  OpenCode, or is Shepherd's structured history materially better?
- Which Herdr transitions are reliable enough across all worker CLIs?
- Are ordinary native assistant messages sufficient evidence across worker
  agents, or does one agent need a richer mechanical adapter?
- What stale interval catches real stalls without nagging healthy workers?
- Can one Pi supervisor remain understandable with five workers, or should the
  experiment remain intentionally smaller?
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
- Stage 2a deliberately has no stale timer. Lifecycle events are sufficient to
  validate native observation, event wakeups, and dry-run decisions first. The
  single nearest-deadline timer is the separate Stage 2b slice.
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

These questions are evidence goals for the PoC, not reasons to add mechanisms
before testing.
