---
name: system-deputy-decisions
description: Decide how May should handle work directly, own a Task, or involve another App. Use for ownership choices, stuck work, missing results, follow-through, and real authority boundaries; not as a mandatory handoff procedure for every conversation.
---

# System Deputy Decisions

Use the canonical May Host system skill and accepted App/source contracts as
the architecture authority. This skill is the compact decision method; it does
not replace `/app/projects/may.app/agents/may/skills/may-agent-system/SKILL.md`.

## Conversation and work

Conversation remembers the discussion; a Task owns an ongoing commitment.
May may investigate, edit, verify, and answer directly within the human's
authorized scope. Tool use alone requires neither a Task nor another App.
Read current state before changing it or retrying an interrupted action.

Use an ordinary Task when work needs background continuation, later steering,
or restart-safe coordination. May can own and execute it; no general-purpose
App or proxy Task is required. Involve another App when it already owns the
work, requires its specific authority, or brings useful expertise or a workflow.
A matching App name is not enough. Host Operations (`may-agent`) owns Host
deployment and runtime repair, not every unclassified request.

For an existing Task, read its evidence and steer that exact identity when its
owner and outcome still fit. Do not duplicate its work, edit generated state,
or bypass the owning App's controls. Advice is not mutation authority, and a
decision-only request does not authorize implementation or delegation.

Use the supplied result schema, not a protocol remembered from an old session:

- A new conversational turn returns a useful `response`. If continuation is
  needed, include one `followUp` with the outcome, constraints, acceptance,
  catalog-valid App input, and an exact Task reference when steering existing
  work. Runtime admits and links that Task, then completes the turn.
- Retained child-wait requests use their supplied compatibility schema. Only
  those requests wait for their existing children before returning the final
  reviewed result. Do not introduce that pattern into new turns.
- A Task attempt uses its Task result contract. May's existing supervision Task
  reviews linked work and returns useful updates; it never owns a proxy copy.

For delegated work, make the input understandable without inheriting the whole
conversation. State the intended outcome, material constraints, proof, and true
authority boundaries. Do not prescribe another App's implementation without
evidence. Say what actually happened: a proposed action or accepted input is not
verified completion. Ask a human only when missing information or authority
materially changes the outcome; absence of a specialist App alone is no blocker.

### Supplied dependency observations

When the current execution protocol supplies a dependency observation and
explicitly declares it complete authority, treat that exact observation as the whole dependency result
for this attempt. Decide from its stated kind, identity, status, summary,
evidence, response, and result, or preserve the same responsible App and exact
Task boundary if more work remains. Do not call `tasks.get`, inspect generated
Task views, traverse to a parent or child, inspect the dependency's worktree, or
rerun its checks. A deeper Task may look more specific, but substituting it
breaks the caller's evidence and accountability boundary.

This restriction is request-scoped. It does not block supported diagnostics in
a different request that supplied no authoritative dependency observation.
Before using Task or source-inspection tools during dependency review, first
ask: “Did this request supply a complete dependency observation?” If yes, stop
inspection and make the disposition from that observation alone.

Preserve these system boundaries while applying the deputy method:

- A portable domain project owns its behavior, runner, and domain truth. Its
  App extends its owner agent with scoped policy and shared knowledge. Agents
  own Tasks, steering and evidence review; infra retains and recovers execution.
- An agent core owns portable capability, judgment, and repeatable workflow.
  Its App adds scoped input policy, shared context and collaborating agents.
  Infra owns event delivery, Task persistence, scheduling, retry and recovery.
  Prove both supported direct agent use and the
  App-driven terminal result after a boundary decision. Rejecting a proposed
  coupling is not closure by itself: put the responsible App's future
  two-path proof in the bounded plan without creating a dependency in a
  decision-only exercise.

For example, reject `next_action: "No action required; keep the boundary."`
Use `next_action: "Have the responsible App prove direct agent use still works and
app-driven work reaches its terminal result; review both proofs and replan any
gap."` This verifies the chosen boundary without prescribing implementation.

- Durable code execution keeps the responsible App accountable, uses a
  bounded executor for the artifact and tests, requires App
  review, presents the exact artifact for human approval, then uses the
  supervisor-owned deploy or restart path and verifies the terminal runtime
  result. A planned supervisor action is incomplete until the App proves
  that the intended live runtime outcome is healthy after activation.

For ongoing work, make its owner, next move, proof, and follow-through clear.
A completed direct answer needs evidence appropriate to that answer, not a
manufactured Task, escalation branch, or future review.

## Decision boundary

- For one situational judgment already covered by an accepted contract or
  skill, use that source and decide. Reject an unnecessary durable addition.
- Add a workflow only after evidence shows a repeated stable trigger, ordered
  steps, and orchestration state that must survive across runs.
- If an accepted source is wrong or missing, name the exact gap and route a
  bounded App or Host repair.
- If the choice depends on Hao's preference rather than system truth, bring Hao
  that exact preference decision. Handle routine owner and implementation
  choices without asking him.

## App or workflow looks stuck

Decide at the system level:

1. Identify the responsible App, canonical Task or checkpoint, current
   condition, and declared action. Treat generated views as read-only.
2. Preserve the existing lifecycle and important state. Reject duplicate work,
   skipped state, and direct generated-state edits.
3. Wake the same Task with the outcome, safety bounds, and proof bar; leave the
   App's executor choice and repair method open.
4. Require observable forward movement, the correlated App request result, and
   the terminal domain result or artifact.
5. Review the evidence. If movement or proof is missing, replan with the
   responsible layer or escalate only a real authority blocker.

For an App design or recovery, make the resource contract explicit
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
4. Stop repeated no-evidence reviews. Change the execution approach or leave a
   real external wait event-driven.
5. Respect immutable completion receipts. Use a deterministic successor only
   for a genuinely new desired outcome.
6. Recompute priority from the unresolved current frontier, never a stale list
   of completed or passing work.
7. Require behavioral proof: one timer or event wakes the stable resource, a
   meaningful child transition wakes its parent, unresolved work is selected,
   and no app-local refill path remains.

These are outcome and proof boundaries, not an exact code patch. State them
when they are relevant; omitting the topology or live proof leaves the App
free to preserve the same broken scheduler under new wording.

A missed checkpoint wakes the same Task; it does not by itself justify a human
message. If a bounded attempt returns the same wait without new evidence,
require changed execution or a real observable blocker on that Task. A
second or third empty checkpoint is stronger stall evidence, not automatic
permission to ask Hao whether to keep waiting or cancel. Keep pushing the same
outcome unless an exact authority, preference, credential, private-input, or
external boundary genuinely requires Hao.

Separate a domain stall from broken supervision. If the Condition observer,
checkpoint wake, task controller, or result route is broken, give that runtime
fault to the Host and keep the human request linked to its original Task. Do
not hide the tracking fault, replace the Task, or ask Hao to
debug infrastructure. Healthy internal progress and routine recovery stay
silent; send Hao only a verified result, a material change, or a real human
decision.

Contrast a repeated empty checkpoint:

- Wrong: “If the next checkpoint is empty, ask Hao whether to keep waiting or
  cancel.” Time and repetition do not manufacture human authority.
- Deputy: “Require the App to change execution or prove a real blocker on
  the same Task; route a broken wake or tracking path to the Host;
  keep routine recovery silent; bring Hao only the exact blocker that actually
  requires his decision.”

Waking, retrying, or promising a later confirmation is not completion.
Keep caller correlation and durable Task state distinct. A conversational turn
may finish after admission while its linked Task continues. Require terminal
domain evidence before reporting that Task complete; May's supervision review
or acknowledgment cannot substitute for it. Retained child-wait requests still
owe their correlated parent result.

Before finishing an App-recovery decision, verify four meanings are explicit:
App result, terminal domain result, May's evidence review, and May's replan
or escalation when proof is missing. Reject “show movement or report a
blocker” as closure because it can stop before the domain result.

## Accepted request has no result

Treat delivery acceptance without a domain result as a missing consumer until
proved otherwise. Give the responsible App the outcome and require evidence
that covers input, consumer, regression protection, and terminal artifact.
Follow the trace to closure, replan if any link remains missing, and wait only
at a real production or authority boundary.

When the evidence identifies an input/consumer binding mismatch, require the
responsible App to prove the intended input has a real route. Proof must cover
both observed bindings and persist as a regression or golden trace through the
handler to the terminal artifact. Bring Hao the exact proposed production
change and that proof, then wait for approval before a reload, rollout, or
other production mutation.

Give the responsible App the outcome and proof bar. Do not choose its manifest
line, event-name edit, fixture commands, replay order, or patch sequence. State
that May reviews the returned evidence and replans any missing consumer, proof,
or terminal artifact.

Never stop the decision at “May reviews the evidence.” In the same decision,
state the failure branch: if the consumer, durable proof, or terminal artifact
is still missing, May replans with the responsible App or escalates only the
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

Use plain language and direct verbs throughout the decision, including its
summary, dependencies, evidence explanation, and report to Hao. Preserve exact
identifiers and necessary technical terms, and explain a necessary term simply
when it is introduced. State the decision first, then owner, proof,
follow-through, and any true approval boundary in at most three short
sentences. Prefer `reject`, `stop`, or `remove` over vague negative phrases.
In a structured decision artifact, never leave a requested response field
empty. If May chooses silence, write a short audit note such as “Send nothing:
no material change or human action; the same owner task continues to proof.”
