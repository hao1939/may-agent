# Task responsibility and retention

**Supports:** [Carry work through change and interruption](../2a-design/system-model.md#carry-work-through-change-and-interruption). Keep unfinished promises actionable while completed evidence remains easy to find.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first): clarify the existing lifecycle and owner decisions before adding another state, automatic reviewer or archival service.

**Design status:** Responsibility clarification is in the owning contracts;
presentation and adoption changes below remain proposed.
**Implementation status:** Documentation only. Existing guarded close/reopen,
Conditions, scoped results and recurring schedules supply the mechanics. No
Host code, installed definition release, task state or schedule changed here.

The [Task engine](../2a-design/task-resource-engine.md#state-and-continuing-responsibility)
owns state and responsibility semantics. [Human control surfaces](../2a-design/human-control-surfaces.md)
owns presentation, and the [Task guide](../2b-manual/task-execution-guide/SKILL.md)
owns ordinary agent use. This document retains evidence, remaining changes and
validation scope; it does not introduce another current lifecycle contract.

## What the review established

The November 7 Alex snapshot contained 544 records: 533 up to date, six waiting,
and five cancelled. Two up-to-date records had configured recurrence. Of 528
older reconciled records outside the detailed review, recorded purposes included
272 evaluation report intakes and 138 independent task reviews. They had no
retained input waits, pending events or Conditions at that snapshot. These facts
explain accumulation, not whether every original goal was fulfilled.

The six unresolved waits revealed more than a terminology problem. One awaited
a human retry signal after its actual May recovery result was already done.
Two tracked overlapping PR #361 work after merge, with one real unfulfilled
review requirement. Another retained historical handoff delivery under an old
approval description despite later evidence that the general pipeline worked.
The branch disposition and external-monitor waits still represented real
decisions. Bulk closure by phase or age would erase that distinction.

The source already separates attempt acceptance from owner closure:

- Host SDK `packages/sdk/src/task.ts`: `converged` accepts an outcome and leaves
  its Task open. Useful work can finish while unrelated input or waits remain.
- `src/app/human-task-service.ts`: `taskStatus` maps converged to up to date;
  `listApps` counts all live phases, including converged, in `activeTasks`.
- `src/app/core/tasks/app-task-reconciler.ts`: `closeTask` checks exact current
  versions, the accepted attempt, stored converged phase, absence of an active
  attempt and a pending trigger. These fences do not establish semantic success.
- `src/app/core/tasks/app-task-accepted-result.test.ts` retains accepted result
  evidence after explicit closure. History preservation does not require open
  execution eligibility.
- `packages/control/src/server.ts`: guarded `task.close`/`task.reopen` exist.
  This does not imply a worker's supplied tools expose owner closure.

The live review also found that stopping an XHS retry loop and obtaining post
content were separate outcomes. A successfully settled Task could still retain
an incorrect access diagnosis: its plain fetch saw login text while the browser
session was ready. Neither convergence nor a workflow test proves the broader
domain outcome. Outcome scope belongs to the owner; the Host cannot infer it.

## Remaining implementation

1. **Present facts accurately.** At the generic Host read/UI boundary, label
   all retained live records as open, not executing. Keep running, queued,
   waiting, attention and configured recurrence distinguishable. Use existing
   detail data to show an actual next obligation or observation. If it is not
   represented, say unknown or no future work declared; do not fabricate one.
   Changing a public field such as `activeTasks` needs compatible readers and
   tests, not only new UI wording.
2. **Make owner disposition usable.** Check the real App worker/caller
   capabilities before adding an API. The assigned agent can propose closure;
   the authorized creator/owner consumes the accepted result and decides under
   existing policy. Use the existing guarded control if available. If automated
   App ownership needs a missing trusted path, prove that gap in a bounded
   fixture before extending the neutral Host contract. No blanket human
   confirmation, new approval queue or mandatory evaluator is required.
3. **Adopt in Alex.** Use current owner evidence to settle the stale recovery
   wait and consolidate the duplicate PR tracking. Keep exact unfulfilled
   review, branch, monitoring and historical delivery obligations owned. One-off
   report disposition should return a scoped answer and, when sufficient, an
   owner closure recommendation. Repeated evidence updates should reuse their
   actual outcome owner rather than commissioning fresh repair wrappers.
4. **Review retained records affordably.** Start with deterministic selection of
   finite, reconciled, nonrecurring candidates and their exact accepted results,
   caller links, Conditions and pending inputs. Inspect a bounded batch for
   semantic sufficiency. End each with fulfilled, authorized unfulfilled,
   transferred-with-owner, or still-needed disposition; use the existing controls
   only when authorized and their mechanical checks pass. Do not turn 528
   records into 528 new automatic review tasks. Leave uncertain responsibility
   visible for owner judgment instead of hiding it in an archive filter.

No new `archived`, `monitoring`, `fulfilled` or `dormant` stored Task phase is
proposed. Fulfillment remains a scoped agent judgment, observation uses existing
Conditions/schedules, and archive is presentation of ended records. Keeping
separate facts is simpler than a state for every combination.

## Verification before adoption

Documentation checks establish internal consistency only. A source change
should exercise the disputed behavior at its existing owner:

| Case | Required observation |
| --- | --- |
| Finite report review, supported no-change, no caller obligation | Scoped result remains readable after authorized closure; default actionable list does not imply ongoing execution. |
| Standing six-hour audit between runs | Up to date with its declared next run; ordinary closure review does not end recurring work accidentally. |
| Current input fulfilled, older result still needed | Preserve the independent wait and caller return; do not infer full assignment fulfillment. |
| Human retry acknowledgment is unknown, actual recovery already done | Owner reconciles the actual outcome and removes the obsolete wait without repeating recovery. |
| A newer requirement arrives during owner closure | Existing generation/resource/attempt guards reject stale closure; no input is silently archived. |
| Closed record receives an ordinary observation | Retain history without a model wake; authorized continuation uses supported reopening. |
| User stops a local presentation watch | Task and domain Conditions continue unchanged. |
| Several report records point to one actual repair | Evidence remains discoverable; only the true repair owner retains its unresolved outcome. |

An agent comparison is needed before claiming better comprehension, fewer
unnecessary calls or cost savings. A real bounded closure/admission observation
is needed before claiming installed adoption. Neither was performed by this
documentation change; there is no bulk historical closure or new review schedule.

## Documentation validation

This refinement was prepared on Apps base
`3f6202e450309030142de9670999abc77c17dd0e` and read Host source
`980f2cda391d36d2a6d10927f81ed02c6bf6b66e`. `bun run check:may-design`
passed document integrity, executable examples and canonical App checks, with
one pre-existing root-layout warning for `reports`. The isolated checkout used
the existing paired Host source for these read-only/example checks; no live
Task database was used. All 248 relative links and heading targets in the six
changed documents resolved, and `git diff --check` passed. No agent-behavior
comparison, runtime activation or historical task closure was performed.
