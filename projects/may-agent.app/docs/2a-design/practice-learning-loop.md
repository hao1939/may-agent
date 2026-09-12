# Practice Learning Loop

**Design status:** Accepted.
**Implementation status:** Implemented for Evaluation evidence, generated agent
feedback, and Gym's May-improvement intake. Actual feedback consumption and
verified activation after approved source promotion remain adoption gaps below;
this is not yet a verified end-to-end installed improvement loop.
**Aligned with:** [Work Model](../1-principles/work-model.md),
[Agent Evolution](../1-principles/evolution.md),
[Session Evaluation Trail](session-eval-trail.md), [Projects](projects.md), and
[Metrics](metrics.md).

## Purpose

The May system learns from real work without turning evaluation into an automatic
prompt writer or a second work system.

```text
session ends
  -> Evaluation records one bounded judgment
  -> evaluation.recorded becomes durable evidence
  -> Evaluation refreshes disposable agent feedback
  -> Gym classifies May evidence independently
  -> only actionable May failures enter Gym review
  -> Gym tests one isolated candidate against approved truth
  -> an exact verified artifact requires human approval
  -> later evaluations test whether behavior improved
```

One evaluation can reveal a problem. It cannot by itself change an agent,
workflow, skill, guard, benchmark, or task.

## Authority

| Record                                     | Meaning                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Root event, request, task, and trace       | Why work began and which obligation owns the result              |
| Session transcript and result              | What the agent saw, did, and claimed                             |
| `session.eval.jsonl`                       | Append-only supporting evaluator or human notes for that session |
| `evaluation.recorded`                      | Durable automatic Evaluation fact                                |
| `evaluations` table                        | Query projection derived from Evaluation facts                   |
| `evaluation.app/generated/agent-feedback/` | Disposable latest-issue context for an evaluated agent           |
| `gym.app/.state/learning/evidence/`        | Gym-owned idempotent classification input for May improvement    |
| Gym benchmark runs and approved labels     | Evidence that a candidate is better and safe to propose          |
| App requests and task resources            | Durable owner work and desired outcomes                          |

There is no global learning-candidate log, promotion registry, learning queue,
or mutable evaluation lifecycle. Historical files with those names are old
evidence, not current authority.

## Evaluation

Evaluation distinguishes the cause before assigning work:

| Target         | Question                                                  |
| -------------- | --------------------------------------------------------- |
| Intent/context | Was the triggering intent current, grounded, and bounded? |
| Execution      | Did the agent choose and adapt useful actions?            |
| Result         | Did the run produce a useful, honest result?              |
| Verification   | Does evidence support the completion claim?               |

A guard trigger, failed session, red metric, or reviewer disagreement is a
hypothesis. The evaluator compares bounded transcript evidence, tool results,
project context, and the final claim before producing `evaluation.recorded`.

Concrete findings for an accountable App use `project.owner.requested`. Only a
specific human decision, approval, or missing input creates a May request.
Routine critique remains evidence and generated feedback; it does not create
owner work.

## Gym intake

Gym explicitly subscribes to `evaluation.recorded` and accepts only non-skipped
evaluations whose nested `evaluation.agent` is `may`. One stable intake task
records positive or negative evidence idempotently. Only a negative, actionable
May finding creates an incident review request.

Gym preserves approved benchmark truth and withheld evaluation boundaries. It
may build and test an isolated candidate, but production May changes only after
the exact fingerprinted artifact passes required comparisons and Hao approves
that artifact.

This makes Evaluation and Gym independent:

- Evaluation judges whether a session was good;
- Gym decides whether the evidence teaches May anything reusable;
- the owning mechanism decides how to implement a reviewed change; and
- later evidence decides whether to keep, revise, or retire it.

## Choosing the mechanism

The owner selects the smallest durable mechanism matching the cause:

| Observed cause                   | Likely response                             |
| -------------------------------- | ------------------------------------------- |
| Changing environment fact        | Owned context or knowledge                  |
| Reusable judgment method         | Skill                                       |
| Repeated ordered process         | Agent-owned workflow                        |
| Missing deterministic capability | Tool or SDK                                 |
| Precise mechanical risk          | Calibrated guard                            |
| Trigger or observation gap       | Subscription, schedule, observer, or metric |
| Durable multi-attempt outcome    | App task resource                     |
| Cross-owner required action      | Linked child App request or exact Condition |

Frequency alone does not justify automation. Diagnose misleading input,
benchmark truth, scorer, harness, and provider failures before changing May.

## Validation

A landed change is not proof of improvement. Its evidence names:

- expected behavior change and affected scope;
- approved comparison cases and framework revision;
- baseline and candidate fingerprints;
- invalid-run and regression policy;
- the exact approval identity when promotion is requested; and
- later session or metric evidence that can challenge the change.

## Remaining adoption gaps

The bounded [agent-operated](../proposals/agent-operated-improvement-poc-20260912.md)
and [ordinary-Task](../proposals/task-improvement-poc-20260912.md) trials show why
evidence must distinguish saved source, successful activation, fresh execution
and useful behavior. Their unsuccessful wiring/scoring trials remain visible;
they are not automatically failures of the target agent. Those trials support
the mechanism, not an installed autonomous improvement service. Their completed
harnesses follow the [retirement decision](../proposals/poc-retirement-and-knowledge-20260912.md);
use the existing runtime/activation regressions, not obsolete main-branch commands.

The [local integration candidate](../proposals/feedback-adoption-integration-20260912.md)
restores Evaluation-owned generated feedback and labels source-only promotion
as unverified owner attention. Four isolated model checks prove the reference
can be read and updated without reload. Its ordinary-Task follow-up proves
adoption in fresh dispatches and retains an unsuccessful immediate-wake trial:
an already-dispatched worker may still use old source after reload succeeds.
The linked-Gym no-model trial returns exact source evidence through an existing
App dependency to the same owning Task. It also fixes a missing source-event
key and preserves completed-copy evidence across publication failure. This is
not deployed; production owner acceptance of behavior evidence against Gym's
pending checkpoint remains unimplemented.
The following source findings describe the baseline that motivated that candidate.

Source review and the [isolated method trial](../proposals/extension-methods-poc-20260912.md)
distinguish three existing boundaries; the trial changes no production policy:

- Evaluation's projection prefers the target agent's `last-eval.md`, whereas
  installed shared guidance names a generated feedback path. Normal prompt
  preparation loads neither body. Agree one owned output/reference path and
  verify the target actually reads the relevant evidence. A UI listing a file
  under prompt content is not execution proof. Feedback is mutable evidence;
  its reference must reach the current record, not an old definition snapshot.
- Gym's approved-agent-overlay branch validates the artifact fingerprint,
  copies the files and emits `agent.revision.changed`. It does not itself
  commit, reload or verify active definitions. “Applied source” must not imply
  “active behavior.” Use the existing authorized source activation boundary
  and a fresh relevant execution to prove adoption.
- Current intake and improvement plans target May. A bounded experiment shows
  one agent can author another agent's isolated guidance, but does not implement
  or authorize general automatic cross-agent promotion.

Reuse the existing candidate comparison/revision loop and Task evidence; no
new learning controller is needed. Preserve exact-artifact approval, protected
evaluation truth, valid-run accounting and unrelated/regression controls.
Stored source can survive restart without being active; feedback can survive
without being read. Later outcomes must be able to challenge an adopted lesson.

## Invariants

1. Evaluation facts are evidence, not commands.
2. Evaluation never edits another App's task state or implementation.
3. Gym never changes approved truth or production May without exact approval.
4. Generated feedback and Gym intake files are projections/evidence, not work
   authorities.
5. A workflow or skill change remains owned by the agent that operates it.
6. Later observations may overturn an earlier evaluator or Gym judgment.
