<ai_context>
summary: "Rolling oversized-note review for agent-runtime-effect-integrity.md. Records verified extraction of cohesive verdict-integrity and operation-admission companions while preserving published anchors and source evidence."
last_updated: "2026-09-28"
</ai_context>

# Runtime Effect Integrity Split Review — 2026-09-14

## Observation

The library-health packet reported `knowledge/agent-runtime-effect-integrity.md`
at 832 lines. A direct `wc -l` during this review returned 831 lines; the one-line
difference does not affect the disposition. The note has 19 top-level research
sections and active uncommitted source additions, so an in-place split during
this owner review would risk overlapping current work.

## Disposition: Split Is Warranted

A contiguous four-section block forms a reusable **verification and verdict
integrity** companion:

1. `Verification-Evidence Binding — Brigade`
2. `A Valid Receipt Must Carry Its Coverage Boundary — ASQAV`
3. `The Verdict Path Needs Its Own Negative Controls — ProjectGuard`
4. `A Clean Sweep Must Prove What It Swept — Dream Studio`

At the observed revision this block spans lines 382–571, about 190 lines. It has
a coherent progression from subject binding, through coverage disclosure and
valid-but-anomalous receipts, to negative controls and inspected-universe
completeness. Extracting it would leave the effect-integrity parent near 640
lines and create a focused companion near 200 lines, before metadata and
navigation text.

The remaining parent still has a coherent runtime-effect scope: admission,
state/version binding, ambiguous delivery, remote-session retries, handover,
history and crash recovery, sandbox boundaries, replay and local-marker limits,
settlement, and delayed-effect authorization.

## Safe Split Contract

Perform the split as one isolated change after preserving the current
uncommitted additions.

- Create a descriptively named companion such as
  `knowledge/agent-runtime-verdict-integrity.md` with its own `<ai_context>` and
  the four sections intact, including all source and limitation text.
- Replace each moved section in the parent with a small forwarding heading and
  an exact relative link to the retained heading. This preserves anchors used by
  immutable digest snapshots.
- Update editable links in the working digest, reciprocal navigation in both
  notes, and the single concise library INDEX entry.
- Verify every local Markdown path and all four heading fragments, and confirm
  that each primary source URL and inspected revision remains represented once
  in the durable notes.

## Why The Initial Review Did Not Edit the Canonical Note

`git status` and `git diff` showed that the parent contained substantial
uncommitted September additions, including ASQAV, ProjectGuard, and Dream Studio,
while the working digest already linked to those exact headings. The useful
smallest step at review time was therefore to record the stable boundary and
delegate the isolated extraction rather than moving another worker's active
material in place.

## Completion Follow-Up

The delegated extraction subsequently completed the safe split contract. Direct
read-back on 2026-09-14 measured the parent at 659 lines and the new
[`Agent Runtime Verdict Integrity`](../../knowledge/agent-runtime-verdict-integrity.md)
companion at 205 lines. The companion contains each of the four selected sections
once, while the parent retains each old heading as a forwarding anchor to the
matching companion fragment.

The working digest now links ASQAV and Dream Studio directly to the companion,
and the exhaustive index has one concise entry for each note. Targeted local-link
validation over the parent, companion, index, and working digest resolved every
Markdown path and heading fragment. This closed the 2026-09-14 observation
without another split or child assignment.

## Recurrence Review — 2026-09-16

The health observer reported the parent again at 809 lines; direct read-back
measured 808. The prior split remains intact: all four forwarding headings still
resolve to distinct headings in the companion. The parent is 149 lines longer
than its 659-line post-split read-back, is dated 2026-09-16, and remains part of
a broad uncommitted source-intake change set. Its three newest tail sections—on
an unread diagnostic channel, downstream effect deduplication, and accountable
but not pre-authorized agent writes—are source-grounded and still fit the
parent's effect-integrity scope.

No second split is warranted in this recurrence review. The note crossed the
threshold because useful source intake continued two days after a verified
split, not because the previous extraction failed or a new cohesive companion
has emerged. Moving those active tail sections now would add navigation churn
for only about 100 lines and overlap the current intake. Re-review after the
active change set is integrated or when a stable, coherent extraction block is
large enough to reduce the parent materially; do not create a child assignment
from this unchanged size signal alone.

## Operation-Admission Extraction — 2026-09-28

The observer reported 1,063 physical lines; direct read-back measured 1,062
newline-counted lines. Unlike the September 16 recurrence, a stable cohesive
block had emerged and intake had paused for two days. The first eight headings,
from `Separate Conversation From Business Operations Before Production`
through `A Receipt Must Join by Durable Identity, Not Resemblance`, occupied
339 lines and formed one reusable operation-admission sequence: separate
conversation from deterministic operations, make approval answerable, claim
ownership safely, review the concrete mutation, derive effect modes once,
journal irreversible attempts before waiting, bind feedback to the decision-time
choice set, and join receipts by durable identity.

That block was moved intact to
[`Agent Runtime Operation Admission and Identity`](../../knowledge/agent-runtime-operation-admission-and-identity.md).
The parent keeps all eight old headings—including both revision-follow-up
subheadings—as exact forwarding anchors, and now measures 756 lines. The new
companion measures 355 lines, carries its own source-basis metadata, links back
to the parent, and is listed once in the exhaustive index. Retained digest
snapshots continue to resolve through the forwarding anchors, so immutable
history did not need rewriting.

This closes the current size signal with a material thematic split rather than
a threshold-only cut. No child task or dependency is needed.
