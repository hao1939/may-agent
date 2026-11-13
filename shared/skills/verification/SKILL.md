---
name: verification
description: Verify work products with concrete command, file, or state receipts before claiming completion.
---

# Verify the claim you need to make

Use this method when checking a work product, relying on prior work, or comparing
a change with its baseline. The assignment and owning contract determine what
must be established. Verification supplies evidence for that decision; it does
not create another completion gate or require manufacturing an output file.

## Choose evidence that covers the claim

Read the current request and acceptance requirements first. Identify the material
claim and the target it concerns: a file, source candidate, behavior, published
artifact or installed system. Select the smallest check that can establish it.

| Claim | Relevant evidence and limit |
| --- | --- |
| An edit landed correctly | Inspect the actual diff or changed sections, including required preserved content. File existence alone does not establish correctness. |
| A reported bug is fixed | Exercise the reported case and relevant regressions against the changed candidate. A passing unrelated suite does not establish the fix. |
| Code passes type checking or tests | Run the owning project's required commands in the intended checkout and read their exit status and results. A syntax check cannot stand in for type checking. |
| Earlier work already satisfies the request | Inspect the relevant retained result and actual target. Confirm its identity, input coverage and continuing validity before reusing it. |
| A failure predates the change | Compare the same check against the actual earlier candidate under comparable conditions; record the source and environmental limits. |
| A change is published or deployed | Inspect the destination receipt or installed state. A local commit or source check alone does not establish either outcome. |

Use the tools and result fields actually supplied by this execution. Read the
exit status, failures, skipped checks and relevant output; do not assume every
tool has a particular `details` schema. Truncated output cannot establish facts
about unseen sections. Narrow the read or retain complete output when needed.

## Reuse evidence and compare changes fairly

Retained evidence can remain useful across sessions. Reuse it when the candidate,
requirements, relevant environment and check coverage still match. Recheck the
material uncertainty when they do not, or when the assignment requires a fresh
observation. A new session alone is not a reason to repeat every check or reread
every historical claim. Conversely, an old summary saying "done" does not prove
that the current request was covered.

Capture a baseline before changing behavior when a before/after comparison is
needed. Record enough context to identify the checked candidate, command,
working directory, relevant environment and result. If a failure is found later,
a clean isolated checkout of the exact earlier candidate can establish a source
comparison; it cannot reconstruct unrecorded mutable state or local changes.
Preserve the working checkout and disclose those limits.

Compare equivalent checks and inspect meaningful differences. Matching error
counts alone do not establish matching failures or an unaffected outcome. If a
required new regression test fails on the old candidate and passes on the new
one, retain that evidence. Do not waive a relevant acceptance failure merely
because some failure also existed before the change.

## Report the supported outcome

Required checks and deliverables remain required. If a check fails, investigate
whether the defect is in the implementation, expectation, environment or check
scope; a green suite is not proof of every behavior, and a red suite does not
identify the faulty component by itself. Use
[evidence over narrative](../evidence-over-narrative/SKILL.md) when a conflicting
claim needs that diagnosis. Repair within the existing execution bounds, then
rerun the checks affected by the repair.

Report what was actually checked, the result and material gaps. Never invent a
receipt, claim a command ran when it did not, or infer success from intent. A
missing capability or unavailable external state remains an explicit limitation.

Useful partial work can be returned through the supplied result schema without
claiming the unfulfilled requirement is complete. Keep the remaining work and
caller obligations visible; accepting a report does not establish fulfillment.
For Task continuation, waits and recovery, use the
[Task execution guide](../../../projects/alex.app/docs/2b-manual/task-execution-guide/SKILL.md).
