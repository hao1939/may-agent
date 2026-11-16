# Standalone recovery and no-change trial — November 16, 2026

## Outcome

Alex selected interruption/reuse and non-actionable diagnosis as the next
bounded process trial after snapshot integrity. The controls passed with the
production SDK, runner and workflows unchanged at Apps revision
`2592b67b0660ab22cc7dbce8d18843bc919d278b`. Alex's disposition was **no runtime
change**. This update documents the demonstrated manual recovery input and
retains the trial evidence.

The trial supports one part of the north star: avoiding repeated valid work
while preserving truthful decisions. It does not demonstrate fewer human
corrections, better natural-work quality or lower operating cost. No Host Task
was created, interrupted or activated.

## Recovery controls

Two tiny external repositories supplied linked Git candidate worktrees and a
real executable verification command. The ordinary `alex/develop-change`
procedure called deterministic Bob and tech-lead fixtures at its normal
`ctx.call` boundaries. Fixture judgments were controlled; Git, source readback,
command execution, evidence retention and cancellation were real.

| Control | Observed result |
| --- | --- |
| Verified but incomplete checkpoint | Actual check passed once; injected `clarify` review retained valid development evidence with `state: incomplete` |
| Interrupt an active resumed review | CLI SIGINT returned exit 130, interrupted status and confirmed cleanup; candidate and earlier checkpoint remained unchanged |
| Retry from that exact checkpoint | Same Task id and full Task result converged after review; check count stayed at one and no implementation was repeated |
| Change candidate commit | A committed comment invalidated the old checked identity; a second actual check and a review matching the new commit preceded convergence |
| Interrupt an unfinished edit | Dirty bytes remained, with no check or review falsely completed |
| Retry unfinished work | Fresh same-id invocation committed the existing bytes without rewriting, then verified and reviewed them |
| Execute the published recovery recipe | The recipe generated a new stage from the retained approved delivery; invocation converged with zero specialist calls and no additional check |

There were six primary development invocations and one recipe validation.
Cancellation gates waited for an active review or edit before sending SIGINT;
other interruption timings remain untested. The changed-candidate control was
a later phase of the same clean-candidate Task. The dirty candidate had no prior
valid delivery, so its retry inspected unfinished source afresh.

## What manual recovery requires

The operator selected an actual retained development delivery and supplied it
through the same full `TaskDetail.result`. A stable id in the short Task envelope
alone does not restore prior results. The runner does not persist or restore
Task results automatically, and cancellation does not deliver the workflow's
current in-memory saved object.

The [manual recovery recipe](standalone-stage.md#recover-a-development-invocation-manually)
shows the full envelope and exact result path. The workflow checks archived
artifact identity, requirements and the current candidate before reuse. The
published Python recipe was extracted from the guide and executed against the
retained checkpoint; its subsequent standalone invocation confirmed reuse.

These controls demonstrate operator-driven reuse, not Host persistence or
recovery. The deliberate clarification is a checkpoint fixture, not a real
request for authority. No production runtime patch was needed to pass it.

## Non-actionable decisions

Two synthetic frozen diagnostic inputs ran through the existing
`alex/diagnose-improvement` workflow with live readonly Gym judgment and no
`candidateName`. Alex then recorded the owner dispositions:

- Healthy authoritative result, passing verdict and low usage: **no_change**.
- Missing authoritative `result.json`, despite a manifest claiming success:
  **insufficient_evidence**.

Both returned empty proposed changes and omitted the implementation stage and
verification plan. Their exit 0 means diagnosis returned; the explicit
disposition says what the evidence supports. These inputs establish narrow
diagnosis boundaries, not approved behavioral truth or general agent health.

## Cost, limits and next milestone

The two live diagnoses took approximately 3.7 and 3.9 seconds. Scope selection
and owner disposition also used live Alex. The retained usage summary records
84,825 reported tokens, including repeated context, and a direct model cost
estimate of $0.2922088 for those four live stages; actual billing is unverified.
Recovery specialists were fixtures with no model calls. No cost reduction is
inferred from these controls.

The next milestone is a bounded Host handover rehearsal on a representative
existing assignment: inspect the installed source/SDK and Task evidence contract,
then observe execution and recovery through ordinary Host delivery. Preserve the
same input identities and honest dispositions. Manual mechanics are ready for
that preparation; Host recovery and transfer to natural work remain unverified.

## Evidence

The [retained session index](/root/workspace-worktrees/alex-standalone-20261116/.state/standalone-improvement/20261116-session-3/README.md)
links Alex's scope, inputs and checkpoint artifacts, fixture call logs, actual
check counters, interruption receipts, independent verdicts, live diagnoses,
Alex's disposition and recipe validation. Scratch candidates and failed or
incomplete invocations remain outside the shared checkout.
