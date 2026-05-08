# KE-903 — Run the strongest available read before recommending an emitter/schema write

**Date:** heartbeat after iter-4 of `ruflo-learning-loop`.
**Source:** `agents/shared/projects/ruflo-learning-loop/outputs/iter-03-escalation-closure-findings.md` (the falsified claim) and `iter-04-dispatch-waiting-findings.md` (the falsifier).

## The pattern

When a probe finds that a class of state (here: `escalation.created` /
reason=`dispatch_waiting`) lacks a key needed to close the loop, the
tempting move is to recommend a producer-side patch (add `projectId` to
the payload, add a sibling table, etc.). Iter-3 made exactly that
recommendation: "include `projectId` in the escalation payload; the
probe's `dispatch_waiting.derivable_now` will jump from 0 to ~17/19."

Iter-4 ran the strongest read available against tables already on disk
(`events.timestamp ↔ workflow_runs.startedAt ±50ms`, extract project id
from `workflow_runs.task`) and recovered the missing key for **all 20**
open escalations without any code change. The recommended emitter patch
was unnecessary.

## Why this matters

The producer-side patch is the most expensive move in the toolbox:
- it changes a hot path,
- it requires a deploy,
- it implicitly claims "the data isn't there," which stops further
  investigation.

The join is the cheapest move: it's a SELECT against tables you already
trust. Run it first, even if it looks ugly (timestamp windows, parsing
text columns). If it works, the right answer is **don't change the
emitter** — the question changes from "is the data there?" (it is) to
"is the ground-truth condition satisfied?" (the harder, more useful
question).

## The harder question iter-4 surfaced

Once the join worked, `closure_eligible_now` for `dispatch_waiting`
came out as **0/20**, because every batched dispatch's candidate
project-set includes `v2-spec-coverage-buildout` (status=`waiting`).
The escalation rate is a real signal about one chronically-waiting
project, not noise from a missing emitter field. That is the kind of
finding only the read can produce; the emitter patch would have shipped
to "fix" a measurement gap and left the actual problem invisible.

## Heuristic

> Before recommending an emitter / schema / payload change to "make
> state visible," run the strongest available read against existing
> tables. Only escalate to a producer-side change when the read
> demonstrably cannot recover the key.

## Falsifier (please test next time you cite this)

This KE is wrong if a future iteration finds an `events`-payload class
where (a) no join through `workflow_runs`, `sessions`, or `messages`
recovers the missing key, AND (b) a producer-side patch is the only
viable path. Log the counter-example as KE-903-F1.
