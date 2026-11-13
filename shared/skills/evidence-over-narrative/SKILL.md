---
name: evidence-over-narrative
description: Reconcile comments, descriptions, and assumptions against actual runtime, file, and test evidence before acting.
---

# Evidence Over Narrative

Use this method when a factual claim conflicts with observed behavior or retained
evidence and the difference changes what you should do. It is not a mandatory
template for open-ended research or every tool call.

## Resolve the specific disagreement

Read the request first. Separate the requested outcome from its factual premise:
"fix the reported port-validation bug" names an outcome, while "the validator
accepts 65536" is a claim to investigate. A failing premise does not erase the
request, and passing existing tests does not establish that the premise is false.

Check that the evidence concerns the same target, candidate, input, environment
and time as the claim. A fresh query can return an old observation; an unchanged
repository says nothing by itself about a changing external source or deployment.
A retained result can be sufficient when its scope and validity still match.

Choose a check that distinguishes the competing explanations. Reproduce the
reported case, inspect the relevant implementation and test coverage, or read the
actual resource needed for the decision. Avoid changing code merely to agree
with a comment, and avoid dismissing a report merely because unrelated tests pass.

| Observation | Next judgment |
| --- | --- |
| Tests pass but a report names a failing input | Check whether that input and expected behavior are covered; reproduce it before deciding whether a repair is needed. |
| A test fails but its expected value conflicts with the owning requirement | Check the requirement and calculation before changing either code or assertion. |
| A saved summary says work is done | Confirm the relevant result, actual target and input coverage rather than repeating the work or accepting the summary automatically. |
| A scan finds no new commits | End a scan for new commits if its scope is satisfied; retain any independent requirement to inspect existing code or current external facts. |

State the material disagreement, what the evidence establishes, and any remaining
uncertainty when reporting the decision. If the check does not settle it, seek
the missing evidence or explain the limitation. Neither the narrative nor one
weak check automatically wins.

## Example: distinguish missing coverage from a stale comment

A report says the validator accepts port 65536, while all existing tests pass.
Run that input against the intended validator and check the allowed range. If it
is accepted contrary to the contract, add the missing regression and repair the
code. If it is rejected as required and the report concerns that same candidate,
report the contradictory evidence; do not introduce a bug to match the comment.

For a failing money calculation, establish the rounding rule first. If the
contract requires rounding the final discounted amount to the nearest cent,
33.97 with a 20% discount gives 27.176, rounded to 27.18. An assertion expecting
27.17 needs correction under that rule; a different documented rounding contract
needs its own check. Do not assume either the existing assertion or code defines
the requirement.

The [verification method](../verification/SKILL.md) covers check scope, baseline
comparison, reuse and reporting. Keep any repair within the assignment's
requirements and authority, and retain unresolved work through the caller's
existing result contract.
