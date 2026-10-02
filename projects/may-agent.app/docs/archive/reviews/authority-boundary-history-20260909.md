# Authority-boundary review history — September 9, 2026

**Historical context:** [Host And App Boundary](../../2a-design/system-boundary.md). Retained rationale and evidence; this record does not define the current contract.

> Historical snapshot of the August 29–September 8 proposal and review notes.
> Status, operational observations and authorization statements below describe
> those dated sessions; they are not current permissions or deployment status.
> Current rules live in [Message Lifecycle](../../2a-design/message-lifecycle.md);
> remaining decisions live in the [active proposal](../../proposals/authority-boundary-simplification.md).

# Proposal — One Fact, One Owner

**Status:** September 8 May-only source cleanup implemented and published for
review. The full proposal and product rollout are not complete. The original
assistant is working directly; no supervised worker is active.

**Created:** 2026-08-29. **Refined:** 2026-09-08.

**Purpose:** Make May's work converge with fewer control paths and fewer
unnecessary model decisions. Apply lessons from the MLVM incident and Herdr
Supervisor without replacing May's Task engine.

**Current scope:** The human approved the focused source cleanup below, then
stopped its supervised goal and asked the original assistant to implement it
directly. The later request to create PRs authorizes source publication as well
as isolated checks. Merging, deployment, model-backed experiments, and restarting
the earlier pilot remain outside this pass. Stopping delegation does not cancel
this source work or complete any earlier work.
The subsequent human clarification limits this pass to May: apply A's audit
and B's attempt-context cleanup. C is retained as a separate known gap, not an
instruction to work on `evaluation.app` during this pass.
Start with [the current decision](#current-decision-conversation-and-task).
The remaining sections preserve the earlier authority and delivery proposal.

The September 8 direct-work decision is now incorporated into
[Message Lifecycle](../../2a-design/message-lifecycle.md),
[System Model](../../2a-design/system-model.md), and
[App Contract](../../2a-design/agent-app.md). Those pages own the current contract.
The dated source/pilot sections below preserve review evidence and earlier
scope; they do not establish the current deployed release or extend authority.

## Current decision: Conversation and Task

The human rejected mandatory handoffs and approved this refinement on September
8. Separate responsibilities, not May's abilities:

- Conversation remembers discussion, decisions, and exact Task references.
- A Task owns an ongoing commitment, its progress, and completion evidence.
- May may investigate, edit, verify, and answer directly in an authorized turn.
  Tool use alone needs neither a Task nor a handoff.
- Work needing continuation, later steering, or restart-safe coordination uses
  an ordinary Task. May can own and execute it; no general-purpose App or May
  proxy Task is required.
- Use another App for existing Task ownership, required authority, or useful
  expertise or workflows, not merely a matching name. Existing controls and
  Host deployment authority still apply.
- Both paths use the shared bounded executor. Keep one Task runtime and the
  existing linked-work follow-through; add no router, watcher, or work lifecycle.

This supersedes earlier wording that limits May to understanding and routing.
The scoped implementation is published as
[Host PR #79](https://github.com/hao1939/may-agent/pull/79), commit `952a0fa1`,
with paired App/docs commit `e431ac3514`. Both use branch
`codex/may-direct-conversation-work-20260908`. It reuses the full bounded App tool
profile for new conversational turns, preserves retained child-wait profiles,
and updates the shared guidance, relevant skills, and current design. The
earlier child-wait deletion remains deferred. No live deployment or state
migration is part of this change.

The regression checks use scripted model decisions with real tools and request
admission. They do not establish improved model judgment or exactly-once
external side effects across a crash. Interrupted actions require checking
current evidence before retrying; accepted work is not replayed.

**September 8 source progress:** [Host PR #77](https://github.com/hao1939/may-agent/pull/77)
contains the model-context refinement and regression checks. New direct-handoff
turns no longer receive the child-waiting response option, and May receives its
own durable goal input contract. Retained child waits keep the original protocol.
May's shared guidance is reduced from 146 to 47 lines without adding a role router.
The paired App/docs review branch is `codex/may-focused-conversation-20260908`
in the existing bare Git repository; its exact revision is recorded in the PR.
The isolated App's existing convergence tracker holds the implementation evidence.
Neither source publication nor passing tests proves better model judgment or
deployment behavior. Nothing has been merged, deployed, or migrated by this pass.

**What is done, and what is not:**

- A's source audit is complete. A later read-only local audit found one
  unanswered May parent waiting on two completed child requests. Keep the public
  waiting path until retained obligations are recovered and the affected
  installed-caller inventory is complete; no live repair has been performed.
- B's instruction and model-context cleanup is implemented, with checks for
  both new direct handoff and retained child-wait recovery.
- A baseline/candidate model-backed conversation comparison remains unrun and
  requires separate authority. Shorter instructions alone do not prove improvement.
- C's Evaluation change and the older delivery/production pilot remain outside
  this May-only pass. Do not reopen them just to call the whole proposal done.

**Earlier pilot scope:** The human authorized implementation and an isolated MLVM experiment
to finish this proposal. The candidate uses separate App/state roots and the
explicit host `/workspace/app` → container `/app` bind. The old May deployment
and its incident state remain stopped and untouched. This document does not
authorize production migration, publication, approval, or merge. Fix lifecycle
and blocker handling first, prove one delivery workflow, then remove only
demonstrated duplication.

**Related design:** [System Model](../../2a-design/system-model.md),
[Host and App Boundary](../../2a-design/system-boundary.md),
[Events](../../2a-design/events.md), and
[Task Resource Engine](../../2a-design/task-resource-engine.md).

## Current review: make May focused and tight

### Proposed decision

Make May a conversational deputy with reliable follow-through, supported by
one Task runtime. Do not make it the universal worker, recovery operator, or
owner of every App's outcome.

```text
Human talks to May
  -> answer or clarify; no background Task needed
  -> for durable work, create or steer the responsible App's Task
       -> that App owns the work and decides whether it is complete
       -> meaningful changes wake May's existing supervision Task
       -> May gives a useful update or asks for a real human decision
```

These are existing roles, not new services or agent types. May may still own a
Task when the outcome genuinely belongs to it. One Task may use several
bounded attempts or legitimate child Tasks. The rule is one owner per outcome,
not one Task for an entire conversation or one tool call per worker.

The human should see the discussion, the actual work, and anything needed from
them. Closing Console must not stop work; reopening or saying “continue that”
must recover the relevant Topic and exact Task rather than create a copy.
An admission message means work was accepted, not that it succeeded.

### What Herdr teaches us

Herdr stays focused partly because Herdr and native workers supply execution
machinery outside the supervisor. May implements more of that machinery itself.
Repository size alone is therefore not a fair simplicity comparison.

Borrow three rules:

1. **One owner for each fact and decision.** Conversation preserves discussion;
   the responsible Task preserves the outcome; execution records explain an
   attempt. May's follow-through does not accept another App's result for it.
2. **One clear job for the current turn.** A conversational turn understands and
   routes; a supervision attempt judges linked progress; a domain attempt does
   its App's work. Reuse current attempts and result validation, not Herdr's
   review state machine.
3. **Fix the missing piece, not the whole architecture.** First ask whether the
   agent has the necessary tools, a reliable wake, and sufficient context.
   When it does, improve trusted guidance. Add code for a missing deterministic
   capability or safety rule. Keep useful App workflows for proven repeatable
   procedures; neither “everything in prompts” nor “everything in code” is the
   goal.

Events carry facts, not authority or executable instructions. Provider text
remains untrusted evidence. Existing observers, exact Task wakes, and bounded
recovery checks stay in place. This proposal does not adopt Herdr or its watcher
topology, or revive the rejected direct-external-worker-wake design.

### Evidence and proposed cleanup

The September 8 comparison used Host `e1a36126229826a0848ec6687bd07c5c950c75e7`,
App/design `d8baf6e0c73f4215bdbebf5b0160fb45b1767145`, and Herdr runtime/design
`e3b6149` (the subsequent main changes inspected were release/dependency changes).
This is source evidence, not a new live experiment. The working `/app` tree has
unrelated edits; it is not assumed to match those revisions.

**A. Retire unnecessary conversational request waiting — first candidate.**

The Host currently supports both a `followUp` that admits the responsible Task
and completes the frontend request, and `dependencies` that keep a request open
while child requests finish. See the pinned
[request prompt](https://github.com/hao1939/may-agent/blob/e1a36126229826a0848ec6687bd07c5c950c75e7/src/app/app-request-agent.ts#L65)
and [request completion/waiting code](https://github.com/hao1939/may-agent/blob/e1a36126229826a0848ec6687bd07c5c950c75e7/src/app/app-inbox-host.ts#L1230).
The current [message lifecycle](../../2a-design/message-lifecycle.md) chooses direct
Task admission for May. In the reviewed App tree, May is the only App declaring
the conversational `requests` attachment. That is a lead, not proof that the
other public path is unused.

Before deletion, inventory SDK consumers, sibling Apps including Gym, fixtures,
and retained open requests in any affected installation. Distinguish ordinary
request/result correlation and Task-to-Task dependencies from frontend-owned
child-request waiting. Preserve the first two. Do not remove a shared helper
just because its conversational caller disappears.

If the extra path is unused, remove its decision fields, prompting, waiting,
and re-entry logic together. If it has real callers or unfinished requests,
identify their required behavior and an explicit migration/drain plan first;
otherwise defer deletion. Never discard retained obligations or silently
reinterpret old requests. An unavailable deployment audit means deletion is
not yet proven safe, not permission to guess.

**B. Give May only the instructions relevant to its current job.**

The reviewed `agents/may/AGENTS.md` mixes conversational guidance, supervision,
general execution, and a Host Operations `owner-review` procedure. The Host's
request prompt also repeats conversational policy. This increases the amount
of role selection the model must do; it is not proof of a measured failure rate.

Keep common human-authority and communication rules shared. Place domain
procedures with the owning App and load the required guidance through the
existing attempt context. Keep Host protocol instructions about schemas,
identity, and validated effects. Reuse the current App/agent declarations;
do not add a prompt registry, role router, new service, or durable role state.
Moving a rule is complete only when the intended attempt still receives it.

**C. Make HTTP a transport for evaluation, not its policy owner.**

Deferred outside the current May-only implementation pass by the human's
scope clarification. The findings below remain valid but are not active work.

The pinned [HTTP handlers](https://github.com/hao1939/may-agent/blob/e1a36126229826a0848ec6687bd07c5c950c75e7/src/app/http/server.ts#L1346)
construct evaluation instructions and append human feedback to evaluation
files. Move those responsibilities to Evaluation through the existing typed
App/event path. HTTP retains request validation and presentation.

This is a separate coordinated Host/Evaluation change, not a prerequisite for
A or B. Preserve exact session/line identity, feedback history, and the UI's
meaning of accepted versus saved. Repeated delivery must not append duplicate
feedback. Do not return “saved” merely because asynchronous input was admitted;
either preserve the existing response contract or update the consumer explicitly.

### Order, proof, and stopping rule

After scope approval:

1. Audit A and capture regression cases before changing its public contract.
   Remove only the path shown to be redundant, or report the exact consumer
   that prevents deletion. Do not build a migration framework to force a win.
2. Narrow B using the existing context machinery. Test both that irrelevant
   procedures are absent and that required authority/acceptance guidance remains.
3. Handle C separately with linked Host/App revisions and integration order.
   Do not mix a partial Evaluation migration into conversational cleanup.

Use existing portable tests and an isolated end-to-end fixture to cover:

| Scenario | Required result |
| --- | --- |
| Ask a question about a focused Task | Useful answer; no work creation, steering, or cancellation |
| Ask for durable work, then refine it | Prompt acknowledgment after durable admission; feedback reaches the same unfinished Task |
| Close and reopen Console, then resume the Topic | Work continues independently; the same Task and accepted history remain visible |
| Duplicate input or interrupt admission before the reply | Recover one obligation; no duplicate Task or lost Topic link |
| Background progress, a real wait, or completion | May uses existing supervision, leaves healthy work alone, and reports meaningful changes without owning the destination outcome |
| Late result after cancellation, a newer attempt, or restart | Existing identity and stale-result checks reject invalid effects; accepted state survives |
| Required instructions or Evaluation delivery fail | Visible failure or pending state, never a false completion or feedback-save claim |

Prompt/context tests establish what the model receives, not how well it reasons.
Before claiming improved behavior, compare baseline and candidate on the same
small model-backed conversation cases, with separate authority and credentials.
Record wrong-owner choices, duplicate Tasks, missed follow-ups, unnecessary
model turns, and response latency from existing evidence. Include whether an
answer remains useful; shorter prompts alone are not success. No new metrics
service or arbitrary target is needed.

Keep generation/attempt fences, accepted results, exact waits, cancellation,
bounded execution, and recovery. Keep UI adapters optional. Do not replace the
Task engine, introduce another supervisor/queue/work lifecycle, redesign the
UI, or make a PR-delivery workflow mandatory for all work.

For each slice, report the behavior preserved, the path or responsibility
removed, production code added/deleted, and validation actually run. Tests may
grow. Merely moving code or renaming concepts is not a simplification claim.
Stop expanding the slice once its ownership duplication is gone and its
behavior is proven; large files alone do not justify another refactor.

### Decisions requested in this review

1. Keep May focused on conversation and follow-through, with domain outcomes
   accepted only by their owning Apps?
2. Start with the request-path audit and conditional deletion, rather than
   assume the public dependency path is safe to remove?
3. Follow with role-specific guidance, and keep Evaluation cleanup separate?

Recommendation: accept those boundaries and that order. Update the existing
[convergence tracker](../../proposals/design-implementation-convergence.md) after approval;
do not create another execution plan or duplicate the pilot. Earlier evidence
below remains useful, but its open PR/pilot choices are not prerequisites or
new authority for this source cleanup.

## Decision

Keep the governing rule:

> Every fact has one owner. Everywhere else, keep only a reference, evidence,
> or a disposable view.

The whole system should be explainable as:

```text
human says what they want
  -> May understands it
  -> one Task records the promised outcome
  -> a worker performs the work
  -> the responsible App judges the evidence
  -> May explains the result and keeps unfinished work visible
```

May must work without Herdr. Herdr may later be one way to run workers, but it
must not change this model.

For a repeatable delivery process, the owning App's code determines which
authorized job is eligible; the selected agent implements or makes the
specific semantic judgment. Routine progression does not require a supervisor
model turn. Novel work remains agent-led through the same Task interface.

The simplest implementation is the existing path with unnecessary decisions
and competing writers removed, not a new generic workflow framework.

The experiment has justified four focused corrections: preserve explicit
closure of standing work; read the current live generation; persist the newer
completion receipt when that generation completes; and park a rejected handler
contract instead of feeding it back into automatic execution retries. Reuse
the existing attention state, Conditions, and transient-failure retry path.
No new workflow store, state schema, scheduler, mode, or dependency is needed.

The follow-up live watch of the focused, remote-main-based PR candidate also
exposed two lost-deadline paths: duplicate waiting claims cleared the recovery
index, and a Host helper removed the App's deadline after three reviews.
Preserve the existing future deadline on a no-op claim, and delete the helper
that overrides App policy. Repeated deterministic fallback reviews need no
model call; the App owns their interval and whether to stop them. These are
small repairs to the existing wait mechanism, not another scheduler.
The focused implementation is [may-agent#54](https://github.com/hao1939/may-agent/pull/54),
based on remote `main` rather than the broader cleanup branch.

The [September 6 pilot evidence](authority-boundary-pilot-20260906.md) records
the candidate commits, exact artifact/mount, failed iterations, quiet waits,
matching wake, restart checks, and a successful bounded agent call. It also
separates the read-only PR assessment from still-unproven provider writes.

## Why this is needed

May's accepted design already separates App meaning from Host mechanics.
The incident shows why that boundary must hold across admission, execution,
recovery, and acceptance: multiple records must not give contradictory answers
about the same work. Herdr's useful lesson is this ownership discipline, not
its particular storage or execution technology.

### Evidence from MLVM

The September 6 read-only investigation inspected the stopped `may-agent`
container, `/app/.state/may.db`, retained session results, and local source.
The retained execution window was August 26–28. May received SIGTERM and exited
0 on August 28; these are historical execution failures, not a claim that its
current stopped state is a crash.

| Observation | Design consequence |
| --- | --- |
| `aks-rp-e2e/scenario-normalization` had an explicit terminal generation-3 receipt alongside a ready generation-4 resource; 3,167 interrupted attempts accumulated | Admission, scheduling, reads, and result acceptance must use the same lifecycle authority |
| 3,061 matching handler failures said `willRetry=false`, yet fresh attempts continued | A retry decision must govern all paths that can make that work eligible again |
| 1,332 Git-authentication failures and 381 verifier failures involving checkout or required inputs | Validate prerequisites before model execution; wait for a relevant change instead of retrying invalid work |
| Two May dependency tasks accounted for 476 sessions; consecutive sampled results repeatedly requested the same unapplied two-field correction | An agent relay is not an effective task-mutation capability; use the authorized control path or expose the exact missing authority |
| A repair was recorded as tested but awaiting a usable checkout and release authority | Deployment proof and operational authority are part of fixing a deployed incident |

The stale attempts were largely pre-model failures. The final 24 hours contained
24 model sessions, all scheduled owner reviews, while mechanical errors
continued. Neither attempt count nor session completion measures delivery.
The sampled relay messages were already structured and clear; their failure
was not a lack of JSON.

Evidence anchors are the `scenario-normalization` Task and receipt, triggering
event 4293, and sessions `s_1787782279309_1426`,
`s_1787782324089_1430`, and `s_1787782360465_1435` under
`/app/.state/sessions/` on MLVM. The latter three demonstrate the repeated
handoff, not that every one of the 476 sessions was unnecessary.

Local source contains subsequent repairs, including commit `796693c2` for
stale-task handling and `69e79b48` for legacy normalization. They are not proof
of deployed behavior: the container executable hash differed from the staged
provenance artifact. Establish the actual release before deciding which fixes
remain necessary. The existing convergence tracker also records fixes to
proxy supervision and wait deadlines; do not implement those twice.

## What to learn from Herdr Supervisor

| Herdr lesson | May application | What not to copy |
| --- | --- | --- |
| Runtime owns worker identity; supervisor owns the outcome contract and judgment | Task owns durable work; executor owns live process/session facts | Another durable worker or goal lifecycle |
| One bounded observation and one accepted supervisory decision | Reuse the Task attempt/result fence for a focused May review | A second review state machine, or a one-tool-call limit on coding workers |
| Events carry facts; recipient-owned knowledge guides interpretation | Keep typed facts separate from trusted App guidance and policy | Executable instructions taken from provider comments or event text |
| One shared observer wakes the exact owner | Reuse existing observers, event ingress, and Conditions | Per-Task watchers, duplicate polling, or broadcasting to every agent |
| Reuse existing capabilities before adding mechanisms | First check capability, wake reliability, and context; add only the missing part | A framework or new mode for each operational exception |
| Exact identity and validated effects matter more than elaborate recovery | Preserve generation fences and read back uncertain external effects | Blind retries or a promise of exactly-once provider writes |

The recorded [Scout experiment](../../../../herdr-supervisor/docs/verification/simple-loop-scout-experiment.md)
is especially useful. Guidance helped an idle reviewer resume, but a guard
then rejected a legitimate wait because the peer was not already active.
Removing that conflicting guard allowed the existing deadline to complete the
handoff. The record reports a net reduction of 27 runtime-source lines and no
new scheduler or durable state. It proves that bounded handoff, not long-run
optimality or universal agent reliability.

The September 6 MLVM delivery-check PoC is a useful limit, not proof of solved
publication. Its retained assisted assessment reports a useful PR-description
correction but no publication; ordinary reads were needed to distinguish
optional reviewers, absent draft-policy evaluations, and actual current-target
validation requirements. A helper's suggestions were not a readiness verdict.
This refinement has not independently rerun that PoC.

Use Herdr's agent-first rule with May's existing
[mechanism guide](../../1-principles/code-vs-data.md): situational interpretation
belongs in guidance; a repeatedly missed, explicitly agreed process belongs
in a small App workflow. This is not permission to encode every judgment as a
guard. Publication prerequisites and merge prerequisites must remain distinct.

## Keep the existing foundation

May's local implementation and accepted design already provide resource-backed
Tasks, fenced attempts, Conditions, App-owned acceptance, event ingress,
derived human views, native executors, and App-local workflows. Keep them.
This is convergence work, not a replacement Task engine or another supervisor.

The earlier draft's duplicate CLI lifecycles, interface mutation paths,
domain-shaped Host tables, and public compatibility exports remain cleanup
candidates. Confirm current callers and deployed state first. Their removal
must not delay the targeted reliability repair.

## What the human should see

A person sees Conversation, Work, and Needed from you: the discussion, the
promised outcome and its current state, and any exact human decision required.
Work comes from the responsible Task. Sessions, attempts, Conditions, leases,
and delivery records remain diagnostic details. May explains a meaningful
change or asks one concrete question; unchanged waits do not generate repeated
updates. No UI redesign is required for the pilot.

## Authority map

| Question | One authority |
| --- | --- |
| What did the human and May say? | Conversation |
| Which discussion does this continue? | Topic, as context only |
| What outcome are we committed to? | Responsible App Task |
| Which caller is owed a result? | Request, as correlation only |
| What new thing happened? | Event |
| Is the worker process alive and what is it doing? | Selected execution environment |
| What happened during this bounded attempt? | Attempt evidence |
| Is the outcome truly complete? | Responsible App's acceptance decision |
| What has this interface displayed? | The adapter's local presentation state |

May's existing supervision Task protects human follow-through without copying,
parenting, or replacing the responsible Tasks. There is no second worker,
CLI, goal, or follow-up Task for the same promised outcome. A worker result is
evidence, not automatic completion. Distinct durable outcomes may still have
distinct Tasks; one owner does not mean one agent must perform every role.

## Events wake; owners decide

An Event means “something happened.” It may create responsibility or wake an
existing Task through an explicit route. It does not decide success, failure,
retry, or completion.

The executor maps useful worker signals to the exact Task attempt and reads
fresh worker truth. Do not copy every terminal byte into the durable Event log
or derive current worker status by replaying it.

For May's supervision Task, one bounded reconciliation should produce one
disposition: leave healthy work alone, send exact feedback, expose one human
decision, append one useful Conversation update, or request genuinely new work
after the responsible Task has ended without meeting the human outcome. Code
should reject conflicting or stacked dispositions. This is an admission rule on
the existing Task attempt, not another review-turn object or state machine.

For the PR pilot, provider changes wake the responsible Task's code, not both
its worker and May's supervisor. A running attempt may receive that input
through the existing fenced event interface; otherwise Runtime schedules the
Task. The App decides whether an agent is needed. May is notified only of a
meaningful outcome, changed blocker, or human decision.

`event-watchd` is not already a May adapter. Its current daemon delivers to
Herdr goal IDs and exact native workers. First reuse a May App's existing
provider observer if sufficient. If it is not, reuse the watcher's source-read
logic and injected delivery seam with one explicitly wired May ingress binding.
Resolve ownership from trusted repository configuration and exact resource
links. Do not create a Herdr goal solely to route a May Task, add a generic
runtime router, or run a second observer for the same responsibility.

Keep machine fields structured through existing Event, Task input, and result
schemas. Keep explanations and response guidance as natural-language fields.
Do not add a parallel envelope protocol or parse decisions from prose. A
versioned App result can carry a finding's disposition and evidence references
without making that text mutation authority. Provider text is untrusted
evidence; executable actions come from the Task's authorized App policy.

## Lifecycle and waiting invariants

1. An ordinary observation cannot revive explicitly stopped work. Scheduling,
   exact reads, and acceptance must agree on the current authorized generation.
   A legitimately admitted successor must not be hidden by an older receipt;
   preserve historical evidence while making the current authority unambiguous.
   A maintain Task that is merely up to date is not terminally stopped.
   Completion must also advance the current receipt projection: admitting
   generation 2 is insufficient if its completion leaves generation 1 visible.
   Historical evidence remains in the existing attempt/event records.
2. Stale attempts produce no effects. Rejecting an attempt must also leave
   scheduling consistent: terminal work becomes ineligible, while a genuinely
   newer authorized generation may run. Do not turn stale rejection into a
   handler retry loop.
3. Duplicate observations and safety ticks do not by themselves create new
   useful work. Coalesce through existing admission and queue mechanisms.
   Same provider revision alone is not sufficient for suppression: new human
   input, worker results, policy changes, or a due recovery check can matter.
4. Validate schema, workspace, required revision/evidence identity, and needed
   capabilities before expensive reasoning. Deterministically correctable
   input failures use the existing authorized mutation path. Missing authority
   produces one precise blocker, not another delegation cycle.
5. Transient transport failures use bounded existing retries. Invalid inputs,
   expired credentials, and unavailable authority wait on an exact existing
   Condition or visible attention state. A failed read is unknown, never proof
   that reviews, resources, or requirements are absent.
   A structurally rejected handler result is not a transient process failure:
   park it with the exact validation error using existing attention handling.
   Test authored workflow failure branches against the existing result schema.
6. A wait records the missing fact, its owner, how it can be observed, and a
   bounded fallback review when events are insufficient. Preserve that review
   across restart. Cheap rechecks may continue; unchanged blockers must not
   repeatedly launch agents or send the same human notification. New relevant
   facts can always reconsider the wait; recorded conditions are not an event
   allowlist.
   A due deterministic recheck may create a Task attempt without a model
   session. Measure those separately; do not promise zero runtime activity.

These rules belong in existing admission, reconciliation, Conditions, and
recovery code. No circuit-breaker service, additional queue, or workflow-status
database is proposed. Unknown failures can receive one focused investigation;
do not pretend all errors can be classified safely by string matching.

## Execution is replaceable

One execution environment owns the live worker facts for an attempt. The Task
stores an opaque execution binding and bounded evidence references. Runtime
asks that environment for current truth; it does not copy idle/running/stopped
process state into a second work lifecycle.

Recovery starts from the Task, current attempt, and exact binding. A mismatched
process or native session fails closed. Reattach a verified worker, or fence
the old attempt and start another only after resolving its ownership; never
infer permission for a duplicate from stale status. Panes, transcript cursors,
byte limits, and session details stay private to the executor.

Replacing execution does not replace the Task or its acceptance authority.
Keep one supported built-in executor for the pilot. Herdr remains optional.

## Code enforces mechanics; Apps judge meaning

Code must enforce exact identity, stale-attempt fences, bounded observations,
configured resource limits, and valid result shapes. Prompts may explain these
rules, but correctness must not depend on the model remembering them.

The App judges useful progress and completion. An attempt limit is not a Task
cancellation or automatic human escalation. Ask the human only for genuinely
missing authority or information, not because a generic steer count was hit.

The existing bounded recovery check remains a safety net. Do not replace it
with a full-fleet scan, per-Task watcher, or polling loop.

## First application: a small code-driven PR workflow

The proposed pilot is one repository's delivery process in its responsible
App. Host Operations owns it only when the outcome is a change to May itself.
Do not create another App or per-PR supervisor if an existing owner can do it.

### Who runs what

```text
Human -> May frontend -> responsible App Task <- Event <- Observer <- Provider
                                  |
                         Host runs App workflow
                                  |
                       read facts / choose eligible job
                           /                   \
                  existing tools           bounded agent job
                  deterministic            implement / judge
                           \                   /
                          verified evidence/result
                                  |
                       same Task: continue, wait, done
                                  |
                   meaningful change -> May -> human
```

The Host runs the workflow as an ordinary Task attempt. Its code collects
facts, applies an explicit repository policy, invokes the existing executor
when judgment or implementation is needed, and returns through the existing
result/Condition contract. A worker does not have to remember to call a helper
to advance the process. While implementing, it remains free to make useful
local decisions and handle a batch of related findings.

Start with ordinary functions in one App workflow: collect current facts,
choose the eligible job, run it, verify its effect. These are implementation
roles, not a new public SDK or workflow language. Reuse schema validation,
executor invocation, workspace isolation, Task result acceptance, and waits.

The isolated pilot uses a 34-line eligibility function and tests its branches;
it is a test fixture, not a new shared framework or a complete provider
adapter. On a real read-only snapshot of May PR #51, its correct next action
was to wait for repository-specific policy. The snapshot showed a published
PR, `CLEAN`, and empty review/check lists; those facts do not establish all
required review, validation, or approval evidence. No PR write was performed.

### Proposed PR policy

For new work whose contract allows it, publish a reviewable PR after the agreed
local checks; then obtain review, resolve findings, run required live
validation, and present it for authorized approval. This separates publication
from acceptance and avoids requiring feedback that cannot arrive while a PR
is draft. Publication may itself trigger CI and notifications; its authority
must be explicit. Existing goals that require validation before publication
retain that requirement unless the human changes them.

| Current facts | Eligible work |
| --- | --- |
| Implementation or agreed local checks incomplete | Worker implements and verifies; no premature publication |
| Reviewable candidate, publication authorized, existing PR still draft or absent | Code publishes that PR; create only after an authoritative lookup finds no matching existing PR, then read back identity/head/state |
| Required review absent and not already requested | Start the configured review through its existing path; wait for the exact evidence |
| Applicable review findings need resolution | One worker job assesses all relevant findings and implements the useful batch; disputed findings receive an evidence-backed disposition |
| Review requirements satisfied; required current-candidate live evidence absent | Dispatch the existing validation operation once for that candidate/configuration |
| Matching review or validation already running | Record an exact wait; no agent polling or duplicate run |
| Required current evidence passes | Present for authorized approval, or record the requested readiness outcome; do not self-approve or merge implicitly |
| Provider confirms the expressly requested terminal outcome | Owning App accepts the Task with evidence |

This is an eligibility table, not a persisted sequence of stage Tasks. Read
current provider facts and accepted evidence each time. Do not duplicate PR,
review, or build status in another workflow record. If a head changes, earlier
evidence remains historical; the App's explicit policy determines which proof
must be renewed. Target identity matters when the validation contract depends
on a composed revision, not as an invented universal revalidation rule.

Semantic decisions stay narrow: is this finding actually addressed, is a
failure expected evidence or a regression, and does this changed surface need
additional validation? Give the model exact evidence and the applicable policy.
Its structured answer is evidence for the workflow, not permission to weaken
the policy. Unknown policy applicability triggers a targeted read or specific
judgment; an empty policy list is not automatically pass or fail.

One workflow result may include several compatible findings or local repairs.
One accepted supervisory disposition does not mean one suggestion per worker,
one file edit per attempt, or an LLM call for every provider operation.
A wait blocks only dependent actions: it does not prevent an independently
authorized description correction or other useful work. Prefer a useful batch
over forcing one suggestion at a time.

### Effects and recovery

Before an external effect, recheck Task authority, current attempt, resource
identity, expected head, and applicable policy. Keep one invocation path per
effect. After a timeout or crash, reread the provider before deciding whether
to repeat it. Use provider idempotency where available; otherwise correlate
the operation with existing Task/attempt and provider identifiers. If its
outcome cannot be determined, park it visibly rather than risk a duplicate.
Do not claim a transaction across SQLite and the provider.

Separate immutable candidate evidence from workspace preparation inputs. A
tested commit does not automatically name a prepared branch. Scope the agent
job to implementation or judgment and keep publish, dispatch, approval, and
merge decisions at the workflow boundary. If a full-access worker can bypass
that boundary through its shell credentials, this is process discipline, not
an enforced security guarantee; use existing restricted capabilities or
provider permissions when hard prevention is required.

## Further simplifications after the delivery pilot

Retain four cleanup directions from the earlier draft, without making them
prerequisites for the first repair:

1. Collapse duplicate Task-owned CLI lifecycles into Task, attempt, and exact
   execution binding. Check installed callers before selecting the reference
   executor or retiring an alias; the earlier `codex-goal` name is not proof of
   the deployed contract. Bounded `run_cli_agent` use must not acquire durable
   work ownership.
2. Keep one validated mutation boundary. Friendly socket, HTTP, Console, and
   Telegram controls publish typed Events; resource reads remain direct and
   bounded. Remove competing mutations after their callers migrate.
3. Remove unused domain-shaped Host storage, move active truth to its owner,
   and identify disposable projections. Preserve historical evidence. Do not
   replace the same complexity with a generic property-bag database.
4. Shrink SDK exports and composition after old callers disappear. Adapters
   depend on Events and reads, Apps on the SDK, and executors on one execution
   environment. Storage, leases, queues, and process handles stay private;
   executors do not mutate Tasks or accept their own results.

## Implementation plan

### Step 0 — establish the deployment and preserve the baseline

Identify the actual executable, source revision, App definitions, executor,
and supported deployment authority. Save recoverable database/artifact
snapshots through the existing operational procedure before changing state.
The September 6 scoped trial is authorized; the old May instance remains
stopped. Its staged source is not a Git checkout, its old binary and staged
provenance disagree, and the old DB has no Host Operations `may-agent` App/Task
authority required by the supported correlated deployment procedure. Do not
bypass that procedure or fabricate historical ancestry/authority. A fresh
isolated App bootstrap proves candidate behavior, not production repair.
Leave unrelated Herdr workers untouched.

The normal daemon invocation needs `--cron` to install Task controllers even
when the pilot defines no cron jobs. `--socket` alone can durably admit events
without executing Tasks. Verify controller installation and Task progression,
not just a healthy process or event acknowledgement. Also verify one bounded
model request if a model step is required: a gateway catalog can advertise a
model that rejects actual inference.

Use the known incident tasks and bounded event/session queries as the baseline.
Separate old deployed defects from already-fixed local code. Do not create a
new monitoring product or use an agent to repeatedly rediscover the incident.

### Step 1 — make invalid and stopped work settle

Reproduce the terminal-receipt/ready-resource conflict and repeated permanent
failure in focused tests. Repair only the remaining admission, recovery,
preflight, and wait gaps. Reuse existing stale-result repairs where applicable.

Primary implementation seams in `projects/may-agent/src/app/` are
`app-read.ts`, `app-task-reconciler.ts`, `app-task-resource-store.ts`,
`app-task-runtime.ts`, `app-task-condition-tracker.ts`, and
`app-task-recovery.ts`. They are inspection targets, not a required edit list.
Domain input checks belong to the responsible App, not generic Host policy.

Prove that repeated observer events and recovery ticks cannot revive a stopped
task, a valid newer authorized generation can run, expired credentials cause
no repeated model attempts, and restoring the capability wakes the exact work.
Do not remove identity or evidence guards merely to suppress errors.

Before activating historical production state, reconcile the exact stopped
generation-3 / live generation-4 incident through a supported, evidence-backed
control or migration. The candidate prevents the reproduced admission defect;
it does not prove that a previously resurrected generation is authorized and
does not automatically delete or repair that historical row.

### Step 2 — prove one PR outcome using the existing workflow path

Select one repository, one responsible Task, and one supported executor.
Agree the publication prerequisites, validation contract, and stopping outcome
before any live effect. Use an existing App workflow as the implementation
home; extend it only where it cannot express the agreed process.

Reuse observations and ordinary provider tools. Add the smallest missing read
or validated effect only if a concrete capability is absent. No runtime mode,
generic stage graph, second work store, additional supervision Task, or new
workflow dependency is part of this pilot.

Run isolated replay/fault tests first, then one explicitly authorized live
trial. Observe actual publication, review disposition, validation, and the
requested terminal outcome, not just successful event delivery. Include a
known-blocked case: correct, quiet waiting is a successful result too.

### Step 3 — delete only demonstrated duplication

Inventory the callers and state writers touched by the pilot. Remove an unused
Task-owned CLI lifecycle immediately if its absence is proven; otherwise
migrate one real caller and verify start, steering, cancellation, restart,
exact-session recovery, and evidence acceptance before deletion. Keep bounded
non-Task execution separate from durable work ownership.

Converge any duplicate external control entrypoints encountered onto the
existing validated boundary. Defer broad Host-domain schema relocation, SDK
cleanup, UI changes, and optional Herdr execution until independently useful.
Do not make those projects prerequisites for fixing this incident.

For each slice, record the user-visible gain, deleted path, added state/effects,
and live evidence. If a helper adds little beyond ordinary tools, remove it.
After approval, move accepted rules to their owning design documents and keep
one implementation tracker rather than parallel specifications.

## Acceptance

Proposal completion and product rollout are distinct. This proposal can be
ready for review with an identified candidate, scoped live evidence, and
explicit remaining gates. The full reliability and PR rollout is complete when:

1. A human can understand each commitment from its Conversation and one Task.
2. Every fact involved in the slice has one authority and one normal write path.
3. A Task survives replacing its worker or execution environment.
4. Restart cannot start duplicate work from stale copied status.
5. A replaced worker identity fails closed.
6. Healthy idle or unchanged blocked work causes no repeated model polling,
   duplicate human notification, or full-history replay; bounded observer and
   recovery reads remain allowed.
7. A worker result cannot complete a Task without App acceptance.
8. Every Task control mutation in the slice reaches the same validated boundary.
9. Stopped work remains stopped under duplicate, late, and recovery events;
   a legitimate authorized successor is not masked by historical evidence.
10. May works fully without Herdr.
11. One PR reaches its explicitly requested outcome, or a specific external
    blocker, without a human repeatedly reminding the agent of the process.
12. The pilot has no second CLI, workflow, or supervisor work lifecycle.
13. Review and validation evidence match the required candidate/configuration;
    approval, publication, and merge are not conflated.
14. One May supervision reconciliation admits one non-conflicting disposition.
15. Execution evidence is bounded without exposing provider-specific cursor
    details through the public Task contract.
16. A provider timeout followed by restart does not blindly repeat publication
    or validation dispatch; an ambiguous effect becomes visible.
17. A missing required input is detected before agent execution, and capability
    restoration resumes the same authorized Task without manual reconstruction.

Use existing evidence to record model invocations per meaningful progress
change, duplicate external effects, time from relevant event to useful action,
and time blocked on a named prerequisite. Hard correctness gates are zero
unauthorized effects, terminal resurrections, and duplicate live workers or
dispatches in the exercised cases. Cost and latency targets follow the
baseline; do not invent arbitrary attempt quotas or a global progress score.

A live pass must identify the running artifact and cover an unchanged wait,
a meaningful wake, and a restart/recovery boundary. Focused tests alone do not
establish production repair. Keep the known-good artifact available and stop
the scoped pilot on a violated safety invariant; rollback must not restore an
old database over newer provider effects.

## Not proposed

- replacing SQLite with JSON files;
- replacing App Tasks with Herdr goals;
- requiring Herdr;
- merging semantic Events with terminal/provider event streams;
- adding a worker plugin framework;
- adding Inngest, Temporal, LangGraph, or a generic workflow DSL for this slice;
- making a suggestion helper mandatory when existing tools suffice;
- a global limit of one agent action or one PR across unrelated work;
- rewriting the Task engine before removing known duplication; or
- exposing sessions and attempts as ordinary human work.

## Review questions

1. Accept the boundary: Host mechanics, App-owned process policy, agent
   implementation/judgment, and May human follow-through?
2. Accept lifecycle/preflight repair before executor or storage cleanup?
3. Use May's existing PR #51 as the next delivery target, or select another
   exact Task/PR? Agree the authorized completion contract and whether local
   checks permit publication before required live validation. The current
   read-only pilot is not authorization to approve or merge #51.

## Recommendation

Accept the authority rule and the narrowed sequence: make work settle, prove
one code-driven delivery process, then delete duplication demonstrated by that
proof. Reuse May's Task/Condition/executor foundation and existing observation
tools. Keep agents powerful inside bounded jobs rather than asking them to
reconstruct the operating process every turn.

Inngest could later replace execution plumbing if maintaining that plumbing
has a measured cost greater than integration and migration. Herdr could later
replace an executor if it adds value. Neither addresses conflicting lifecycle
authority or unclear App policy, and neither is needed to start this repair.

## Review references

- [May system model](../../2a-design/system-model.md) and
  [Task resource engine](../../2a-design/task-resource-engine.md): current contracts.
- [Convergence tracker](../../proposals/design-implementation-convergence.md): already-recorded
  repairs and remaining implementation gaps, not deployed-version proof.
- [Herdr Supervisor design](../../../../herdr-supervisor/docs/design.md),
  [review-turn fence](../../../../herdr-supervisor/src/review-turn.ts), and
  [watcher boundary](../../../../herdr-supervisor/src/event-watcher/README.md):
  inspected design and implementation, not a claim of May integration.
- [Scout experiment](../../../../herdr-supervisor/docs/verification/simple-loop-scout-experiment.md):
  bounded live handoff and guard-removal evidence.
- MLVM delivery-check retained assessment:
  `/app/tmp/herdr-delivery-check-20260906/live-evidence/PE_ASSISTED_ITERATION5_PUBLICATION_ASSESSMENT_20260906T093741Z.md`.
  This is local PoC evidence, not a durable product dependency.
