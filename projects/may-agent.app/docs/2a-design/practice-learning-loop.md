# Agent improvement: an optional App integration

**Supports:** [System Model](system-model.md#improve-from-evidence-and-make-problems-actionable). Connects assessment, candidate improvement and verification through ordinary App work.

**Choice basis:** [Agent Evolution](../1-principles/evolution.md#promotion-tests).

**Design status:** Accepted as an App integration, not a required Host subsystem.
**Implementation status:** Evaluation reviews external App Tasks; May receives
published findings; Gym provides bounded comparisons. These App contracts are
implemented in source. A complete installed improvement cycle requires separate
proof of report consumption, candidate preparation, comparison, approval,
application and fresh behavior. This document does not certify that cycle.

## Purpose

Agents improve through ordinary work, evidence, authorized changes and later
verification. Each part has one focused responsibility. The Host supplies Task
identity, execution, state, feedback and recovery; the Apps decide what deserves
investigation, whether a change is worthwhile and who may approve it.

```text
work produces evidence
  -> Evaluation reviews selected external Task evidence
  -> May verifies the finding and decides whether investigation is worthwhile
  -> an assigned worker prepares an isolated candidate
  -> Gym compares the candidate with a frozen baseline
  -> May judges value, cost and simpler alternatives
  -> required human approval binds the exact proposed change
  -> an authorized worker applies and verifies it
  -> later work and evaluation test the claimed benefit
```

These are responsibility transitions, not mandatory new services or a second
workflow engine. Use ordinary Tasks and exact input/result links. A report may
lead to no change, reuse of existing work, or repair within the original Task.
An improvement is justified by useful evidence and value, not by report volume.

## Authority

| Responsibility | Owner | What its output establishes |
| --- | --- | --- |
| Original work | Responsible App/Task | Its accepted result and outstanding obligations |
| Assessment | Evaluation | An evidence-backed judgment with stated scope and limits |
| Investigation and candidate preparation | May's assigned worker/team | A concrete proposed change and why it fits |
| Frozen comparison | Gym | Comparison evidence under declared objectives and constraints |
| Pursuit and readiness decision | May | Whether the candidate is worth its total cost and ready to propose |
| Required final approval | Human through the exact approval contract | Permission for the identified change and scope |
| Application and activation | Authorized worker/operator | What source/artifact was applied and what became active |
| Later verification | Relevant work and Evaluation | Whether observed behavior supports the claimed improvement |

Task records own work. Reports, session trails, command receipts and generated
feedback are evidence or projections. None automatically grants permission to
change live behavior, and a successful comparison is not an approval.

## Evaluation

[Evaluation's contract](../../../evaluation.app/design/task-outcome-evaluation.md)
owns eligibility, evidence identity, rubrics and report publication. Current
review targets exact external App Tasks, including bounded current obligations
and historical outcomes. It excludes its own App. Session scoring and annotation
remain compatibility capabilities; a session ending does not require a new review.

Automatic sampling is configured by Evaluation and may be disabled. A report
with no finding does not certify system health. Missing evidence is uncertainty,
not failure of the target or evidence of success. May's
[report intake](../../../may.app/agents/may/workflows/evaluation-report-intake.ts)
checks exact publication identity and verifies material findings before acting.

Generated feedback is an optional discovery aid. Read its current owned path
and source timestamp; source presence does not prove that a later agent consumed
it. Retained session annotation has its own [trail contract](session-eval-trail.md).

## Gym intake

[Gym](../../../gym.app/README.md) accepts ordinary `goal` and `message` inputs.
Its owner can select the `compare-candidate` workflow, which invokes frozen
baseline/verification primitives and returns evidence. Current Gym has no
automatic Evaluation subscriptions or schedules. It does not prepare, approve,
apply, merge or deploy candidates.

The [comparison contract](../../../gym.app/design/frozen-comparison-service.md)
owns quality gates, declared performance objectives, input/evidence identity and
invalid-run handling. The
[report-driven improvement design](../../../gym.app/design/report-driven-improvement.md)
connects it to May and the preparing worker. Keep those domain rules there.
Older May-only intake and automatic-promotion descriptions are historical records,
not the active Gym contract.

## Choosing the mechanism

Use the smallest change that addresses the confirmed cause:

| Cause | Candidate mechanism |
| --- | --- |
| Missing or stale environment knowledge | Owned context or knowledge |
| Reusable judgment method | Agent instructions or a skill |
| Repeated procedure | A focused workflow |
| Missing deterministic capability or broken mechanics | Existing tool, SDK or Host implementation |
| Missing relevant observation | Existing subscription, observer, schedule or metric |
| Coordination failure | Repair the existing Task/input/result connection |

First examine the existing mechanism that should handle the situation. An
implementation defect does not by itself justify another recovery layer. A
candidate may simplify or remove code. Keep protected truth and withheld
comparison cases separate from the candidate being improved.

## Validation

A reviewable change links the finding, baseline, proposed source/artifact,
comparison objective and evidence. Ask whether a simpler solution gives similar
value at lower implementation and operating cost. Declining a low-value change
is a valid outcome.

Application proof distinguishes saved source, committed source, activated
definitions/binary and fresh execution. An existing worker may retain its
starting definitions after reload. Approval must still match the candidate,
current target and scope at application time; changed evidence needs reconsideration.
Follow the existing [deployment boundary](../2b-manual/app-operations-recovery.md#runtime-deployment-target)
when Host artifacts change.

## Remaining adoption gaps

The installed loop must be assessed from one exact trace through its handoffs.
Check who received each report, where investigation is recorded, which candidate
Gym compared, who requested/received approval, what was applied, and which fresh
execution verified the result. Do not infer these transitions from independently
passing component tests or from an old rollout paragraph.

The [convergence index](../proposals/design-implementation-convergence.md) records
confirmed source gaps. Prior
[agent-operated trials](../archive/reviews/agent-operated-improvement-poc-20260912.md)
and [feedback/adoption trials](../archive/reviews/feedback-adoption-integration-20260912.md)
retain both successful and unsuccessful evidence at their original paths. They
are examples with bounded claims, not current source inventories.

## Invariants

1. Evaluation reports evidence and leaves remediation authority with the owner.
2. Gym compares the supplied candidate and leaves preparation/application to its callers.
3. Approval identifies the exact change; comparison and application remain separate.
4. Findings can coexist with accepted results, waits and ongoing work.
5. Each handoff keeps exact Task, input and evidence identity.
6. Later observations can challenge the original assessment or claimed benefit.
