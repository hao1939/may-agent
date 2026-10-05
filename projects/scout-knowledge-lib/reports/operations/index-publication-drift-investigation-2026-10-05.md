# Finding Publication and INDEX Drift — 2026-10-05

## Decision

The recurring drift is a workflow-admission gap, not a publication-atomicity limit.
Scout's publisher already commits every changed candidate path in one revision, so
a newly created finding and its `knowledge/INDEX.md` entry can be published
atomically. The smaller durable repair is to reject a `scout-explore` result that
creates a flat finding without changing `INDEX.md` and linking that new finding
exactly once. A post-publication repair signal would detect the same defect only
after readers had already received an incomplete navigation state; recurring
bounded batch maintenance has already demonstrated that lag three times.

No previously published INDEX edit was replayed in this investigation.

## Reproduced episodes

The three named `library-maintenance` attempts show the same sequence at different
batch sizes:

| Accepted attempt | Pre-repair evidence | Published repair |
| --- | --- | --- |
| `r_1_1aea947b-0c9a-4c38-b8d1-6fb23c8f0c64` | Nine findings dated October 2–3 had zero filename references in `INDEX.md`; the recent-findings section stopped at September 27. | Added nine limitation-aware entries in commit `a885f46ab56e09c5e116793930b96fede266499e`. |
| `r_1_0399f647-c4d0-4ea4-90d0-b0cd8c7c2a8e` | Two accepted October 4 findings existed while the index still declared coverage only through October 3. | Added both entries in commit `4f02f4b56374ab51b63fb5e0ffc94fa9c98478c8`. |
| `r_1_9793978c-9b12-49d1-bf08-2a5da95c43b1` | Twelve October 4 findings existed, but only three were linked; nine had zero filename references. | Added the nine missing entries in commit `f995bce9294627af7ea33f07d4f538517f09f603`. |

The third episode is not a replay of the second: source publication continued after
the two-entry repair, and the later comparison found a larger same-date population.
Together the episodes show that daily maintenance can restore navigation but does
not prevent the next source publication from omitting it.

## Ownership-path inspection

`scout-explore` gives its researcher one candidate project root, snapshots that
root before the call, and later computes all durable changes. It blocks omitted
changed outputs, then calls `publishKnowledgeChanges` with the complete reported
durable output set. The publisher stages all changed project paths, creates one
commit, checks that the commit contains exactly those intended paths, installs the
files and replacement Git index under one lock, and advances the canonical ref by
compare-and-swap. Therefore atomic finding-plus-index publication is already
supported; no second publisher or post-publication writer is required.

The missing ownership is earlier. `buildExploreTask` requires source search,
deduplication, a durable finding, digest consideration, and read-back, but does not
require new findings to add exhaustive-index navigation. The admission path checks
output containment, source preservation, duplicate source references, and omitted
changed files, but it does not compare newly created `knowledge/findings/*.md`
paths with `knowledge/INDEX.md`. A researcher can therefore return a valid new
finding and digest while never changing the index, and the atomic publisher
correctly commits that incomplete intent.

Current Scout Task discovery showed no live child or sibling already owning this
defect class. The only running task with this exact scope is the present
investigation.

## Smallest reviewable correction

Prepare one isolated Scout App candidate that:

1. updates the `scout-explore` writer contract: every newly created flat finding
   must also add one concise, limitation-aware relative link in `knowledge/INDEX.md`;
2. deterministically inspects pre-publication state and rejects a result when a
   newly created `knowledge/findings/*.md` file is not referenced exactly once by
   basename from the changed candidate `INDEX.md`;
3. does **not** require an index edit for an update to an already-existing note or
   for an evidence-backed no-op; and
4. publishes the finding and index through the existing single atomic publication
   call rather than adding a second write phase.

Focused regression acceptance:

- a new finding without an INDEX change is rejected before publication;
- a new finding with exactly one resolving INDEX link is admitted and both files
  appear in the same publication commit;
- an existing-note-only update remains admissible without INDEX churn;
- the prompt continues to require source-grounded and limitation-aware prose.

This report is diagnosis and handoff, not proof that the correction is integrated,
activated, or live-verified. Resolution requires the isolated candidate, focused
tests, normal review/integration, activation of the resulting App definition, and a
later real source publication receipt showing finding and INDEX in one commit.

## Revisit trigger

If the deterministic gate is declined, revisit immediately when any newly
published flat finding has zero or multiple filename references in canonical
`knowledge/INDEX.md`. Otherwise, after activation, inspect the first real new-finding
publication and verify its commit contains both paths; absence of that receipt
leaves runtime resolution unproved.
