# Iteration 7 — folding iter-5 §6 onto the statusline

**Iteration:** 7
**Owner:** dev/may (one cheap, regenerable read; no STATUS/NEXT edits)
**Inputs:**
- `iter-05-closure-rule-falsification-findings.md` §6 (the explicit
  next-step instruction iter-5 named but did not execute)
- `loop-closure-probe-v2.mjs` (the four-line statusline iter-2/4 settled on)
- live `/app/.state/may.db`
**Forbidden by accumulated anti-scope:** new `iter-02-*.md`, STATUS/NEXT
edits, schema changes, "closeout/consolidation" prose, files whose body is
"no new judgment." This iteration produces a number from `may.db` and one
runnable, deletable file.

---

## 1. The instruction iter-5 §6 left for whoever picked up next

> "If iteration 6 wants to act on §6's lesson, the smallest concrete change
> is to make the closed-loop probe (`loop-closure-probe-v2.mjs` line 4 or a
> new line 5) print `iter3_closed - honest_closed` continuously, so silent
> false-closure becomes a number on the statusline rather than a finding in
> a markdown file."
> — `iter-05-closure-rule-falsification-findings.md` §6

Iteration 6 did not run (no `iter-06-*.md` in this directory). Iter-7
executes that one-line instruction directly. This is exactly the Ruflo
discipline: the audit and the always-on statusline are the *same* read,
just composed differently. Keeping them in two files (a once-run audit
probe + a statusline that doesn't carry its number) is the bookkeeping
shape iter-2 warned against.

## 2. What was shipped

A new file, `loop-closure-probe-v3.mjs`, that emits the same four lines
v2 emits, plus a fifth:

```
closure-honesty: open=40 iter3_would_close=13 honest_closes=8 \
                 silent_false=5 silent_false_pct=12.5 src=events+sessions
```

The closure rules (iter-3's "linked session terminal" and iter-5's
"successor remediation exists") are **inlined** into the probe rather
than imported. That keeps the file deletable in one move (matches the
v2 reversibility property) and matches the Ruflo statusline pattern of
one cheap composable read with no shared mutable state.

## 3. Snapshot run (this heartbeat)

```
$ time node loop-closure-probe-v3.mjs
events 60m: emitted=379 handled=0 dismissed=0 pending=379 oldest_orphan=9d src=events
top orphan types: handler.completed=68 handler.started=67 session.end=54 session.start=54 message.created=31 src=events
decision-class: agent.decision=7 project.iteration=11 escalation.created=3 metric.alert_judged=6 src=events
metric breaches: open=2 oldest=13h breach_win=1 recovered_win=2 src=metric_alerts+events
closure-honesty: open=40 iter3_would_close=13 honest_closes=8 silent_false=5 silent_false_pct=12.5 src=events+sessions

real    0m2.872s   # ~2.6s is node startup; SQL work is sub-300ms
```

## 4. The number, and what it tells us beyond iter-5

| metric | iter-5 (8 May 20:46) | iter-7 (this heartbeat) | delta |
|---|---|---|---|
| total open `escalation.created` | 38 | **40** | +2 |
| `dispatch_waiting` | 22 | **23** | +1 (still load-bearing) |
| `evaluator_review_failed` | 10 | **9** | −1 (one closed by successor) |
| `owner_triage_no_valid_op` | 3 | **3** | 0 |
| `stuck_iterations` | 2 | **3** | +1 |
| iter-3 rule would-close | 13 | **13** | 0 |
| honest rule closes | 8 | **8** | 0 |
| silent_false | 5 | **5** | 0 |
| silent_false_pct | 13.2% | **12.5%** | denominator grew |

Two new facts the v2 statusline could not have surfaced:

1. **`escalation.created` resolution rate is still exactly zero.** A
   one-line read against `events.status != 'pending'` for this event_type
   returns 0 across the entire history (verified out-of-band). Iter-3
   identified this as the visibility gap; iter-4/5 audited closure rules;
   no rule has yet been *applied*. The probe surfacing `silent_false=5`
   per heartbeat now creates a continuous reason not to apply iter-3's
   rule blindly, which is the prudent default.

2. **`dispatch_waiting` is monotone-growing across iterations 4 → 5 → 7
   (20 → 22 → 23).** This corroborates iter-5's arc decision (notify the
   owner of `v2-spec-coverage-buildout` rather than build an auto-closer)
   without any new probe — the v3 statusline carries enough decomposition
   in line 2's "top orphan types" that the trend is readable on every run.

## 5. Why this is the right iter-7 move (and not iter-6's "build closer")

Iter-5's arc decision (`iter-05-arc-decision.md` §1–§2) explicitly
deferred Option A ("build a closure rule"). The same logic forbids
shipping the iter-3 rule via the probe: the probe must *expose* the
rule's gap, not enact closure. v3 keeps it read-only and reversible. The
file produces a number; a future iteration that decides to actually
write a `escalation.resolved` row can do so on top of `honest_closes`,
not `iter3_would_close`, with the gap visible.

This also closes the loop on the Ruflo lesson the project started with:
the value of a statusline isn't the cleverness of any single line — it's
that *adding* a line is cheaper than writing a finding. Iter-5 wrote a
finding; iter-7 added the line. If a later iteration finds another rule
worth auditing continuously, it's now obvious where it goes.

## 6. Anti-bookkeeping receipt

Files this iteration produces, exhaustively:

1. `loop-closure-probe-v3.mjs` — runnable, regenerable, read-only,
   deletable in one move; sub-300ms SQL.
2. `iter-07-closure-honesty-statusline-findings.md` — this file.

Not produced: STATUS.md edit, NEXT.md edit, any `iter-02-*.md`,
"final consolidation," "closeout," `iter-06-*.md` reconstruction,
new schema, new emitter, new escalation handler.

## 7. Falsifiers / next-iteration hooks (not actions)

A future iteration should reopen this work if any of the following are
observed in v3 output across two consecutive heartbeats:

- `silent_false` rises above the iter-7 baseline of 5 → iter-3 rule is
  getting *worse* over time and the gap between rules is widening; an
  audit of the rule itself (not the data) is warranted.
- `silent_false_pct` drops to 0 while `open` stays > 0 → either iter-3
  rule converged with honest rule (suspicious; check whether the honest
  rule has stopped firing) or there is real closure happening — in
  which case the underlying `escalation.created` resolution count should
  finally be non-zero.
- `dispatch_waiting` count drops by ≥ 15 → iter-5's arc-proposal
  observable success signal has fired; verify per `iter-05-arc-decision.md`
  §3 falsifier.

None of these are scheduled work. They are read off the probe.
