# Approved September 8 May simplification scope

**Historical context:** [System Model](../../2a-design/system-model.md). Retained rationale and evidence; this record does not define the current contract.

Snapshot of the human-approved September 8 current-review section in
`projects/may-agent.app/docs/proposals/authority-boundary-simplification.md`.
Earlier pilot sections are outside this implementation scope. Relative links
in the copied section below use that original document's directory.

The human subsequently stopped supervised goal
`g_44335c62-fb8a-415d-a53d-eb9909a6b832` and its worker, and asked the original
assistant to implement directly. The saved goal is audit history, not an active
execution authority. This snapshot preserves the approved source scope; no
deployment, PR publication, or model-backed live experiment is authorized.

Later authority: after direct implementation, the human explicitly requested
PRs. Publishing the paired source branches and Host PR is now authorized;
merging, deployment, and model-backed live experiments remain outside scope.

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
