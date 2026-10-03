# Continue unfinished work with correct context

**Supports:** [Task attempts](../2a-design/task-attempts.md). Helps May carry an accepted intention through to useful results with fewer reminders and repeated executions, supporting [May's purpose](../1-principles/purpose.md).

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first) means repair the existing context path before adding another recovery mechanism. [Code brings back evidence; agents judge](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge) keeps fulfillment judgment with the worker. [Context discovery](../1-principles/core-principles.md#context-is-discovered-not-dumped) calls for a small current view with readable detail.

**Design status:** Proposed, refined after an isolated PoC. Focus first on the existing context mechanism; additional repetition policy is deferred pending evidence from corrected context.
**Implementation status:** Local Host candidate `8dd6e1bcb`, based on `438ad1e38`, passes full portable CI. An isolated real-model trial completed a small assignment correctly on both baseline and candidate; it did not reproduce the large-backlog loop. No publication or deployment. See [the experiment](../archive/reviews/unfinished-input-context-20261003.md).

## Recommendation

Make unfinished input unmistakably part of the current assignment, and preserve
the exact scope of the previous accepted result. The worker should see what is
still owed alongside what has already been done, then decide how to continue.

Use the existing Task, input identities, results, reads and Conditions. No new
output decision, obligation registry, retry rule or mandatory progress judgment
is needed for this first fix.

## An ordinary example

A user asks for a change, a review and a restart test. An earlier attempt writes
the change and saves its evidence but returns a result covering no input yet.
No new message arrives. The next attempt should see:

```text
Current assignment: change, review and restart test
Earlier unanswered input: still assigned
Previous result: accepted, covering zero inputs
Existing work: implementation and evidence available
```

The agent can reuse the change, read the review, and perform the remaining test.
If prior work already meets several requirements, it can cover them together in
one result. Infra records that judgment and retains everything else. An input's
age does not turn it into history-only material; settlement preserves history.

The same evidence can support a different judgment: the restart test might still
be missing, or a review might require changes. The Host must not infer fulfillment
from an old summary, lack of Conditions, or a desire to stop spending tokens.

## What broke

In the observed loop, the worker repeatedly treated earlier unanswered inputs as
historical obligations and explicitly returned `inputKeys: []`. Infra retained
the inputs and scheduled another attempt. A successful attempt did not enter
failure backoff. Event coalescing cannot repair that interpretation.

Source review found a concrete loss of information: the accepted result stores
`inputKeys`, but `previousAttempt.acceptedResult` omitted it from the shared
execution context. It carried "converged" and the previous summary without that
result's coverage. The full result remained discoverable elsewhere; it was not
lost from storage.

The context also separated empty new-event lists from continuing inputs, and
the detailed decision file was one long JSON line that ordinary reads could not
display. The agent could work around both, and eventually did. Correcting this
interface is the smallest demonstrated repair; it is not proof that context was
the sole cause of the agent's mistake.

## Changes and boundaries

| Change | Infra provides | Agent decides |
| --- | --- | --- |
| Preserve result coverage | Carry saved `inputKeys`, continuation and review deadline through the existing previous-attempt projection. Missing coverage stays unknown; `[]` means none. | Whether previous evidence satisfies current requirements. |
| Make current work visible | A small derived view of the starting event/continuing-input counts, current retained obligations and previous result's coverage. Preserve current-read status, truncation and exact references. | Which relevant inputs to inspect and what useful action to take. |
| Make details usable | Readable decision JSON and existing scoped original-input reads; bounded previews retain identity and content links. | How much supporting detail is needed before judgment. |
| Preserve existing settlement | Apply the worker's chosen scope; retain unselected inputs, Conditions, work and evidence across restart. | Whether to fulfill, continue useful work, wait, or report a blocker. |

The summary is a disposable projection, not a second authority. Do not persist
its counts, ask the agent to update them, or use them as a scheduling rule.
`pendingWork` counts the retained `pending` flags in the observed page; it is
not an independently calculated eligibility decision. Counts of retained inputs
exclude unclaimed events, and a truncated page is not a total.

The starting assignment and current Task read have distinct scopes. A refresh
failure leaves a labelled earlier snapshot; it must not turn unknown obligations
into zero. Previous attempt identity and generation remain attached to its
result. Coverage on `waiting` or `incomplete` does not mean those inputs finished.

Helper agents receive shared facts under their narrower call assignment. The
new context must not make a reviewer responsible for settling the parent Task.
Workflows and registered executors receive the same previous-result facts
through the existing shared interface; model presentation is only one consumer.

## What the PoC taught us

The production claim/read/settlement paths can preserve all unfinished inputs
and accept a reviewed subset using their existing mechanisms. The candidate
makes zero prior coverage explicit and makes the large detail readable. It
preserves legitimate empty-scope partial results and genuine waiting behavior.

A deliberately unresponsive scripted worker still loops with the corrected
context. This is the expected negative control: context does not force semantic
judgment. Likewise, scripted settlement is not evidence that a real model checked
the original requirements correctly. See the experiment for measured sizes,
checks, failures and limits.

The subsequent real-model trial used May's configured model and instructions on
six continuing requirements, with no new events and a misleading previous "done"
result covering none. Both versions read the requirements, fixed an actual bug,
verified it, wrote a handoff and settled all six inputs. Independent checks and
database reopen confirmed the result. The candidate also reused its work after
a trial-budget interruption. Both needed seven model requests; this small case
does not establish fewer repetitions or a reliable token saving. Additional
real-model controls were left unrun when the fixed overall budget was used.

Review refinements kept the candidate small:

- Fix the dropped result fields rather than introduce a new settlement receipt.
- Reuse a single presentation helper for the entry and refreshed brief; keep
  exact input bodies in the existing detail/read paths.
- Show unknown and partial coverage explicitly rather than manufacture totals.
- Keep useful empty-scope results valid; do not equate input-count reduction
  with useful progress.
- Defer new repetition/intervention policy until testing the corrected context.

## Validation and the next decision

Portable tests must cover the actual incident shape: no new events, earlier
unanswered inputs, and a prior result saying "done" with empty coverage. They
must also cover scoped settlement, restart, unread original content, independent
waits, unavailable/truncated context, helper scope and outgoing request assembly.

The small behavioral trial supports keeping this narrow context repair and the
existing agent/infra boundary. It does not establish that context was the only
cause of the observed loop. Before claiming that incident fixed, a further
bounded trial should preserve its harder features: around ninety continuing
inputs, large detail, mixed completed and unfinished requirements, and real
external waits. Use independently checked outcomes, not just cleared inputs.
Repair the trial's restrictive local command access before drawing efficiency
comparisons; retain interrupted runs as evidence. Do not restart the stopped
May installation as part of source validation.

If corrected context is still insufficient, use the existing App-owned metrics
and Evaluation route to investigate the demonstrated residual pattern. New
samples remain metric updates; a breach episode can invite judgment. Do not
bundle new thresholds, automatic suspension or another watcher into this fix.
The separate [burst-input acceptance proposal](progress-under-burst-input.md)
still owns results rejected by newer arrivals; its experimental fence removal
is not part of this candidate.
