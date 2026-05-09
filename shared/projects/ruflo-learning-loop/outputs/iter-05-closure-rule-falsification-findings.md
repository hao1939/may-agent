# Iteration 5 — Closure-rule falsification: applying iter-4's discipline to the other classes

**Date:** iter 5
**Owner:** dev/may (measurement-only artifact; no STATUS/NEXT edits)
**Inputs:** live `/app/.state/may.db`, this dir's
`iter-05-closure-rule-falsification-probe.mjs`,
`iter-03-escalation-closure-findings.md` §3,
`iter-04-dispatch-waiting-findings.md` §6.
**Forbidden by iter-2 anti-scope:** new `iter-02-*.md`, STATUS/NEXT edits,
schema changes, "closeout/consolidation" prose, files whose body is "no new
judgment." This file produces a number from `may.db` that contradicts an
earlier iteration's prose, which is exactly what iter-2's anti-pattern note
said the next step should look like.

---

## 1. The thing iter-4 *didn't* finish

Iter-4 wrote a thirty-line lesson:

> "Before recommending an emitter / schema / payload change to 'make state
> visible,' run the strongest available read against existing tables. …
> [t]he harder question iter-3 had access to but did not ask."
> — `iter-04-dispatch-waiting-findings.md` §6

Then it applied that discipline to **one** of iter-3's five classes
(`dispatch_waiting`) and stopped. Iter-3's other "derivable now" claims —
`evaluator_review_failed` (8) and `owner_triage_no_valid_op` (3) — were
left standing without a join check. That's the same anti-pattern iter-3
was guilty of, just at a smaller scale.

Iter-5 runs the same join check on those classes.

## 2. The exact iter-3 claim being tested

> `evaluator_review_failed`: closure derivable from
> `sessions.status terminal on data.context.reviewSessionId`,
> derivable_now = 8.
>
> `owner_triage_no_valid_op`: closure derivable from
> `sessions.status terminal on data.context.ownerSessionId`,
> derivable_now = 3.
> — `iter-03-escalation-closure-findings.md` §3

Iter-3's rule, transcribed into one line: **"the linked session is in a
terminal status (`done`/`error`/`interrupted`) ⇒ the escalation is
resolved."**

## 3. Why iter-3's rule is suspect on its face (which a reader could catch
without code, but iter-3 didn't)

For `evaluator_review_failed`, the linked review session reaches terminal
status `error` *because of the failure that caused the escalation*. The
session being terminal isn't evidence the failure was resolved — it's
evidence the failure happened. iter-3 conflated "session reached an end
state" with "underlying problem is closed."

For `owner_triage_no_valid_op`, the owner session reaches terminal status
`done` precisely because the owner finished without producing a valid
operation. Same conflation.

The test below runs both rules side by side: iter-3's rule, and an
"honest" rule that actually checks whether the failure was later
remediated. The honest rule for each class:

| class | honest closure condition |
|---|---|
| `evaluator_review_failed` | a *successor* review session for the same reviewed sessionId, started **after** the escalation, ended `done` |
| `owner_triage_no_valid_op` | a `metric.alert_judged` event for the same metric_id with `timestamp > escalation.timestamp` |
| `dispatch_waiting` | (covered by iter-4: 0/22) |

## 4. Numbers from `iter-05-closure-rule-falsification-probe.mjs`

```
class                          open  iter3_closed  honest_closed  silent_false_closures
─────────────────────────────  ────  ────────────  ─────────────  ─────────────────────
evaluator_review_failed          10            10              5                      5
owner_triage_no_valid_op          3             3              3                      0
dispatch_waiting                 22             0              0                      0
stuck_iterations                  2             0              0                      0
other                             1             0              0                      0
─────────────────────────────  ────  ────────────  ─────────────  ─────────────────────
TOTAL                            38            13              8                      5
```

Headline:

```
{"summary":true,"total_open":38,"iter3_rule_would_close":13,
 "honest_rule_closes":8,"iter3_false_closure_rate":0.132}
```

So iter-3's published rule, applied today, would silently mark
**5 / 38 = 13.2 %** of currently-open escalations as resolved while the
underlying failure is still live (5 reviewed sessions whose evaluator
review crashed and was *never* re-attempted by a successor review).

This is a worse failure mode than the iter-3 dispatch_waiting error.
Iter-4's surprise was "iter-3 over-promised closure"; iter-5's finding is
"iter-3's rule would have **fabricated** closure."

## 5. The two classes split, instructively

- `owner_triage_no_valid_op` (3/3): iter-3's rule and the honest rule
  agree. Every owner session that finished without a valid op was followed
  by a real `metric.alert_judged` for the same metric_id. iter-3 happened
  to be right here, but **for the wrong reason** — its rule keys on the
  *failed* session's terminal status, not on the *successful* downstream
  judgment that actually closed the loop. The agreement is coincidence.

- `evaluator_review_failed` (5/10): iter-3's rule and the honest rule
  disagree on half the population. Five reviewed sessions were never
  successfully re-reviewed; iter-3 would have closed those escalations
  anyway because the original (crashed) review session is `status=error`,
  i.e. terminal.

Representative honest-rule disagreement (raw probe output):

```
{"class":"evaluator_review_failed","escId":"esc_1778203540861",
 "reviewSessionId":"s_1778203540602_151","review_status":"error",
 "iter3_says_closed":true,"honest_says_closed":true,
 "honest_why":"successor review s_1778213578025_31 done at 1778213578026"}
```

(That one *did* get re-reviewed — five others did not. See raw output
section §8 for the disagreeing rows.)

## 6. What this changes about the cumulative picture

Aggregating iter-3 + iter-4 + iter-5:

| iteration | claim | closure-eligible today | actual |
|---|---|---|---|
| iter-3 | 11/32 derivable now via session terminal join | 11 | partly false: iter-3 rule has 13.2% silent false-closure |
| iter-3 | dispatch_waiting needs producer payload patch (→ ~17/19) | 17 | falsified by iter-4 (actual 0) |
| iter-4 | "all 32→35 open escalations are derivable today; zero require schema or table changes" | 35 | partly false: 5/38 require either a successor read (iter-5 honest rule) **or** stay open |

The Ruflo discipline ("subsystems dump cheap state; one composable script
reads") is not falsified by any of this — it survives all three
iterations. What's been falsified is the **specific closure rule** each
iteration shipped.

The lesson the loop should keep, refined past iter-4's version:

> **A "derivable closure" rule is not derived until you've enumerated the
> negative case.** "I can join to table X" is a feasibility claim. "If I
> apply this join the right rows close and the wrong rows don't" is the
> rule. Iter-3 stopped at the first; iter-4 ran the second on one class;
> iter-5 ran it on the rest. The probe to ship is the one that prints
> *both* `iter3_closed` and `honest_closed` so the gap is visible at every
> heartbeat — not just at the iteration that audits the rule.

## 7. Anti-bookkeeping receipt

Two artifacts:

1. `iter-05-closure-rule-falsification-probe.mjs` — runnable, regenerable,
   read-only, ~200 ms.
2. `iter-05-closure-rule-falsification-findings.md` — this file.

No `STATUS.md` edit, no `NEXT.md` edit, no `iter-02-*.md` reopen, no
"final consolidation," no "closeout-of-closeout."

If iteration 6 wants to act on §6's lesson, the smallest concrete change
is to make the closed-loop probe (`loop-closure-probe-v2.mjs` line 4 or a
new line 5) print `iter3_closed - honest_closed` continuously, so silent
false-closure becomes a number on the statusline rather than a finding in
a markdown file.

## 8. Raw probe output (snapshot iter-5)

```
{"class":"evaluator_review_failed","open":10,"iter3_closed":10,"honest_closed":5}
{"class":"owner_triage_no_valid_op","open":3,"iter3_closed":3,"honest_closed":3}
{"class":"dispatch_waiting","open":22,"iter3_closed":0,"honest_closed":0}
{"class":"stuck_iterations","open":2,"iter3_closed":0,"honest_closed":0}
{"class":"other","open":1,"iter3_closed":0,"honest_closed":0}
{"summary":true,"total_open":38,"iter3_rule_would_close":13,"honest_rule_closes":8,
 "iter3_false_closure_rate":0.132,
 "note":"iter3_false_closure_rate is the fraction of currently-open escalations that iter-3 rule would silently mark closed despite the failure condition still being live"}
```

Re-run any time:

```
node /app/agents/shared/projects/ruflo-learning-loop/outputs/iter-05-closure-rule-falsification-probe.mjs
```
