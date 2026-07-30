# May conversation follow-through POC results

Date: 2026-07-30

## Decision

**The bounded runtime path is proven and deployed. Continue bounded live
review.**

The direction is proven in isolation: request identity comes from durable
trace/task links, not a mutable May session. Current May behaves correctly when
the runtime supplies a focused conversation view and typed action contract.
Production still lacks those runtime links and fallback paths, so the next step
is a shadow implementation with replay proof, not Telegram routing changes.

## Evidence

| Proof | Result | Meaning |
|---|---:|---|
| Deterministic trace-based conversation model | 8/8 | Overlap, session loss, reply targets, and duplicate completion behave correctly. |
| Narrow current-session replay model | 1/8 | Session identity cannot safely stand in for request identity. This is a bounded comparison, not a claim about every live path. |
| Development behavior trajectory, current May with typed runtime | 12/12 + both semantic judges | May preserved owners, proof, completion wakes, and missed-progress checkpoints before promising later results. It closed the correct request once after session loss, kept Gym active, and stated that Hao had no action. Latest run: `gym-multi-V8qqmA`. |
| Held-back transfer trajectory, current May with typed runtime | 8/8 + both semantic judges | May clarified real ambiguity, scoped a stop by reply anchor, suppressed a duplicate, and reported named Gym status from durable state. Run: `gym-multi-rubJMI`. |
| Direct reply before owner acceptance | Initial 0/2; trained 3/3 behavior-correct, with 2 judge passes and 1 judge split | May now says routing and acceptance are pending without promising another message. Its internal commitment keeps the accepted work reference, terminal proof, completion wake, and review checkpoint. Run: `may-conversation-follow-through-transfer-test-20260730T172739Z-32566d1e`. |

The first unconstrained behavior run was meaningfully red: May applied one
request but only wrote a proposal for the second, assigned owner work to May,
omitted restart proof, guessed the wrong completion thread, and sent no correct
closeout. The typed runtime contract removed those failure modes without a
production May prompt change.

The direct-reply case found a real training conflict. The deputy skill told May
to use future language in a decision-only response, so May repeatedly promised
an acceptance update even while labeling the work as `routing`. The fix puts
future owner work in `next_action`, keeps the human reply to present routing
state and human-action need, and shows one complete routing commitment. The
final three decisions were behaviorally correct. One OpenAI judge rejected a
decision that was materially the same as the two accepted decisions, so that
trial remains evaluator variance pending human truth approval.

## Evaluator lesson

An intermediate candidate run exposed a false semantic pass: both language
judges accepted a closeout that still left Hao's next move implied. The POC now
records `humanAction` as a deterministic fact and leaves the wording to the two
semantic judges. A manual evidence audit confirmed the final development and
transfer messages communicate the same fact plainly.

## Smallest production follow-up

Build one read-only shadow resolver over the existing
`notification_messages` lookup. For a Telegram reply, report the explicit
conversation, trace, task, project, and owner links that are already stored.
Classify the result as linked, notification-only, or missing. Record the result
on the existing diagnostic event and leave live routing unchanged.

Observe real link quality before adding more. Defer the broader channel message
index, prepared May context, session-independent completion fallback, and
reviewed closeout routing until this lookup has production-shaped proof.

The first read-only replay found the exact boundary gap. Across the prior seven
days, 229 human-directed `message.created` events had durable traces in the
event graph, but none of the 225 delivered `message.created` notification rows
stored a trace. Only 39 of all 254 Telegram records had a task link. The next
bounded change therefore copies the already-known event trace into the existing
notification JSON. It adds no lookup, table, or routing behavior.

Do not add a new database, task type, scheduler, daemon, or background system.
Existing app owners keep unfinished work; May reviews and closes it.

## Bounded runtime candidate

The candidate keeps the simple shape approved by the design:

- ordinary Telegram messages start fresh bounded May turns;
- only explicit `/steer` targets an execution session;
- the existing notification index stores stable conversation identity, reply
  edges, and available trace/task links;
- concurrent turns keep separate reply targets;
- a result can recover the latest human message from its trace after restart;
- a silent turn that starts Codex or Claude sends one factual receipt;
- fresh turns receive a small recent Telegram context window.

The real incident replay now passes 8/8 deterministic behavior checks and both
semantic judges. May treats “review and suggest” as advisory authority, may use
Codex read-only, changes no state, dispatches no work, and returns a proposal
for Hao to review. The core behavior trajectory is now 12/12, the held-back
transfer remains 8/8, and the deterministic trace model remains 8/8 versus 1/8
for the legacy session model.

May-agent verification passes 52 focused routing tests, 33 end-to-end tests,
and both TypeScript checks. The Gym corpus validates 571 runnable scenarios
with zero errors.

Hao approved rollout of May commit `0b3587e2` on 2026-07-30. The supervisor
health gate passed for the daemon, web service, maintenance service, and API.
In the live smoke test, human message `45971` started fresh session
`s_1785399302756_11` with the stable Telegram conversation id. May made no
delegation or state change and delivered response `45973` as a reply to the
human message on the same request trace. The live event window contained only
the Telegram input, May turn, reply delivery, and unrelated scheduled app
events.
