# Task, Request and ask: terminology review — October 17

The current design uses one Task execution lifecycle and several records with
different purposes. Its main terminology problem is that **request** names both
an accepted human promise and a submitted App input. The [owning clarification](../../2a-design/message-lifecycle.md#task-request-input-and-human-action)
now distinguishes them. This review recommends naming and guidance improvements;
it introduces no API, storage migration or runtime change.

## Source findings

Reviewed Apps `cc242ddda1e913d375a357b4f91f9433b71092c4` and Host
`980f2cda391d36d2a6d10927f81ed02c6bf6b66e`. This is a source/contract review,
not a fresh runtime audit or model-behavior trial.

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Conversation Request means an accepted promise to the human. | `message-lifecycle.md`; Host SDK `conversation-contract.ts`, `AppConversationRequest`: scope, revision, open/closed status, Task references and explained closure. | May owes the response. This is not work owned or executed by the human. |
| App request means submitted work/input with caller correlation. | SDK `task.ts`, `TaskAppRequest`; `app.ts`, `AppInputContext`; the Task engine's admission contract. | It may address existing work, find new work or remain pending before Task attachment. It is not the same record as a Conversation Request. |
| Asking and waiting are independent. | `TaskReconcileResult` and `TaskChanges` have separate `requests` and `conditions`; `TaskAppDependency` is a deprecated alias. | Do not call every ask a dependency or force the caller to wait. Use a request Condition when its result is needed. |
| The same field spelling can identify different records. | `followUp.requestId` names a Conversation Request; `TaskRequestCondition.requestId` names an App submission. `TaskChangeReceipt` also returns submission receipts and optional Conversation Request updates in separate branches. | Examples and tool help need qualified names. A bare `requestId` in prose is insufficient at these boundaries. |
| Human help has the reverse direction from a Conversation Request. | SDK `Condition.owner` / `requestedAction`; `human-control-surfaces.md`: the open human-owned Condition is the canonical help request. | Use "needs your action" for this wait. A reply is evidence to interpret; it does not necessarily prove the requested external action happened. |
| Conversation Requests already execute through a Task. | `conversation-execution.md`, the Task lifecycle and `conversation-requests.ts`. The latter stores scope, input associations, references and closure, and checks the Conversation actor. | There is no separate Request executor to eliminate in these inspected paths. One execution model does not require one record for every kind of fact. |

Existing `conversation-requests.test.ts` cases cover a discussion-only answer,
corrections retaining identity, several intentions sharing a Turn, failed reply
and restart, and associations surviving Stop. These were read as evidence of
the supported contracts; they were not rerun for this documentation change.
No claim about real-agent comprehension follows from those test definitions.

My earlier conversation described all Requests as lightweight caller links.
That accurately describes App submission correlation but loses the separately
accepted scope and human explanation required by Conversation Requests. The
recommendation to merge everything into ordinary Task input was therefore too
broad without preserving those semantics.

## Recommended vocabulary

Keep a small public vocabulary:

- **Task:** work an agent owns.
- **Your requests:** accepted asks May owes the human; in technical text,
  **Conversation Requests**, explained as human-facing commitments.
- **Ask:** a verb. Asking a Task adds input; asking another owner may establish
  another Task and a caller/result link. No new `Ask` resource is proposed.
- **Needs you:** the requested action from an open human-owned Condition.

Technical descriptions should say **App input/submission** for admission and
**caller/result link** for return correlation. Use **Condition** for an awaited
fact. A structural parent, a referenced Task and an actual caller wait are
different links; displaying one must not imply the others. Do not use
"human-owned Request" where "response owed to the human" is intended.

These are recommended explanatory labels. The glossary documents existing
meanings; this change does not rename the UI or SDK. In particular, neither a
new formal `Commitment` resource nor a separate ask queue is needed.

## What should be combined or kept small

Keep work ownership, execution, limits and recovery on Tasks. Keep App input
records limited to admission, submitted input and exact answer correlation.
Keep Conversation Requests limited to the accepted human scope, associations
and disposition/explanation. Derive progress and blockers from the linked work.

Physical storage can share infrastructure, but identifying a Task with a
Conversation Request changes behavior: one Conversation Task can serve many
promises, one promise can reference several work Tasks, and a worker result may
still leave the requested explanation outstanding. Conversely, "start this job"
can be fulfilled while the job continues. Merging these identities would need
equivalent scope and closure records elsewhere; it does not automatically remove
complexity. No storage merge is justified by terminology confusion alone.

Likewise, pending App input may survive while destination mapping fails. Removing
its receipt because no Task exists would discard the very ask recovery needs.
Preserve enough correlation to recover affordably; perfect history or exact-once
replay is not a new requirement.

## Improvements in order

1. Put the current distinctions in the owning Message Lifecycle chapter, link
   them from the System Model, index and Task guide, and use one complete example.
   **Done in this documentation change.**
2. In future tool/help edits, qualify each overloaded ID as Conversation Request
   ID or App input ID. Explain Task `requests` beside `requestUpdates` at their
   point of use. Preserve API names until a concrete usage problem justifies a
   coordinated rename; do not add aliases to compensate for unclear prose.
3. Review the UI using the ordinary questions: "What did I ask?", "Who is
   working on it?", and "What do you need from me?" Show linked work and human
   action through the existing surfaces. Avoid requiring users to manage input
   receipts or duplicate the same work in multiple queues.
4. Before changing representation, exercise four behaviors: a discussion answer
   needs no extra work Task; a clarification keeps the same human promise; an
   agent help request returns to its original Task without creating a human
   promise; a human reply reaches the right Condition while useful independent
   work can continue. Existing tests provide starting points. An actual agent
   comparison is required before claiming clearer wording improves behavior.

This keeps one work model while retaining the facts needed to answer reliably.
No new Task, Request, Condition, deployment or agent message was created by the
review itself.

## Documentation verification

`bun run check:may-design` passed documentation integrity, executable examples
and canonical App boundaries. It reported the existing root-layout warning for
`reports`. All 207 relative links in the five changed Markdown files, including
heading targets, resolved; `git diff --check` passed. The check log is retained
at `/home/hao/workspace-archive/task-request-terms-20261017/design-check.log`.
These checks establish consistency, not improved agent behavior or activation
of the changed Task guide in an installed definition release.
