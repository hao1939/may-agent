# Iteration 7 (follow-on #3) — invariant check executed; predicate is correct *and* incomplete

**Iteration:** 7 (follow-on to `iter-07-falsifier-tripped-rule-tightening.md`)
**Owner:** dev/may
**Inputs:**
- `iter-07-predicate-invariant-check.mjs` (this file's evaluator; runnable, read-only)
- live `/app/.state/may.db`
- `iter-07-falsifier-tripped-rule-tightening.md` §4 (the predicate under test)
- `iter-07-honest-close-id-enumeration.md` §2/§3 (the must-close / must-not-close test set)

**Why this file exists:** the prior iter-7 follow-on shipped a predicate
spec for iter-8 plus a 14-row frozen test set, and stopped. This run
*executes* both against live may.db so iter-8 inherits a verified
invariant check (or a documented violation) instead of a markdown
specification. The deliverable is not prose; it is a re-runnable script
plus the one number it produced (`violations=0`) and the one new bug
it surfaced (a regex gap that hides one currently-pending escalation).

**Forbidden by accumulated anti-scope:** new `iter-02-*.md`, STATUS/NEXT
edits, schema changes, "closeout/consolidation" prose, files whose body
is "no new judgment," any actual `escalation.resolved` write, any new
v4 statusline probe.

---

## 1. The invariant check (run this heartbeat)

```
$ node iter-07-predicate-invariant-check.mjs
# iter-7 predicate invariant check  (db=/app/.state/may.db)

MUST-CLOSE (expect close=true):
  527187  klass=owner_triage_no_valid_op  close=true  OK   alert_judged=527384
  527224  klass=owner_triage_no_valid_op  close=true  OK   alert_judged=527290
  527237  klass=owner_triage_no_valid_op  close=true  OK   alert_judged=527290
  529292  klass=evaluator_review_failed   close=true  OK   successor=s_1778213578025_31
  529400  klass=evaluator_review_failed   close=true  OK   successor=s_1778213344374_15
  533703  klass=evaluator_review_failed   close=true  OK   successor=s_1778260126207_4
  534081  klass=evaluator_review_failed   close=true  OK   successor=s_1778262188877_14
  535375  klass=evaluator_review_failed   close=true  OK   successor=s_1778272980437_120
  -> MUST-CLOSE: 8/8 OK

MUST-NOT-CLOSE (expect close=false):
  533715  klass=evaluator_review_failed   close=false  OK   no successor done
  533733  klass=evaluator_review_failed   close=false  OK   no successor done
  534349  klass=evaluator_review_failed   close=false  OK   no successor done
  534353  klass=evaluator_review_failed   close=false  OK   no successor done
  534728  klass=evaluator_review_failed   close=false  OK   no successor done
  536467  klass=owner_triage_no_valid_op  close=false  OK   reason pattern miss   ← suspect
  -> MUST-NOT-CLOSE: 6/6 OK

SUMMARY: violations=0 missing=0
RESULT: PASS — iter-8 predicate is safe to ship against this fixed test set.
```

14/14 rows agree with their frozen labels. By the iter-7-falsifier §4
rule ("if they don't [hold by construction], the predicate is wrong"),
no further specification work is required for the *5 evaluator_review
+ 3 owner_triage cases the test set covers*. Iter-8 can ship the
predicate against those, today.

## 2. The one row that "passed" for the wrong reason — 536467

The 5 evaluator-review rows in MUST-NOT-CLOSE pass for the right reason
(`no successor done`). Row **536467** passes with `reason pattern miss`
— i.e. the predicate's regex never matched, so it defaulted to "do not
close," accidentally satisfying the invariant. That is not a true
negative; it is a regex gap.

Direct query against may.db:

```sql
-- the reason text on 536467
SELECT json_extract(data,'$.reason') FROM events WHERE id=536467;
-- "Owner triage session failed for session.failed-triage-rate-3h"

-- iter-8 predicate's regex for owner_triage_no_valid_op:
--   /Owner triage for ([\w.\-]+) /
-- This does NOT match "Owner triage session failed for ...".
```

And the underlying state contradicts the iter-7-falsifier §2 claim that
this row is a true silent-false. Two later `metric.alert_judged` events
exist for the same metric **after** the escalation timestamp:

| event id | timestamp                | operation               |
|---------:|--------------------------|-------------------------|
| 536906   | 2026-05-08T23:42:40Z     | `upgrade_or_escalate`   |
| 537092   | 2026-05-09T00:12:44Z     | `calibrate_metric`      |

Under a *correctly-specified* honest rule for `owner_triage_no_valid_op`
(any later `metric.alert_judged` for the same metric), 536467 should
be closed. It belongs in MUST-CLOSE, not MUST-NOT-CLOSE.

So the iter-7-falsifier §2 conclusion that "the silent-false pattern is
not specific to evaluator-review escalations; it is specific to using
'any terminal session' as the closure predicate" was reached from an
artifact of the regex, not from data. The actual silent-false set at
this heartbeat is back to the 5 evaluator-review rows. The
"falsifier-tripped" alarm in `iter-07-falsifier-tripped-rule-tightening.md`
fired on noise.

## 3. The two corrections this lands for iter-8

1. **Broaden the `owner_triage_no_valid_op` classifier and metric extractor.**
   Live may.db today contains at least two reason templates for this class:
    - `Owner triage for <metric> did not produce a valid METRIC_ALERT_OPERATION`
    - `Owner triage session failed for <metric>`
   The iter-8 predicate must match both, e.g.:
   ```
   /Owner triage(?: session failed| for) (?:for )?([\w.\-]+)/
   ```
   or (cleaner) replace the classifier text-parse with a structured read
   of `events.data.context.metricId` if the emitter populates it; otherwise
   keep the regex but cover both forms.

2. **Update the frozen test sets before shipping.** With the corrected
   regex applied to current may.db state:
    - MUST-CLOSE becomes **9 IDs**: the original 8 plus **536467**
      (covered by `metric.alert_judged=536906`).
    - MUST-NOT-CLOSE becomes **5 IDs**: 533715, 533733, 534349, 534353,
      534728. (Drop 536467; it was mis-labeled.)

   The iter-7-falsifier §4 invariants must be re-asserted against these
   corrected sets before any emitter ships.

## 4. What `closure-honesty` line in v3 is actually saying

The v3 statusline at this heartbeat reports `silent_false=6` because v3
inlines the same `classify` function the iter-8 predicate copied. So
v3's count is also inflated by one for the same regex reason. The fix
in §3 above, when applied to v3's `classify`, will return v3 to
`silent_false=5` and `honest_closes=9` without changing any other
scalar. That edit is *not* made here — `loop-closure-probe-v3.mjs` is
not modified — because the iter-7 main §6 anti-bookkeeping receipt
forbade reshipping the probe absent a new question, and the question
this iteration answered is "does the predicate hold," not "should v3
get a v4."

If a future heartbeat does ship a v4, the one-line diff is exactly the
regex from §3. Nothing else.

## 5. Falsifiers re-checked (against iter-7-main §7)

State at this heartbeat (from §1 run + db queries):

- `silent_false` rises above 5 → **NOT TRIPPED.** The apparent rise to
  6 in `iter-07-falsifier-tripped-rule-tightening.md` was a regex
  artifact (§2). Real value is 5.
- `silent_false_pct` drops to 0 while `open` > 0 → **NOT TRIPPED.**
- `dispatch_waiting` drops by ≥ 15 → **NOT TRIPPED.** Open `dispatch_waiting`
  count from §1 db query: **28** (still climbing; iter-5's arc proposal
  observable success signal has not fired).

Net: the iter-7-main §7 falsifiers are all in the "no action" branch
once the regex bug is corrected.

## 6. Concrete iter-8 hand-off (advisory; nothing emitted here)

Iter-8 inherits, in priority order:

1. **A passing invariant check** (`iter-07-predicate-invariant-check.mjs`,
   re-runnable, exit 0 = safe). Use it as a CI-style gate before
   shipping any `escalation.resolved` emitter.
2. **A regex correction** (§3 item 1) that must be applied to the
   predicate before iter-8 widens MUST-CLOSE.
3. **Updated frozen test sets** (§3 item 2): 9 must-close, 5 must-not-close.
4. **A consistent v3 update path** (§4): one regex line, no schema, no
   new file, no statusline redesign.

The bridge from "v3 prints `honest_closes=N`" to a real
`escalation.resolved` writer is now an emitter that:

- iterates open `escalation.created` rows,
- runs the (corrected) predicate,
- writes one `escalation.resolved` event per closing row with `data.escalationId`
  pointing back at the original `events.id`,
- dedupes on `(class, target, evidence_event_id)` per
  `iter-07-honest-close-id-enumeration.md` §2 (the 527224/527237 case).

That is the iter-8 unit of work. Iter-7 stops here.

## 7. Anti-bookkeeping receipt

Files this follow-on produces, exhaustively:

1. `iter-07-predicate-invariant-check.mjs` — runnable, read-only, exits
   0 on PASS / 1 on FAIL; deletable in one move.
2. `iter-07-invariant-check-findings.md` — this file.

Not produced: STATUS.md edit, NEXT.md edit, project.md edit, journal.md
edit, any `iter-02-*.md`, `iter-06-*.md` reconstruction,
"closeout/consolidation" prose, v4 probe, new schema, new emitter, new
escalation handler.
