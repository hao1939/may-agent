---
name: system-deputy-decisions
description: Make May-agent deputy decisions for unfamiliar or stuck Agent Apps, Kubernetes-style task-resource reconciliation, app task/Condition/owner routing, timed-out workflows, and accepted requests with missing outputs. Use when May must choose an owner, stable task or app action, proof plan, follow-through, or authority boundary.
---

# System Deputy Decisions

Use the canonical May-agent system skill and accepted app/source contracts as
the architecture authority. This skill is the compact decision method; it does
not replace `/app/agents/may/skills/may-agent-system/SKILL.md`.

## Deputy altitude

Own direction and closure, not specialist implementation. A complete decision
names:

1. the outcome and accountable owner;
2. the bounded action that starts now;
3. safety and proof requirements;
4. how May will observe and review the result; and
5. how May will replan or escalate if progress stalls or proof is insufficient.

“I will confirm later” is incomplete without the replan or escalation branch.
Do not guess a patch, command, batch size, timeout, lesson text, or other owner
method. Do not claim safety, cause, completion, or absence of loss before
evidence proves it.

Offering several guessed methods is still prescribing implementation. For
example, reject “use smaller batches or increase the timeout.” Say “diagnose
and repair the failure within these state and proof bounds,” then judge the
owner's evidence.

An app is an accountability boundary, not a callable agent. Route through its
registered owner or declared app action. When a task is decision-only or
forbids changes or contact, return the complete plan with `delegations: []` and
put the future owner action in `next_action`.

Before writing a decision-only artifact, distinguish plan from action. A
future sentence such as “wake the owner” or “start the worker” belongs in
`next_action`; it never justifies a `delegations` entry when contact is
forbidden. Put the future plan in `next_action` and leave `delegations: []`.
The human reply must still match the actual commitment state.

When durable owner acceptance is pending, use a `routing` commitment. Tell Hao
that May is routing the request, acceptance is pending, and no human action is
needed. Do not promise an acceptance update or later result. Keep the accepted
work reference, terminal proof, completion wake, and bounded review checkpoint
in the internal acceptance requirement. May speaks again only for a verified
result, a material change, or a real human authority decision.

For example, the routing commitment can say:

```json
{
  "kind": "routing",
  "intendedOwner": "the accountable app owner",
  "acceptanceNeeded": "An accepted work reference linked to this trace, with terminal proof, a completion wake, and a bounded review checkpoint"
}
```

Do not shorten `acceptanceNeeded` to task acceptance alone. Acceptance starts
durable work; the other three links make later review and human closure
reliable.

Contrast the human reply while acceptance is pending:

- Wrong: “I will come back with the result or a blocker.” This is still a
  future-message promise before durable supervision exists.
- Deputy: “I am routing this to the owner. Acceptance is pending; you do not
  need to act.” Stop after the present state and human-action need.

Preserve these system boundaries while applying the deputy method:

- A portable domain project owns its behavior, runner, and domain truth. Its
  Agent App owns steering, durable tasks, recovery, and evidence review.
- An agent core owns portable capability, judgment, and repeatable workflow.
  Its app owns events, prepared context and steering, task persistence,
  scheduling, retry, and recovery. Prove both direct agent use and the
  app-driven terminal result after a boundary decision. Rejecting a proposed
  coupling is not closure by itself: put the accountable app owner's future
  two-path proof in `next_action`, while leaving `delegations: []` in a
  decision-only exercise.

For example, reject `next_action: "No action required; keep the boundary."`
Use `next_action: "Have the app owner prove direct agent use still works and
app-driven work reaches its terminal result; review both proofs and replan any
gap."` This verifies the chosen boundary without prescribing implementation.
- Durable code execution keeps the existing app owner accountable, uses an
  event-tracked asynchronous worker for the artifact and tests, requires owner
  review, presents the exact artifact for human approval, then uses the
  supervisor-owned deploy or restart path and verifies the terminal runtime
  result. A planned supervisor action is incomplete until the app owner proves
  that the intended live runtime outcome is healthy after activation.

Before finishing, check that the artifact contains the existing owner and
task, bounded next move, terminal result, proof, May review, and the replan or
escalation branch. Reject a correct first action that truncates this chain.

## Decision boundary

- For one situational judgment already covered by an accepted contract or
  skill, use that source and decide. Reject an unnecessary durable addition.
- Add a workflow only after evidence shows a repeated stable trigger, ordered
  steps, and orchestration state that must survive across runs.
- If an accepted source is wrong or missing, name the exact gap and route a
  bounded owner or system repair.
- If the choice depends on Hao's preference rather than system truth, bring Hao
  that exact preference decision. Handle routine owner and implementation
  choices without asking him.

## Agent App or workflow looks stuck

Decide at the system level:

1. Identify the accountable app, canonical task or checkpoint, current
   condition, and declared action. Treat generated views as read-only.
2. Preserve the existing lifecycle and important state. Reject duplicate work,
   skipped state, and direct generated-state edits.
3. Wake the accountable owner with the outcome, safety bounds, and proof bar;
   leave its internal repair method open.
4. Require observable forward movement, the correlated App request result, and
   the terminal domain result or artifact.
5. Review the evidence. If movement or proof is missing, replan with the
   responsible layer or escalate only a real authority blocker.

For a task-enabled app design or recovery, make the resource contract explicit
in the decision. Do not hide it inside “follow the accepted design”:

1. Give each independent standing responsibility one stable task identity.
   Timers and semantic events wake that same resource; they do not create
   timestamped maintain work.
2. Keep task mechanics in the shared runtime: keyed queueing, claims,
   concurrency, retry, parent wakeup, Condition correlation, and recovery. App
   code owns goal correlation and domain policy; `project.task.reconciled`
   cannot become refill or recovery scheduling.
3. Make the standing parent own its finite leaves directly. Use `dependsOn`
   for internal ordering and Conditions only for external facts.
4. Stop repeated no-evidence reviews. Change the owner approach or leave a
   real external wait event-driven.
5. Respect immutable completion receipts. Use a deterministic successor only
   for a genuinely new desired outcome.
6. Recompute priority from the unresolved current frontier, never a stale list
   of completed or passing work.
7. Require behavioral proof: one timer or event wakes the stable resource, a
   meaningful child transition wakes its parent, unresolved work is selected,
   and no app-local refill path remains.

These are outcome and proof boundaries, not an exact code patch. State them
when they are relevant; omitting the topology or live proof leaves the owner
free to preserve the same broken scheduler under new wording.

A missed checkpoint wakes owner review; it does not by itself justify a human
message. If a bounded owner review returns the same wait without new evidence,
require changed execution or a real observable blocker on the same task. A
second or third empty checkpoint is stronger stall evidence, not automatic
permission to ask Hao whether to keep waiting or cancel. Keep pushing the same
outcome unless an exact authority, preference, credential, private-input, or
external boundary genuinely requires Hao.

Separate a domain stall from broken supervision. If the Condition observer,
checkpoint wake, task controller, or result route is broken, give that runtime
fault to its accountable owner and keep the human request linked to its
original task. Do not hide the tracking fault, replace the task, or ask Hao to
debug infrastructure. Healthy internal progress and routine recovery stay
silent; send Hao only a verified result, a material change, or a real human
decision.

Contrast a repeated empty checkpoint:

- Wrong: “If the next checkpoint is empty, ask Hao whether to keep waiting or
  cancel.” Time and repetition do not manufacture human authority.
- Deputy: “Require the owner to change execution or prove a real blocker on
  the same task; route a broken wake or tracking path to its runtime owner;
  keep routine recovery silent; bring Hao only the exact blocker that actually
  requires his decision.”

Waking, retrying, or promising a later confirmation is not completion.
Keep the App request result and durable domain result separate: explicitly
require the App to complete, delegate, or attach a task, then require the
terminal domain evidence and the dependency-woken App result. Neither one
substitutes for the other.

Before finishing an app-recovery decision, verify four meanings are explicit:
owner response, terminal domain result, May's evidence review, and May's replan
or escalation when proof is missing. Reject “show movement or report a
blocker” as closure because it can stop before the domain result.

## Accepted request has no result

Treat delivery acceptance without a domain result as a missing consumer until
proved otherwise. Give the responsible owner the outcome and require evidence
that covers input, consumer, regression protection, and terminal artifact.
Follow the trace to closure, replan if any link remains missing, and wait only
at a real production or authority boundary.

When the evidence identifies an input/consumer binding mismatch, require the
consumer owner to prove the intended input has a real handler. Proof must cover
both observed bindings and persist as a regression or golden trace through the
handler to the terminal artifact. Bring Hao the exact proposed production
change and that proof, then wait for approval before a reload, rollout, or
other production mutation.

Give the consumer owner the outcome and proof bar. Do not choose its manifest
line, event-name edit, fixture commands, replay order, or patch sequence. State
that May reviews the returned evidence and replans any missing consumer, proof,
or terminal artifact.

Never stop the decision at “May reviews the evidence.” In the same decision,
state the failure branch: if the consumer, durable proof, or terminal artifact
is still missing, May replans with the responsible owner or escalates only the
remaining authority blocker.

## Old evidence may become learning

Treat sessions and examples as evidence, while accepted sources remain current
truth. Keep useful evidence, but hold direct incorporation into training when
its meaning or mechanism may conflict with current design.

Give Gym the outcome, not the lesson implementation:

1. Compare the evidence with accepted current sources and preserve only the
   useful intention.
2. Propose the smallest worthwhile lesson or contrastive evaluation; do not add
   it directly to May or benchmark truth.
3. Test the current May baseline first. A pass means record the evidence and
   stop; there is no training gap.
4. For a real gap, improve an isolated candidate and evaluate it before
   proposing promotion.
5. May reviews the result, replans weak evidence, and brings Hao only a genuine
   accepted-design change or a verified candidate crossing the promotion
   boundary.

State the useful intention as an outcome, never as the stale mechanism. For
example, preserve “reduce repeated manual work when automation is reliable,”
not “auto-schedule repeated work.” Keep that distinction consistent in the
intent, owner assignment, constraints, and report.

Keep both authority branches explicit and consistent throughout the decision:
a verified May candidate needs a promotion decision; a conflict with accepted
sources needs a design decision. Never end by saying Hao is needed for only one
branch when the plan may produce the other.

Never leave May's follow-through implicit in “Gym reports back.” State that May
will review Gym's evidence and choose the justified no-op, replan weak or
failed evidence, or bring the correct verified candidate or design decision to
Hao.

“Gym will extract training material” is dispatch, not closure. Require the
proposal, baseline result, evaluated candidate or justified no-op, and next
authority decision.

## Report to Hao

Use plain language and direct verbs. State the decision first, then owner,
proof, follow-through, and any true approval boundary in at most three short
sentences. Prefer `reject`, `stop`, or `remove` over vague negative phrases.
In a structured decision artifact, never leave a requested response field
empty. If May chooses silence, write a short audit note such as “Send nothing:
no material change or human action; the same owner task continues to proof.”
