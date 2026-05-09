# Iteration 4 — Dispatch-waiting closure: empirical falsification of iter-3

**Date:** iter 4
**Owner:** dev/may (per NEXT.md §4 — but this is a measurement-only artifact;
no STATUS/NEXT edits)
**Inputs:** live `/app/.state/may.db`, this dir's
`iter-04-dispatch-waiting-join-probe.mjs`,
`iter-03-escalation-closure-findings.md` §3–§5.
**Forbidden by iter-2 anti-scope:** new `iter-02-*.md`, STATUS/NEXT edits,
schema changes, "closeout/consolidation" prose. Producing **a number from
may.db that contradicts the previous iteration's prose** is exactly what
iter-2's anti-pattern note said should happen this iteration.

---

## 1. The iter-3 claim being tested

> "**dispatch_waiting … derivable_now = 0** … the escalation payload omits
> projectId; only summary count of `projects.status='waiting'` is observable"
> — `iter-03-escalation-closure-findings.md` §3

> "The smallest concrete change … include `projectId` in the escalation
> payload … [t]he probe's `dispatch_waiting.derivable_now` will jump from 0
> to ~17/19" — §5

This iteration tests whether the producer-side patch is actually required to
make the join writable, or whether **iter-3 missed an existing recovery
path** in the data that's already on disk.

## 2. The recovery path iter-3 missed

`workflow_runs` rows record the dispatch's `task` string verbatim, including
`project: /app/agents/shared/projects/<id>`. The escalation event timestamps
align with those runs' `startedAt` to sub-50-ms precision. So the join
**(events.timestamp ↔ workflow_runs.startedAt within ±50 ms,
workflow='master-worker', extract project id from task)** recovers the
project key without any code change.

## 3. Numbers (regenerable; this snapshot iter-4)

```
class                 total_open  derivable_now (iter-3)  derivable_now (iter-4)
────────────────────  ──────────  ──────────────────────  ──────────────────────
dispatch_waiting              20                       0                      20
                                                                  ratio = 1.00
```

Iter-3's recommendation was: **"single-line patch at master-worker.ts L515-518
to include `projectId`."** Iter-4 finding: **the patch is not required for
measurement.** The key was already on disk in a sibling table; iter-3 did
not run the join.

## 4. The new uncomfortable number iter-4 surfaces

```
closure_eligible_now = 0  (ratio 0.00)
still_waiting_now    = 20
```

Every one of the 20 dispatch_waiting escalations resolves to a *pair* of
candidate projects (because master-worker dispatches batched runs that all
start within the same millisecond):

```
unique candidate-project sets observed across the 20 escalations:
  {closed-loop-reliability, v2-spec-coverage-buildout}      11 escalations
  {v2-spec-coverage-buildout, closed-loop-reliability}       (same set, ordering noise)
  {evaluator-low-quality-rate-calibration, v2-spec-buildout} 2 escalations
  {v2-spec-coverage-buildout}                                 7 escalations
```

In every set, **at least one project is `v2-spec-coverage-buildout`, which
is currently `status='waiting'`**. Under the conservative closure rule
("close only if no paired project is still waiting"), 0/20 escalations are
closable today — *not* the ~17/19 iter-3 hypothesised.

## 5. What this changes about the iter-3 conclusion

Iter-3 §4 said **"neither A nor B"** — closure for the derivable classes is
a read, not a write. Iter-4 confirms the read works *and* widens the
statement: it works for the dispatch_waiting class too. **All 32→35 open
escalations are derivable today. Zero require schema or table changes.**

But iter-3 §5's predicted post-patch number (17/19 closable) was **wrong by
construction**, because the underlying truth on disk is "of every batched
dispatch in the snapshot window, at least one paired project was the
chronically-waiting `v2-spec-coverage-buildout`." The escalation rate is
therefore **not** noise from a missing emitter field. It is a real signal
about one specific project that has been stuck in `waiting` long enough to
keep generating escalations every dispatch cycle.

## 6. Implication for the Ruflo discipline

Ruflo's idea (per `ruflo-feature-map.md`): every subsystem dumps cheap
state; one composable script reads. Iter-3 honoured the first half but
violated the second by *not running the read it had access to* before
recommending a write to the producer. Iter-4 ran the read.

Lesson the loop should keep:

> Before recommending an emitter / schema / payload change to "make state
> visible," run the strongest available read against existing tables. If
> any join recovers the key, the right answer is *don't change the
> emitter* — it changes the question from "is the data there?" to "is the
> ground-truth condition satisfied?", which is the harder and more useful
> question.

For `dispatch_waiting`: that harder question is now answerable, and its
answer is *no, 20 escalations correctly point at one chronically-waiting
project.* The remediation is therefore not on the master-worker emitter at
all; it is on whatever owns `v2-spec-coverage-buildout`.

## 7. Anti-bookkeeping receipt

This iteration produces **two artifacts and exactly one new claim from the
DB**:

1. `iter-04-dispatch-waiting-join-probe.mjs` — runnable, regenerable.
2. `iter-04-dispatch-waiting-findings.md` — this file.

No new `STATUS.md`, no `NEXT.md`, no `iter-02-*.md`, no "closeout."

## 8. Raw probe summary line (snapshot)

```
{"summary":true,"class":"dispatch_waiting","total_open":20,
 "derivable_via_workflow_runs_join":20,"closure_eligible_now":0,
 "still_waiting_now":20,"join_window_ms":50,"ratio_derivable":1,
 "ratio_closure_eligible":0,
 "iter3_claim_was":"derivable_now=0 (payload omits projectId)",
 "iter4_finding":"iter3 claim falsified: workflow_runs.task supplies the missing key"}
```

Re-run any time:

```
node /app/agents/shared/projects/ruflo-learning-loop/outputs/iter-04-dispatch-waiting-join-probe.mjs
```
