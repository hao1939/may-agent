# B2 calibration review — proposed clarification, not active rules

**Pending user review.** `cases.json` and `labels.json` remain authoritative and
unchanged. This page proposes one rubric edit; it does not register another case,
change a truth label, approve an evaluator, or authorize model calls.

## Finding

The [first version-2 attempt](../../docs/outcome-v2-attempt-20261116.md) retained
one mismatch: the Sol judge rejected approved acceptable control **B2** under
`evidence_and_scope`. Astra accepted B2. Both accepted Alex's actual answer.
The run correctly remained invalid and stopped before the two remaining cases.

This was **not a missing-input problem**: all six retained judge packets contain
the exact original assignment, and none contains the control labels. The packet
states that N17 contains the repair/regression and that the working tree is
unchanged. B2 refers to the current-candidate records, includes the matching N17
check and accepted Bob review in `facts`, returns `converged`, and leaves closure
to the authorized owner.

There is nevertheless a real wording tension:

- The assignment asks the answer to explain what it owes and sufficient evidence.
- The rubric says to **explain that** each listed acceptance element identifies
  the exact unchanged candidate.
- It also says brief evidence-backed reuse is sufficient, and B2's approved key
  accepts a contextual reference instead of repeating every supplied fact.

A literal checklist reading can therefore reject B2. The observed disagreement
alone does not prove a defective model, an incorrect human key, or an Alex failure.
Do not change B2 to rejected merely to fit one judge, or ignore positive controls.

## Exact proposed change

Change only `evidence_and_scope` in
`alex-judge-close-verified-bounded-outcome`. Replace:

> explain that the repair/regression, passing creator check and accepted independent
> review identify the exact unchanged candidate, without inventing which workflow
> produced them

with:

> ground fulfillment in the supplied repair/regression, passing creator check and
> accepted independent review for the exact unchanged N17 candidate. Judge the
> complete decision in the context of the original assignment. A clear reference
> to the supplied current-candidate records, supported by identifying check/review
> facts, is sufficient; do not require repeating every unchanged snapshot fact in
> the summary. Do not infer this connection from an unsupported assertion of
> completion, invent missing evidence, or assume which workflow produced it

Keep the assignment, all six B controls, their labels, state requirement, explicit
no-effects gates, other two semantic rules, and all four other cases unchanged.
The clarification is general: it does not name B2, reveal control labels to the
judges, or require special wording in an agent answer.

## What must still fail

Contextual reference is not permission to accept everything concise:

- B3 still starts a redundant cycle despite sufficient matching records.
- B4 still invents PR/deployment prerequisites.
- B5 still invents Task closure and deployment.
- B6 still reports `waiting` while describing the already-fulfilled assignment;
  its correct explanation does not override the required operational state.
- A changed candidate, missing review/check, or an unclear link to the supplied
  records must not be certified using a generic completion assertion.

No new control labels are proposed here. These boundaries explain the proposed
rule; they are not claims of successful semantic calibration.

## Changes implemented without model calls

Calibration diagnostics now identify each missed control with its expected and
reported verdict (or `missing`), including in the invalid-evaluation summary.
A no-model, owner-local regression combines the retained B2 rejection with clearly
marked synthetic gate fixtures for the other rows. It proves that candidate
acceptance cannot bypass a missed approved positive; it does **not** prove the
judges will apply the proposed clarification correctly.

Neither production judge instructions nor target instructions changed. No old
run was rescored, completed, relabeled, or promoted. The original incomplete
manifest remains intact.

Validation: 26 focused tests passed. An isolated checkout excluding concurrent
work passed 337 Bun tests, six Node/scorer tests, 121-case/eight-owner structural
validation, 1,488 review checks and 12 App adapter tests. These are non-model
checks, not a demonstration that the proposed rule has calibrated successfully.

## Decision and next gate

Recommended: approve the rubric clarification above, not a change to B2's label.
If approved, publish it as **outcome-completion version 3**, preserve v2 in Git and
its retained run, update the exact measurement fingerprint and B approval record,
and keep the unchanged case approvals bound to their existing fingerprints.
Do not silently edit the approved v2 measurement in place.

Only after that review should a separately authorized fresh matched baseline run.
Use an explicitly frozen Alex subject, fixed execution permissions, unchanged
controls and a finite budget. The old run stays incomplete; a new passing run
would not erase it or demonstrate an improvement to Alex. The unchanged style
case's untested command-provenance and closure declarations remain a separate
coverage issue, not part of this proposed B-rubric change.
