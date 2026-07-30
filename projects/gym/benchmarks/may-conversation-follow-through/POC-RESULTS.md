# May conversation follow-through POC results

Date: 2026-07-30

## Decision

**Proceed to a bounded runtime implementation. Reject production rollout now.**

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
| Development behavior trajectory, current May with typed runtime | 10/10 + both semantic judges | May preserved owners and proof, closed the correct request once after session loss, kept Gym active, and stated that Hao had no action. Run: `gym-multi-wbZDZu`. |
| Held-back transfer trajectory, current May with typed runtime | 8/8 + both semantic judges | May clarified real ambiguity, scoped a stop by reply anchor, suppressed a duplicate, and reported named Gym status from durable state. Run: `gym-multi-rubJMI`. |

The first unconstrained behavior run was meaningfully red: May applied one
request but only wrote a proposal for the second, assigned owner work to May,
omitted restart proof, guessed the wrong completion thread, and sent no correct
closeout. The typed runtime contract removed those failure modes without a
production May prompt change.

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

Do not add a new database, task type, scheduler, daemon, or background system.
Existing app owners keep unfinished work; May reviews and closes it.
