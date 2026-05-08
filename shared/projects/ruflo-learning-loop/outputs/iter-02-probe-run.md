# Iteration 2 — First probe run

First execution of `loop-closure-probe.mjs` against the live `/app/.state/may.db`.

## Command
```
node /app/agents/shared/projects/ruflo-learning-loop/outputs/loop-closure-probe.mjs
```

## Wall time
`0.149s` (under the 200 ms cheapness target stated in the judgment).

## Output (stdout, verbatim)
```
events 60m: emitted=346 handled=0 dismissed=0 pending=346 oldest_orphan=8d
top orphan types: handler.started=79 handler.completed=76 session.start=48 session.end=46 message.created=35
decision-class: agent.decision=5 project.iteration=12 escalation.created=2 metric.alert_judged=4
metric breaches: open=11569 oldest=4d breach_win=1 recovered_win=1
```

## What these four lines tell arc *without further queries*

1. **Line 1** — In the last hour, 346 events were emitted and **zero** were
   marked `handled` or `dismissed`. Every signal in the last hour is still
   `pending`. The oldest pending event in the entire DB is 8 days old. The
   loop is wide open.

2. **Line 2** — The orphan tail is dominated by lifecycle telemetry
   (`handler.started`, `handler.completed`, `session.start`, `session.end`,
   `message.created`). These five types alone account for 284 of the 346
   pending events. **Decision for iteration 3:** these probably should not
   default to `status='pending'` at all — they are observations, not work
   items. Two architecturally different things are sharing one column.

3. **Line 3** — Decision-class events are present at low volume
   (`project.iteration=12`, `agent.decision=5`, `escalation.created=2`,
   `metric.alert_judged=4`). These are the rows where a `handled` /
   `dismissed` outcome is genuinely meaningful, and they are being lost
   in noise from line 2.

4. **Line 4** — There are **11,569 open `metric.breach` rows**, the oldest
   4 days old; only 1 breach and 1 recovery in the last hour. This is the
   single most damning piece of evidence that the loop is not closed:
   metric alerts are a primary signal class designed to drive action, and
   the action half is missing at scale.

## Iteration-3 question this surfaces

Arc's recommended next iteration question (to be set in the project file
on the next heartbeat that may write to it):

> "Should `metric.breach` and `handler.*`/`session.*`/`message.created`
> events use the same `status` lifecycle, or are they two different
> things being conflated? Pick the smallest separation that closes the
> loop on metric breaches without changing telemetry behaviour."

That is a single, scoped, reversible architectural question. It came
directly from reading four lines of probe output, which is the exact
success criterion the judgment named.

## Verification of the experiment's named success signals

| Signal from iter-02-arc-judgment.md §5 | Result |
|---|---|
| Runs < 200 ms against live `may.db`              | 149 ms ✅ |
| Read-only open succeeds, no writer disruption    | `mode=ro` open succeeded ✅ |
| Four lines enable naming worst offender + age    | `metric.breach`, 4d old ✅ |
| Four lines enable iteration-3 question selection | Yes (see above) ✅ |

Iteration 2 closed. No follow-up tasks created. No schema, runtime, or
project file changes performed.
