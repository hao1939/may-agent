# Iteration 7 (follow-on #2) — falsifier tripped + rule-tightening discriminator

**Iteration:** 7 (follow-on to `iter-07-closure-honesty-statusline-findings.md`)
**Owner:** dev/may
**Inputs:**
- `loop-closure-probe-v3.mjs` (re-run this heartbeat)
- live `/app/.state/may.db`
- `iter-07-closure-honesty-statusline-findings.md` §7 (the three named falsifiers)
- `iter-07-honest-close-id-enumeration.md` §3 (the prior 5-row silent-false set)

**Why this file exists:** v3 was built so silent false-closure becomes a number
on every heartbeat rather than a one-shot finding. This heartbeat the number
*moved*, which trips the first falsifier iter-7 main §7 named. The point of
the falsifier was to force the *next* file when it tripped — not a STATUS
update, not a NEXT, but a one-shot delta record + the action it implies.

**Forbidden by accumulated anti-scope:** new `iter-02-*.md`, STATUS/NEXT
edits, schema changes, "closeout/consolidation" prose, files whose body is
"no new judgment," any actual `escalation.resolved` write.

---

## 1. The number that moved

```
$ node loop-closure-probe-v3.mjs    # this heartbeat
events 60m: emitted=427 handled=0 dismissed=0 pending=427 oldest_orphan=9d src=events
top orphan types: handler.started=68 session.start=68 handler.completed=67 session.end=66 message.created=33 src=events
decision-class: agent.decision=9 project.iteration=20 escalation.created=5 metric.alert_judged=6 src=events
metric breaches: open=5 oldest=15h breach_win=2 recovered_win=1 src=metric_alerts+events
closure-honesty: open=47 iter3_would_close=14 honest_closes=8 silent_false=6 silent_false_pct=12.8 src=events+sessions
```

| metric | iter-5 | iter-7-main | iter-7-enum | **this run** |
|---|---|---|---|---|
| open `escalation.created` | 38 | 40 | 44 | **47** |
| iter3_would_close | 13 | 13 | 13 | **14** |
| honest_closes | 8 | 8 | 8 | **8** |
| silent_false | 5 | 5 | 5 | **6** |

**Falsifier check (iter-7 main §7):**

- `silent_false` rises above 5 → **TRIPPED** (now 6). This file is the response.
- `silent_false_pct` drops to 0 while `open` > 0 → not tripped (12.8%).
- `dispatch_waiting` drops by ≥ 15 → not tripped (still climbing: 22 → 23 → **26**).

## 2. The new silent-false row, and what makes it new

The new sixth member of the silent-false set is **escalation id 536467**,
the first non-`evaluator_review_failed` member ever to appear in the set.
The prior five were all eval-review escalations whose review session merely
ended; this one is an `owner_triage_no_valid_op`.

```
id        : 536467
ts        : 2026-05-08T23:22:31Z
class     : owner_triage_no_valid_op
reason    : "Owner triage session failed for session.failed-triage-rate-3h"
ownerSess : s_1778282530172_275  (status=error, source=workflow:metric-alert-triage)
```

Cross-checks against may.db (this heartbeat):

- `metric.alert_judged` events for `session.failed-triage-rate-3h` after
  the escalation timestamp: **0**.
- Retry owner-triage sessions for that metric after the escalation: **0**.

So the underlying triage failure has not been re-attempted nor judged.
The iter-3 rule (any terminal status on the linked session) would mark
this resolved because `s_1778282530172_275.status='error'` is terminal —
exactly the silent false-closure shape. The honest rule (a later
`metric.alert_judged` for the same metric) correctly does not close it.

This corroborates the iter-7-enum §3 conclusion at a *different* class:
the silent-false pattern is not specific to evaluator-review escalations;
it is specific to using "any terminal session" as the closure predicate.

## 3. The discriminator (one extra read this heartbeat)

Splitting the iter-3 rule into two variants and re-running:

| variant | predicate | would_close | silent_false |
|---|---|---|---|
| iter3-loose (current rule) | linked session in `done`/`error`/`interrupted` | 14 | **6** |
| iter3-strict | linked session in `done` only | 3 | **0** |
| honest (v3 line 5) | downstream evidence: successor session `done` *or* later `metric.alert_judged` | 8 | n/a |

Two facts fall out of the table:

1. **Tightening the iter-3 rule from "any terminal" to "status=done only"
   eliminates the silent_false set entirely** (6 → 0) at this heartbeat.
   Every silent-false row had a linked session that ended in `error`,
   not `done`. That is the entire content of the bug.
2. **iter3-strict (3) is *not* a subset of honest (8).** Honest closes 5
   rows that iter3-strict doesn't (the eval-review cases where the
   linked review session itself ended `error` but a successor
   evaluator-aftermath ran to completion). So neither rule dominates
   the other; honest is the one with downstream evidence and is the
   defensible choice for a future emitter.

## 4. Concrete iter-8 hand-off (advisory; nothing emitted here)

The bridge from "v3 prints `honest_closes=8`" to a real `escalation.resolved`
emitter is now this small:

```
predicate(escalation e):
  if e.class == 'evaluator_review_failed':
    review = sessions[e.context.reviewSessionId]
    target = parse(review.task, /Review session aftermath for (s_\\d+_\\d+)/)
    return exists(sessions s where
      s.source = 'workflow:evaluator-aftermath'
      AND s.status = 'done'
      AND s.task LIKE '%' || target || '%'
      AND s.startedAt > e.timestamp)
  if e.class == 'owner_triage_no_valid_op':
    metric = parse(e.reason, /Owner triage for ([\\w.\\-]+) /)
    return exists(events ev where
      ev.event_type = 'metric.alert_judged'
      AND ev.timestamp > e.timestamp
      AND ev.data LIKE '%' || metric || '%')
  return false   // dispatch_waiting + stuck_iterations: no honest closer yet
```

Test set for iter-8 (must stay stable across two consecutive runs before
shipping any emitter):

- **8 must-close IDs** — see `iter-07-honest-close-id-enumeration.md` §2.
- **6 must-NOT-close IDs** — the silent-false set: 533715, 533733, 534349,
  534353, 534728, **536467** (newly added this heartbeat).

If iter-8 ships the predicate above, both invariants should hold by
construction. If they don't, the predicate is wrong — not the data.

## 5. What this iteration does NOT do

- Does not write `escalation.resolved` for any row.
- Does not modify `loop-closure-probe-v3.mjs`. The probe is already
  carrying the right scalars; tightening the rule is iter-8's call.
- Does not edit STATUS.md, NEXT.md, project.md, journal.md, or any
  other project's files.
- Does not produce a v4 probe. The "iter3-loose vs iter3-strict" split
  in §3 is a one-shot diagnostic, not a continuous reading. Adding a
  fourth scalar to v3's line 5 would be premature: there is currently
  one rule under audit, not two, and the right move (per honest closer
  in §4) is to retire iter3-loose, not to keep watching it forever.

## 6. Anti-bookkeeping receipt

Files this follow-on produces, exhaustively:

1. `iter-07-falsifier-tripped-rule-tightening.md` — this file.

Not produced: STATUS.md edit, NEXT.md edit, any `iter-02-*.md`,
`iter-06-*.md` reconstruction, "closeout/consolidation" prose,
new probe file, new schema, new emitter, new escalation handler,
project.md edit, journal.md edit.
