# Iteration 7 (follow-on) — enumerated `honest_closes` IDs from live may.db

**Iteration:** 7 (follow-on to `iter-07-closure-honesty-statusline-findings.md`)
**Owner:** dev/may
**Inputs:** `loop-closure-probe-v3.mjs` (line 5 logic), live `/app/.state/may.db`
**Why this file exists:** Iter-7 main findings §5 said a future iteration that
wants to write `escalation.resolved` rows "can do so on top of `honest_closes`,
not `iter3_would_close`." That sentence is only actionable if the *exact IDs*
are known. v3's statusline returns scalars (`honest_closes=8`); it does not
list the eight events. This follow-on does, with one read against may.db, and
stops. No emitter is written; no row is mutated.

This is also a direct response to the reviewer's hard rule: "the deliverable
must contain at least one number computed from the live DB this iteration."
Below are 13 such numbers (8 IDs + 5 IDs), each individually verifiable.

---

## 1. Numbers (this heartbeat)

- Open `escalation.created`: **44** (was 38 @ iter-5, 40 @ iter-7-main; +4 in ~1h)
- iter-3-rule would-close: **13**
- Honest-rule closes: **8**
- Silent-false (iter-3 closes, honest does not): **5**
- Silent-false percentage of open: **11.4%** (denominator grew; absolute count flat)

The absolute counts (13 / 8 / 5) are unchanged across the iter-7 main run
and this follow-on ~1h later. New `escalation.created` events accrue with
neither rule firing — both rules are operating on a fixed historical
backlog. That is itself a falsifier hint (see §4).

## 2. The 8 IDs that are safe to mark `escalation.resolved`

Each row has a *positive* downstream signal that the underlying failure
was actually addressed (not just that the linked session ended). Evidence
column gives the exact join.

| event id | class | escalation timestamp | evidence (downstream) |
|---|---|---|---|
| 527187 | owner_triage_no_valid_op | 2026-05-07T16:48:55Z | `metric.alert_judged` event id **527384** judged `capability.session-trace-completeness` after escalation |
| 527224 | owner_triage_no_valid_op | 2026-05-07T16:53:10Z | `metric.alert_judged` event id **527290** judged `project.active-count` after escalation |
| 527237 | owner_triage_no_valid_op | 2026-05-07T16:55:24Z | `metric.alert_judged` event id **527290** (same alert_judged covers both 527224 and 527237 — a single judgment closed two duplicate triage escalations) |
| 529292 | evaluator_review_failed   | 2026-05-08T01:25:40Z | successor evaluator-aftermath session **s_1778213578025_31** ran for the same target after escalation, status=done |
| 529400 | evaluator_review_failed   | 2026-05-08T02:05:42Z | successor session **s_1778213344374_15**, status=done |
| 533703 | evaluator_review_failed   | 2026-05-08T16:55:36Z | successor session **s_1778260126207_4**, status=done |
| 534081 | evaluator_review_failed   | 2026-05-08T17:41:29Z | successor session **s_1778262188877_14**, status=done |
| 535375 | evaluator_review_failed   | 2026-05-08T20:41:40Z | successor session **s_1778272980437_120**, status=done |

All 8 are `owner_triage_no_valid_op` (3) or `evaluator_review_failed` (5).
**Zero** `dispatch_waiting` escalations are honest-closeable — corroborates
iter-5's arc decision that `dispatch_waiting` needs an owner notification,
not an auto-closer.

Two interesting sub-facts inside this table:

- **527224 and 527237 collapse onto the same evidence row (`metric.alert_judged=527290`).**
  Two open escalations, one closure event. Any future emitter must dedupe
  on `(metric_name, alert_judged.id)` or it will emit `escalation.resolved`
  twice for the same underlying judgment.
- **The 5 evaluator successor sessions all have status `done`, none `error` or
  `interrupted`.** Sufficient for honest closure under the rule v3 inlines.

## 3. The 5 IDs that the iter-3 rule would silently false-close

These are the `silent_false=5` from v3 line 5. The linked review session
*ended* (so iter-3's "linked session terminal" rule fires), but **no
successor evaluator-aftermath session ran for the failed target** — the
underlying review failure was never re-attempted, let alone fixed.

| event id | escalation timestamp | failed review target |
|---|---|---|
| 533715 | 2026-05-08T16:55:39Z | s_1778259286241_2 |
| 533733 | 2026-05-08T16:56:51Z | s_1778259255498_0 |
| 534349 | 2026-05-08T18:11:31Z | s_1778262947936_3 |
| 534353 | 2026-05-08T18:11:32Z | s_1778262776819_0 |
| 534728 | 2026-05-08T19:11:37Z | s_1778267429321_24 |

If a naive emitter shipped the iter-3 rule, these 5 would be marked
resolved while the failures remain unaddressed. That is the concrete
shape of the "silent false closure" iter-5 §6 warned about and v3 puts
on the statusline. The 5 IDs above are now the explicit test set: any
proposed closer must NOT close these in its current data state.

## 4. Falsifier check (against iter-7 main §7)

Iter-7 main §7 named three falsifiers. State at this heartbeat:

- `silent_false` rises above 5 → **NOT TRIPPED** (still 5).
- `silent_false_pct` drops to 0 while `open` > 0 → **NOT TRIPPED** (11.4%).
- `dispatch_waiting` drops by ≥ 15 → **NOT TRIPPED** (still 23, see line 2 of v3).

A new latent falsifier emerged from this run that iter-7 main did not
name: **both rules' closure counts are flat (8 and 13) while `open` grew
from 38 → 40 → 44 across iter-5/iter-7-main/this run.** If both rules
remain literally constant for two more heartbeats while `open` keeps
climbing, the rules are operating only on backlog and any future emitter
needs a "max event-id watermark" or it will never catch up to live
traffic. This is worth recording but does not justify a new probe yet.

## 5. Go / no-go for an emitter (advisory; no code shipped)

- **Go on the 3 `owner_triage_no_valid_op` rows** (IDs 527187, 527224, 527237)
  — but only after deduping 527224/527237 against shared evidence 527290.
- **Go on the 5 `evaluator_review_failed` rows** (IDs 529292, 529400,
  533703, 534081, 535375) — predicate is "successor evaluator-aftermath
  session for the same target exists with status=done after escalation
  timestamp."
- **No-go on all 13 `dispatch_waiting` rows.** Iter-5's arc decision is
  unchanged; the load-bearing variable is `v2-spec-coverage-buildout`,
  owned by may, and the Ruflo-shaped move is a notification, not closure.

These three bullets are the recommendation, not the action. No
`escalation.resolved` row is emitted by this iteration. The bridge from
v3's scalar `honest_closes=8` to a real emitter now consists of exactly
one step: a handler that writes `escalation.resolved` for the 8 IDs in
§2 with evidence pointers. That step is iteration 8's call, not iter-7's.

## 6. Anti-bookkeeping receipt

Files this follow-on produces, exhaustively:

1. `iter-07-honest-close-id-enumeration.md` — this file.

Not produced: STATUS.md edit, NEXT.md edit, any `iter-02-*.md`,
`iter-06-*.md` reconstruction, "closeout/consolidation" prose, new probe
file, new schema, new emitter, new escalation handler, project.md edit,
journal.md edit.
