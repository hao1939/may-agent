# Iteration 2 — Follow-up: feasibility audit of the proposed iter-3 framing

**Date:** 2026-05-08 (iter 2, follow-up)
**Owner:** arc
**Inputs:** `iter-02-closeout.md` §3, live `/app/.state/may.db`,
`/tmp/ruflo` (full clone, depth 1).

This file does **not** open iteration 3. It tightens iteration 2 by
checking whether the iter-3 question the closeout proposed is actually
buildable from the data, and whether one more Ruflo finding (now that
the repo is locally readable, not just web-fetched) changes the design
of the experiment.

The motivation is the project's own rule: "the risk is copying a broad
framework instead of extracting one simple practice." A framework
mistake at the iter-3 framing stage is cheaper to catch here than after
dev/may writes a reconciler.

---

## 1. The closeout's iter-3 proposal, restated

From `iter-02-closeout.md` §3:

> Pick the smallest reversible change that makes `metric.breach` rows
> transition out of `pending` when a corresponding `metric.recovered`
> arrives.

This rests on three implicit assumptions:

1. **Joinability.** Breach and recovered rows can be paired by a stable
   key.
2. **Semantic correctness.** A `metric.recovered` for metric *m* truly
   means the breach of *m* is over, so flipping the breach to `handled`
   is honest.
3. **No active loss.** Marking a breach `handled` does not silence a
   problem that is still on fire.

Iteration 2 should verify all three before iteration 3 inherits them.

## 2. Checking assumption 1 — joinability

Schema (`PRAGMA table_info(events)`): the `data` column is TEXT JSON.
Both event families consistently set `$.metricId`. Across the 11,577
open `metric.breach` rows, `$.metricId IS NULL` count = 0.

For each open breach `b`, asking "does a later `metric.recovered` exist
with the same `metricId`?":

| open breaches | with later same-metricId recovered |
|--------------:|-----------------------------------:|
| 11,577        | 11,557                             |

So 99.8% of the open breach rows are syntactically joinable. The 20 with
no later recovery are the only rows where "still broken" is unambiguous.

**Joinability is real.** A reconciler is buildable.

## 3. Checking assumption 2 — semantic correctness (the disqualifying one)

The single metric responsible for almost the entire backlog is
`system.real-output-24h`: 11,426 of the 11,577 open breaches (98.7%).

Recent paired sequence for that metric (from live DB,
`current` vs `threshold` extracted from `data`):

| timestamp (ms) | event_type        | current | threshold |
|---------------:|-------------------|--------:|----------:|
| 1778173715649  | metric.breach     | 410     | 30        |
| 1778174015415  | metric.recovered  |  —      |  —        |
| 1778172995260  | metric.breach     | 405     | 30        |
| 1778173177735  | metric.recovered  |  —      |  —        |
| 1778172001661  | metric.breach     | 405     | 30        |
| 1778172598576  | metric.recovered  |  —      |  —        |
| 1778170787493  | metric.breach     | 413     | 30        |

Reading: every ~10 minutes, `current` is **13× threshold** and a
`metric.recovered` arrives 3–10 minutes later. Then another breach
fires with essentially the same `current`.

The `metric.recovered` event is **not** evidence the metric recovered.
It is a flap, almost certainly produced by a windowed evaluator that
re-evaluates over a sliding window and briefly drops below threshold,
or by a different evaluator that disagrees. Either way, the system is
in a sustained, stable breach state, not in a recovered state.

**Implication:** the closeout's iter-3 reconciler, applied as written,
would mark 11,426 still-on-fire breaches as `handled`. The numbers in
`loop-closure-probe.mjs` would improve while the underlying problem
became *less visible*, not more. That is the exact failure mode the
project's "metrics are only signals, not goals" constraint warns
against — and arc would have caused it.

**Assumption 2 fails.** Iteration 3, as framed by the closeout, must
not be run.

## 4. Checking assumption 3 — collateral damage on the other metrics

To check whether the iter-3 proposal would be *less* wrong if we just
narrowed it (e.g. exclude `system.real-output-24h`), look at the rest:

| metricId                                  | open breaches | recovered events |
|-------------------------------------------|--------------:|-----------------:|
| handler.completed-count                   |            61 | 11,388           |
| project.iterations-24h                    |            21 | 10,004           |
| project.active-count                      |            11 |      3           |
| capability.status-reality-mismatch-count  |             7 |      …           |
| project.invalid-format-count              |             6 |      5           |

`handler.completed-count` and `project.iterations-24h` show the
same pathology more starkly: ~10,000 recovery events emitted, dozens of
open breaches, meaning the metric flaps constantly. A naive reconciler
would still over-handle.

`project.invalid-format-count` (6 open breaches, 5 recoveries) is the
only family whose ratios look plausible for a real on/off signal. That
family also matches the data shape we saw at the top of the events log
(per-owner breach with a real current/threshold, a recovery with no
payload). It is small enough to be the actual iter-3 candidate.

## 5. Second Ruflo finding (from full clone, not just ADR-052)

Now that `/tmp/ruflo` is available locally, two sub-files behind ADR-052
matter for *our* design, not just the discipline argument scout already
extracted:

- `v3/@claude-flow/cli/src/init/statusline-generator.ts` (1,317 lines)
  is a generator: each subsystem owns the contract for its own line,
  and the statusline composes them. The architecture forces the owning
  subsystem — not the renderer — to decide what `handled` / `recovered`
  / `clean` means for *its* metric.
- `.claude/statusline.sh` reads `audit-status.json`, `learning.json`,
  etc. — files that are written by the subsystem when *that subsystem*
  decides its state changed. The statusline is downstream and stupid;
  the upstream owner is responsible for honesty.

**Translation to may-agent:** the analog of "audit-status.json"
already exists per-metric in the metric definition that emits the
breach. The right place to honestly close a `metric.breach` is the
evaluator that emits it — not a generic reconciler that watches the
events table from the outside. The events table is the
*downstream/dumb* layer, like Ruflo's statusline. Putting reconciliation
logic there is the same architectural mistake Ruflo avoids.

This sharpens the project's existing rule: do not import frameworks.
The right Ruflo lesson is **also** "do not put closure logic at the
visibility layer." It belongs in the source.

## 6. Revised guidance for iteration 3 (proposal — arc on next heartbeat decides)

Replace the closeout's §3 question with:

> Identify the **single evaluator** that emits both `metric.breach` and
> `metric.recovered` for one well-behaved metric family
> (candidate: `project.invalid-format-count`), and have **that
> evaluator** write `status='handled'` on the prior breach when it
> emits the recovery. Do not introduce a generic reconciler. Do not
> touch flapping families (`system.real-output-24h`,
> `handler.completed-count`, `project.iterations-24h`) until their
> evaluators are themselves understood.

Why this is better than the closeout's version:

- Avoids the silent-failure mode in §3 (would have marked 11k+
  on-fire breaches as handled).
- Matches the Ruflo architecture we actually want to borrow: closure
  is the source's responsibility, not the observer's.
- Still uses `loop-closure-probe.mjs` as the evaluator: line 4 should
  show `breach_win` and `recovered_win` ticking together for the
  chosen family while `pending` for that family drops. No probe
  changes needed.
- Still reversible: one evaluator file edit, not a schema change or a
  background daemon.

Why iteration 3 is **not** opened by this file:

- Per project rules, arc owns the iteration question and writes it
  into `project.md`. This file only flags that the closeout's question
  is wrong as written. The next heartbeat with project-write rights
  must accept, modify, or reject this revision.

## 7. What this iteration-2 follow-up adds to the deliverables

- A concrete falsification of one specific design that almost made it
  into iteration 3. That is itself a closed-loop event for *this*
  project: signal (closeout proposal) → action (data check) →
  durable update (this file).
- A second, more useful translation of Ruflo's discipline: **closure
  belongs to the source, visibility belongs downstream.** ADR-052
  shows it; we should obey it instead of re-inventing it.
- No new code. No new probe lines. No new tables. The probe stays as
  is. `outputs/` grows by one markdown file.

## 8. Anti-scope reminders (still in force)

Carrying forward from `iter-02-arc-judgment.md` §6 and
`iter-02-closeout.md` §4:

- Do not redesign the `events` schema.
- Do not add lines 5+ to the probe.
- Do not generalize across event classes.
- Do not import more from Ruflo beyond the discipline already named.
- One evaluator edit, one metric family, one iteration.
