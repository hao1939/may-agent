# Practice Learning Loop

**Design status:** Accepted. Candidate decisions remain append-only evidence,
while implementation work stays in the owning App/project.
**Implementation status:** Partial; evaluation trails, owner findings, and an
append-only candidate log exist. Applying, validating, promoting, and retiring
changes remain owner decisions.
**Aligned with:** [Work Model](../1-principles/work-model.md),
[Agent Evolution](../1-principles/evolution.md),
[Session Evaluation Trail](session-eval-trail.md), [Projects](projects.md),
[Metrics](metrics.md), and [Guards](guards.md)

## Purpose

May-agent learns from real work by preserving what happened, reviewing it,
routing actionable findings to an accountable owner, and validating any later
change against new evidence.

```text
root event and trace
  -> bounded session/workflow
  -> raw transcript and result
  -> append-only evaluation
  -> optional owner finding or learning candidate
  -> normal owner/project work
  -> later evidence
  -> keep, revise, or retire
```

One session can suggest a candidate. It does not automatically rewrite prompts,
create a workflow, install a guard, mutate project tasks, or prove that a change
works.

## Authority

| Record | Authority |
| --- | --- |
| Root event and trace | Why work began and what caused later work |
| Session artifacts | What the agent saw, did, and claimed |
| `session.eval.jsonl` | Append-only evaluator and human judgment for that session |
| `evaluations` table | Bounded query projection, not full critique authority |
| `evaluation.app/.state/learning-candidates.jsonl` | Append-only candidate and owner-decision log |
| Project/app task state | Durable implementation work and current owner posture |
| Skills, workflows, tools, guards, design, and knowledge | Reusable experience after owner acceptance |
| Metrics and later evaluations | Signals used to validate or challenge the change |

Do not create a second request, project, task, or evaluation lifecycle. The
existing event trace and domain records remain the work identity.

## Evaluation model

Evaluation should distinguish four causes:

| Target | Question |
| --- | --- |
| `intent_context` | Was the triggering intent current, grounded, and bounded? |
| `execution` | Did the agent choose and adapt useful actions? |
| `result` | Did the run produce a useful, honest result? |
| `verification` | Did evidence support the completion claim? |

A guard trigger, failed session, red metric, or reviewer disagreement is a
hypothesis, not proof that the acting agent is at fault. The evaluator compares
the raw transcript, tool results, project context, and final claim before
assigning an owner or suggesting a change.

Every evaluation is persisted. Only actionable findings emit
`learning.feedback`. Routine critique remains in the evaluation trail for
bounded owner review.

## Owner findings

An actionable finding names a concrete accountable owner:

```text
agent:<name>
human:<role>
```

Scope and owner are separate. A workflow problem may be scoped to `workflow`
but owned by the agent responsible for that workflow.

A finding should include:

- session and evaluation evidence;
- affected scope and severity;
- what is wrong or uncertain;
- why it matters;
- possible actions; and
- whether immediate owner review is justified.

Suggested actions are not commands. The owner may accept, revise, reject,
defer, or record an evidence-backed no-op.

## Candidate log

The Evaluation app currently keeps one bounded append-only log:

```text
projects/evaluation.app/.state/learning-candidates.jsonl
```

The current row-status vocabulary is:

```text
proposed | validated | promoted | applied | rejected
```

These values are append-only decision labels, not a runtime state machine. The
current helper requires an existing proposal but does not enforce a transition
sequence among later decisions. Any stricter promotion/validation policy
belongs to the owner-facing refinement, not to readers guessing from row order.

Each appended row preserves `candidateId`, source/review session IDs, agent,
artifact path, summary/evidence, owner, status, and timestamp. A candidate ID is
stable for the source session and review artifact, so repeated delivery does
not create duplicate proposals.

The log records proposals and decisions; it is not an automatic scheduler or a
global truth registry. If a candidate needs implementation work, the owner
creates or updates ordinary project/app work through the normal task boundary.

A later refinement may add explicit revision/retirement decisions, but it must
remain append-only and must not introduce another mutable work tree.

## Choosing the improvement mechanism

The owner selects the smallest mechanism that matches the cause:

| Observed cause | Likely response |
| --- | --- |
| Environment-specific fact | Owned context or knowledge |
| Reusable judgment method | Skill |
| Repeated sequence/verification failure | Agent-owned workflow |
| Missing deterministic capability | Tool or SDK |
| Precise mechanical risk | Observe/warn guard, then block only after evidence |
| Trigger or observation gap | Handler, schedule, watcher, or metric |
| Durable multi-run implementation | Agent App and optional task resources |
| Cross-owner required action | Escalation |

Frequency alone does not justify automation. Debug misleading input before
adding prompt rules, workflows, or guards.

## Applying a candidate

Application follows the normal ownership path:

```text
owner reviews proposal
  -> accepts/revises/rejects
  -> creates bounded project work when change is needed
  -> implements and verifies through ordinary tools/workflows
  -> appends candidate decision with evidence
```

The evaluator does not edit another owner's instructions, workflow, task state,
or metric merely because it found a problem. Human corrections append to the
same evaluation trail and may reverse or narrow the evaluator's claim.

## Later validation

A candidate is not proven when the patch lands. Its validation plan should name:

- expected behavior change;
- affected scope;
- comparison window or minimum later sample;
- false-positive or regression signal;
- evidence source; and
- review owner/deadline.

Later sessions, evaluations, task receipts, guard reviews, or domain metrics may
support keeping, revising, or retiring the change. Metrics remain advisory; a
single threshold does not promote a candidate automatically.

## Current implementation

The Evaluation app currently:

- writes append-only session evaluation trails;
- produces structured target breakdowns and concrete owner findings;
- emits `learning.feedback` only for actionable findings;
- emits reviewed success-candidate evidence;
- appends an idempotent `proposed` candidate when reviewed evidence says a
  learning item was created; and
- provides append-only candidate decision helpers with focused tests.

The implementation does not yet provide one complete owner-facing path for
reviewing candidates, linking an applied change, scheduling later validation,
or recording retirement.

## Remaining work

1. Expose bounded candidate evidence and decisions in the Evaluation owner/UI
   read model.
2. Route accepted candidates into ordinary owner/project work without creating
   a parallel learning task system.
3. Link applied changes and verification evidence back to the candidate.
4. Add later-validation review and explicit revise/retire decisions.
5. Add only the minimal metrics needed to observe recurrence, disagreement, and
   validation coverage.

## Guardrails

- Preserve raw session evidence and evaluator/human disagreement.
- Do not train or mutate behavior from evaluator output alone.
- Do not auto-create global guards or workflows from one session.
- Do not treat successful implementation as outcome validation.
- Do not let metrics or evaluator scores become acceptance authorities.
- Do not let the candidate log become another task tree or scheduler.
- Keep reusable workflows owned by the agent that learned and operates them.
