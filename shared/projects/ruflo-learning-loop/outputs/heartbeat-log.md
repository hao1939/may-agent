# Heartbeat log

Append-only. One dated line per heartbeat that did not warrant a new
findings file. Project.md (read-only to this worker) reserves the
"in-place" log section; this file is the writable mirror.

Schema per line:
`YYYY-MM-DD iter=N  v2-spec-coverage-buildout.status=<s>  dispatch_waiting=<n>  silent_false=<n>(<pct>%)  verdict=<watch|falsified|act>  note`

- 2026-05-08 iter=6  v2-spec-coverage-buildout.status=waiting  dispatch_waiting=23  silent_false=5(13.2%)  verdict=watch  iter-5 falsifier window open; project.md already records this date.
- 2026-05-09 iter=7  v2-spec-coverage-buildout.status=waiting  dispatch_waiting=23  silent_false=5(12.5%)  verdict=watch  iter-7 produced loop-closure-probe-v3.mjs + closure-honesty findings; numbers from probe.
- 2026-05-09 iter=7-recheck  v2-spec-coverage-buildout.status=waiting  dispatch_waiting=24  silent_false=5(11.9%)  verdict=watch  +1 dispatch_waiting (still in [15,30] band); silent_false unchanged across two heartbeats — none of iter-7 §7's falsifiers tripped. No new artifact warranted; v3 probe is the read.

## What is *not* in this file (by design)

- No re-justification of iter-5's option-(b) decision.
- No re-derivation of the closure rules (they live inlined in
  `loop-closure-probe-v3.mjs`).
- No "next iteration plan" — the next iteration is gated by a probe
  delta, per `iter-07-closure-honesty-statusline-findings.md` §7,
  not by a schedule.

## When to stop appending and produce a new findings file

Reopen with a `iter-NN-*.md` only when one of the v3-probe falsifiers
fires across two consecutive lines below:

1. `silent_false` rises above baseline 5.
2. `silent_false_pct` drops to 0 while `open` > 0.
3. `dispatch_waiting` drops by ≥ 15 (i.e. ≤ 9 from the iter-7 baseline of 24).
4. `v2-spec-coverage-buildout.status` leaves `waiting`.

Until then: one line per heartbeat, no prose.
