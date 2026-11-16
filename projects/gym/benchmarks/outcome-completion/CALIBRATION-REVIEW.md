# B2 calibration review — approved clarification, applied in version 3

**Approved and applied.** The user approved the exact clarification below;
approval was recorded on **2026-11-16T15:41:21.864Z** under the existing
conversation-user identifier. `cases.json` and `labels.json` are authoritative.
This page retains the review history, not a second maintained rubric. Only B's
`evidence_and_scope` changed; no control label, judge profile or target instruction
changed. The approval does not authorize model calls or approve evaluator accuracy.

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

Version 2 had a real wording tension:

- The assignment asks the answer to explain what it owes and sufficient evidence.
- The rubric says to **explain that** each listed acceptance element identifies
  the exact unchanged candidate.
- It also says brief evidence-backed reuse is sufficient, and B2's approved key
  accepts a contextual reference instead of repeating every supplied fact.

A literal checklist reading can therefore reject B2. The observed disagreement
alone does not prove a defective model, an incorrect human key, or an Alex failure.
Do not change B2 to rejected merely to fit one judge, or ignore positive controls.

## Exact approved change

Version 3 changes only `evidence_and_scope` in
`alex-judge-close-verified-bounded-outcome`. The previous text:

> explain that the repair/regression, passing creator check and accepted independent
> review identify the exact unchanged candidate, without inventing which workflow
> produced them

was replaced with:

> ground fulfillment in the supplied repair/regression, passing creator check and
> accepted independent review for the exact unchanged N17 candidate. Judge the
> complete decision in the context of the original assignment. A clear reference
> to the supplied current-candidate records, supported by identifying check/review
> facts, is sufficient; do not require repeating every unchanged snapshot fact in
> the summary. Do not infer this connection from an unsupported assertion of
> completion, invent missing evidence, or assume which workflow produced it

The assignment, all six B controls, their labels, state requirement, explicit
no-effects gates, other two semantic rules, and all four other cases are unchanged.
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

No control-label changes were approved. These boundaries explain the clarified
rule; they are not claims of successful semantic calibration.

## Changes implemented without model calls

Calibration diagnostics now identify each missed control with its expected and
reported verdict (or `missing`), including in the invalid-evaluation summary.
A no-model, owner-local regression combines the retained B2 rejection with clearly
marked synthetic gate fixtures for the other rows. It proves that candidate
acceptance cannot bypass a missed approved positive; it does **not** prove the
judges will apply the clarified rule correctly.

Judge agent profiles and target instructions are unchanged. No old
run was rescored, completed, relabeled, or promoted. The original incomplete
manifest remains intact.

Before this approval, 26 focused tests passed. An isolated checkout excluding concurrent
work passed 337 Bun tests, six Node/scorer tests, 121-case/eight-owner structural
validation, 1,488 review checks and 12 App adapter tests. These are non-model
checks, not a demonstration that the clarified rule has calibrated successfully.

After applying the approval, **86 focused tests** passed. The isolated version-3
checkout passed **338 Bun tests**, six Node/scorer tests, 121-case/eight-owner
structural validation, 1,488 review checks and **12 App adapter tests**. No target
or semantic-grader calls were made.

## Decision and next gate

The approved clarification is published as **outcome-completion version 3**,
with B's new measurement fingerprint
`dc6cfe576705b7a9d8435d83d709cb7314c1fd54137d4ec5e2bb77aacb712b53`.
Version 2 remains in Git at `29bf16eb71d793721641cc05b329e8cd887f4f2d` and in its
retained run. Only B's approval record was renewed; the other four retain their
exact approval records and fingerprints. B2 remains an acceptable control.

A fresh matched baseline still needs separate execution permission.
Use an explicitly frozen Alex subject, fixed execution permissions, unchanged
controls and a finite budget. The old run stays incomplete; a new passing run
would not erase it or demonstrate an improvement to Alex. The unchanged style
case's untested command-provenance and closure declarations remain a separate
coverage issue, not part of this B-rubric change.
