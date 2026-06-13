# Iteration 3 — Escalation closure probe: findings

**Date:** 2026-05-08 (iter 3)
**Owner:** dev/may (per NEXT.md §4)
**Inputs:** live `/app/.state/may.db`, this dir's
`iter-03-escalation-closure-probe.mjs`,
`iter-02-escalation-candidate-check.md` §1.
**Forbidden by iter-2 anti-scope:** new `iter-02-*.md`, STATUS/NEXT edits,
schema changes, fifth probe line on the v2 statusline, doom-loop bookkeeping.
This file is a **measurement report**, not a pointer.

---

## 1. The iter-3 question (verbatim)

> Does `escalation.created` need a sibling source-of-truth table, or is
> `events.status` legitimately the right home because no subsystem owns it?

## 2. What was actually measured

`iter-03-escalation-closure-probe.mjs` walks every open `escalation.created`
row in `/app/.state/may.db`, partitions them by reason class, and tests a
*third* hypothesis that iter-2's two-option framing did not enumerate:

> **H3.** The close condition for each reason class is already derivable by
> joining the escalation payload to an existing source-of-truth table
> (`sessions`, `projects`, `workflow_runs`). If H3 holds, the answer to the
> iter-3 question is *neither A nor B*: closure is a **read**, not a write.
> Neither `events.status` nor a new sibling table is needed for that class.

## 3. Numbers (one heartbeat snapshot, regenerable)

```
class                          open  derivable_now  closure key in payload?
─────────────────────────────  ────  ─────────────  ──────────────────────
evaluator_review_failed           8              8  YES (data.context.reviewSessionId)
owner_triage_no_valid_op          3              3  YES (data.context.ownerSessionId)
dispatch_waiting                 19              0  NO  (no projectId in payload)
stuck_iterations                  1              0  NO  (no projectId in payload)
malformed_trigger                 1              0  TRIVIAL (one-shot, no key)
─────────────────────────────  ────  ─────────────  ──────────────────────
TOTAL                            32             11  ratio_derivable = 0.34
```

(Snapshot raw output is preserved at the bottom of this file in §7.)

## 4. What the numbers say about the iter-3 question

The two iter-2 follow-ups framed iteration 3 as a **binary** between
option A (`events.status`-only / paired closure events) and option B
(new `escalations` sibling table). The data falsifies the binary.

The 32 open rows split cleanly into **three** populations, not two:

- **34% (11/32)** — closure is *already derivable today* from a join to
  `sessions`. For these classes the right answer is **C: write nothing
  new**. Read the join. The reason `events.status` looks empty here is
  not that the loop is broken; it is that closure was never supposed to
  be a *write* for these classes. The status of the linked
  `sessions.sessionId` *is* the source of truth.

- **63% (20/32 — `dispatch_waiting` + `stuck_iterations`)** — closure is
  not derivable from any existing table because the escalation payload
  **omits the foreign key** (no `projectId`, no run id). The `projects`
  table *does* hold the source of truth (only 2/33 projects are still
  `waiting`, yet 19 escalations remain "open"); the join just can't be
  written. For these classes the right answer is **fix the producer's
  payload**, not add a column or a table. The closure key already exists
  on disk; the emitter is dropping it.

- **3% (1/32 — `malformed_trigger`)** — pure validation noise. One-shot
  events with no recurrence model. The right answer is **don't track**;
  these are telemetry, the third bucket from
  `iter-02-escalation-candidate-check.md` §7.

So the **straight answer to the iter-3 question is: neither.**

  - Not `events.status`: it would falsely promise that "open" means
    "still actionable" when 11/32 are already resolvable today by join,
    and 20/32 cannot be closed without first fixing the emitter.
  - Not a sibling table: it would create a second source of truth for
    state that already lives in `sessions` (for 11/32) or `projects`
    (for the 19 dispatch-waiting rows once the projectId is restored).

The Ruflo discipline (every subsystem dumps cheap state; one composable
script reads) applied honestly says: **the source of truth is already
the right table; the fix is to make the join writable by including the
foreign key in the escalation payload.**

## 5. The smallest concrete change this implies

A single-line patch at the call site that emits the dispatch-validation
escalation in `agents/shared/workflows/master-worker.ts` (lines 515-518):
include `projectId` in the escalation payload, the way
`Evaluator review failed` already includes `reviewSessionId`. After that
patch:

- The probe's `dispatch_waiting.derivable_now` will jump from 0 to ~17/19
  (the 17 whose project is no longer `waiting`). The two genuinely-open
  cases will be the two projects currently in status `waiting`
  (`proof-of-life-dashboard`, `v2-spec-coverage-buildout`).
- No schema change. No new table. No new probe line.
- The same `Stuck:` reason class (1 row today) gets the same fix for
  free since it shares the call site.

This is the minimum work that turns the iter-3 finding into a closed
loop without violating any iter-2 anti-scope rule.

## 6. Bookkeeping anti-pattern: explicit non-action

Per the iter-2 doom-loop observation, this iteration produces
**exactly two artifacts**:

1. `iter-03-escalation-closure-probe.mjs` — runnable, regenerable,
   re-readable each heartbeat without re-deriving anything.
2. `iter-03-escalation-closure-findings.md` — this file: numbers + one
   recommended single-line code change.

No `STATUS.md` edit, no `NEXT.md` edit, no `iter-02-*.md` reopen, no
"final consolidation," no "closeout-of-closeout." If iteration 4 wants
to act on §5, it does so by editing source code in `master-worker.ts`,
not by writing another pointer file in this directory.

## 7. Raw probe output (snapshot 2026-05-08 ~18:40Z)

```
{"class":"evaluator_review_failed","open_escalations":8,"closure_derivable_from":"sessions.status terminal on data.context.reviewSessionId","derivable_now":8}
{"class":"owner_triage_no_valid_op","open_escalations":3,"closure_derivable_from":"sessions.status terminal on data.context.ownerSessionId","derivable_now":3}
{"class":"dispatch_waiting","open_escalations":19,"closure_derivable_from":"NONE — escalation payload omits projectId; only summary count of projects.status='waiting' is observable","derivable_now":0,"projects_still_waiting":2}
{"class":"stuck_iterations","open_escalations":1,"closure_derivable_from":"NONE — no project key in payload","derivable_now":0}
{"class":"malformed_trigger","open_escalations":1,"closure_derivable_from":"TRIVIAL — one-shot, but no observation receipt anywhere","derivable_now":0}
{"summary":true,"total_open_escalations":32,"total_closure_derivable_now":11,"ratio_derivable":0.34,"hypothesis_h3_holds_for":["evaluator_review_failed","owner_triage_no_valid_op"],"hypothesis_h3_falsified_for":["dispatch_waiting","stuck_iterations","malformed_trigger"]}
```

Re-run any time:

```
node /app/agents/shared/projects/ruflo-learning-loop/outputs/iter-03-escalation-closure-probe.mjs
```
