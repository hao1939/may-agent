# Two-Loop Operating Model

Status: canonical project-control contract

## Purpose

`aks-rp-e2e.app` has two nested control loops with different jobs:

```text
work loop
goal gap -> plan -> execute -> review -> evidence/model update -> next gap
                           |
                           v
feedback loop
detect abnormal state -> diagnose -> change responsible artifact
                      -> bounded verification -> restore
```

The work loop advances AKS knowledge and verification. The feedback loop exists
only to return the work loop to a truthful normal state. Feedback activity is
not project progress by itself.

## Work Loop

The work loop owns outcomes under `domain/*`:

- source-backed feature knowledge;
- runnable specs and replay carriers;
- live or explicitly non-live verification evidence;
- compact feature packages;
- diagnosis and model feedback from observed results.

The three durable controllers are work-loop mechanisms:

- feature-reference loop;
- spec-verification loop;
- feature-compact loop.

The work loop is normal when at least one of these is true:

1. a concrete domain leaf is runnable, active, or in review;
2. all current goal gaps are accepted terminal dispositions;
3. every remaining gap has an accepted terminal disposition.

An all-blocked frontier is not a normal resting state. The project lifecycle
stays `active` and the feedback loop must keep searching for the best truthful
unblock: a local repair, a bounded alternative carrier, a changed external
fact, a sent escalation, or evidence strong enough to make a gap terminal.

The project root goal comes from `project.json` and is immutable operating
context. Focus plans, recovery campaigns, and blocked-frontier cleanup may
change, but they live below the root and must not replace the project goal.

## Feedback Loop

The feedback loop owns process restoration under `ops/*`:

```text
detected
  -> diagnosed
  -> repair-ready
  -> bounded canary/review
  -> restored
```

An external dependency branches without pretending to be restored:

```text
diagnosed -> external handoff sent -> response wait -> response -> restored
```

Feedback has only two successful exits:

- **restored**: an affected domain slice returned to runnable, active, review,
  verified, or accepted-terminal state after a material change;
- **terminally resolved**: the gap is accepted as a supported terminal
  product, environment, policy, or evidence-ceiling disposition with a retest
  condition where appropriate.

A diagnosis, review, report, notification, or accepted message is not a
feedback-loop exit. Feedback must return to the artifact that controls the
outcome: a spec, scenario test, fixture, compact plan, workflow, prompt,
project model, or app/runtime implementation. The responsible owner either
changes that artifact and verifies the result, or rejects the finding with
evidence. Delivery proves that the owner received the finding; it does not
prove correction.

The same rule applies to event-backed state. "This escalation should close" is
not a state change. The reviewer may return the exact canonical closure event
as part of its judgment; workflow code validates and emits it. The next
measurement must observe that linked event before the feedback item counts as
closed.

Task review uses the same rule:

```text
worker output
  -> reviewer names the acceptance gap, affected artifacts, and verification
  -> planner preserves that complete review on redo/follow-up
  -> next worker changes the artifact and verifies it
  -> reviewer accepts or returns it again
```

When the same defect recurs across outputs, the correction moves to the shared
source that produces them. Repairing a generator, fixture, workflow, prompt,
or model and verifying representative outputs is learning. Writing another
report about the recurrence is not.

Creating, refreshing, consolidating, or describing a blocked wait is useful
bookkeeping, but it is not restoration. It must not count as feedback success
or suppress work-starvation signals. A blocked-only frontier remains an active
recovery incident.

## Invariants

1. Root task rollup and project lifecycle are different signals. A root task
   may be `blocked` because its children are blocked while the project remains
   active and therefore still subject to starvation and gap alerts.
2. All catalog metrics use the same feature-owned spec discovery and spec-loop
   ledger as execution. A removed legacy index must never turn a non-empty
   catalog into `0 total / 0 unverified`.
3. Feedback work cannot rewrite the project root goal.
4. The planner moves unrelated work forward when one family is blocked.
5. An owner-response wait requires durable proof that the ask or escalation was
   sent. An unsent ask is runnable ops work, not an external wait.
6. Repeating the same input, error, diagnosis, and external facts is not
   progress. After the bounded attempt budget, change the tactic, escalate, or
   seek an evidence-backed terminal disposition.
7. Outcome deltas and control-plane activity are reported separately. Task
   completions, wait refreshes, and planner wakes do not substitute for specs
   verified, paths resolved, evidence produced, or work restored.
8. A redo preserves the complete structured review. The next attempt receives
   the original goal, prior findings and feedback, affected artifacts, and the
   verification required for acceptance.

## Observability Contract

The operator readout must answer both questions independently:

```text
work loop:     is domain work advancing toward the project goal?
feedback loop: are abnormal slices being restored within their recovery age?
```

Minimum signals:

- canonical spec totals: verified, reviewed exception, unverified, failed;
- non-terminal model gaps and their owned work;
- runnable, active, review, and blocked frontier counts;
- work-starvation while lifecycle is active;
- recovery attempts that restored runnable or verified work;
- external handoffs sent, awaiting response, overdue, and resolved;
- outcome deltas versus planner/task/wait-maintenance activity.

The health model must not call a project healthy merely because all blocked
records are structurally valid. Exact waits prove truthful representation; they
do not prove motion.

## Planner Rule

For every abnormal event, the planner chooses one outcome:

1. restore locally and verify;
2. create a bounded repair that can restore the affected slice;
3. send and track an external handoff, then continue unrelated work;
4. if no unrelated work exists, immediately enter bounded blocked-frontier
   recovery and choose the highest-leverage causal blocker;
5. accept a terminal product/environment disposition with evidence.

The planner must never use root-goal rewriting or repeated wait refreshes as a
substitute for one of these outcomes.
