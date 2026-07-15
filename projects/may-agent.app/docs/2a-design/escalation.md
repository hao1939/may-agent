# Escalation

**Design status:** Accepted.
**Implementation status:** Implemented for create, owner routing, human reply,
resolve/dismiss, trace closure, and source-session resume.

## Purpose

Escalation is a structured handoff across an ownership boundary.

```text
local blocker
  -> current owner cannot perform the required next action
  -> escalation.created with requested action and evidence
  -> receiving owner resolves or dismisses
  -> original work resumes or records a final disposition
```

Escalation is not a synonym for failure, waiting, retry, or workflow blocking.
Use it only when another owner must decide or act.

## Boundary

| Situation | Correct representation |
| --- | --- |
| Workflow cannot continue locally | `ctx.blocked(reason, context)` |
| Project task has a local failure/root cause | Owner repair or `project.problem.investigation.requested` |
| Known external condition will change later | Persist exact wait/resume condition |
| Another owner or human must act | `escalation.created` |
| Agent attempt is incomplete | Honest session `partial`/`blocked` result |

A caller or owner may promote local blocked evidence into an escalation after
judging that the next action truly crosses ownership.

## Create

Handlers and agent-side SDK code use:

```ts
const ref = sdk.escalate("Production decision required", {
  owner: "human:operator",
  requestedAction: "Approve, adjust, or reject the rollout.",
  evidence: { change, verification },
  severity: "P1",
  projectId: "my-project",
  sourceSessionId,
  resume: {
    kind: "session",
    checkpointRef: "before-production-rollout"
  },
  dedupKey: "my-project:production-rollout-approval"
});
```

The canonical event is:

```json
{
  "type": "escalation.created",
  "source": "agent:project-owner",
  "owner": "human:operator",
  "urgency": "high",
  "data": {
    "reason": "Production decision required",
    "requestedAction": "Approve, adjust, or reject the rollout.",
    "severity": "P1",
    "projectId": "my-project",
    "sourceAgent": "project-owner",
    "sourceSessionId": "s_...",
    "evidence": {},
    "resume": {},
    "dedupKey": "my-project:production-rollout-approval"
  }
}
```

The persisted opening event id is the primary escalation identity. A generated
`data.escalationId` may remain for compatibility with old/external rows, but new
causal relationships use trace metadata and event ids.

The old `sdk.escalate(target, reason)` form is rejected. Routing belongs in
`opts.owner`.

## Required Context

An actionable escalation carries:

- exact blocker/reason;
- receiving owner;
- one requested action;
- compact evidence and source context;
- severity/urgency;
- stable deduplication key;
- resume instruction or final-disposition expectation.

Do not paste an entire transcript when paths/event/session ids identify the
evidence. Do not ask the receiver to rediscover what decision is needed.

## Routing

`escalation.created` follows normal event routing:

1. persist the event and trace;
2. deliver to a matching owner/human route;
3. otherwise accept into the queryable owner inbox;
4. surface malformed, unowned, duplicate, or overdue escalation work;
5. record delivery separately from resolution.

Delivery acceptance means the escalation reached a responsible route. It does
not mean the blocker was resolved.

## Human Reply

Human notification preserves a conversation reference to the escalation trace.
A reply is normalized into `human.input.received` and a semantic intent within
that referenced trace. May receives compact attached context:

- original issue and requested action;
- escalation event id;
- source project/session;
- expected terminal event;
- resume instruction.

May interprets the reply and emits `escalation.resolved` or
`escalation.dismissed`. Loose chat text is not closure.

If the answer is insufficient, emit one exact follow-up ask or persist an exact
wait. Do not silently keep the escalation open without a next review condition.

## Resolve Or Dismiss

The receiving owner emits a terminal event:

```json
{
  "type": "escalation.resolved",
  "source": "human:operator",
  "owner": "agent:project-owner",
  "trace": {
    "traceId": "event:100",
    "parentEventId": 110,
    "links": [
      { "eventId": 100, "type": "closure", "label": "resolves" }
    ]
  },
  "data": {
    "outcome": "approved",
    "summary": "Proceed with the verified rollout.",
    "evidence": {},
    "resumeInstruction": "Continue from the pre-rollout checkpoint."
  }
}
```

Use `resolved` when the receiver supplies a disposition. Use `dismissed` when
the escalation is duplicate, invalid, obsolete, or intentionally declined.
Neither event proves the original project/task is complete; the source owner
must apply the disposition.

Pair closure and the trace closure link commit atomically.

## Resume

After a terminal escalation event, runtime/source-owner handling uses the
opening event's resume context:

1. steer the active source session when it still exists;
2. otherwise cold-resume the source session when supported;
3. otherwise wake the owning project or create an explicit follow-up;
4. emit resume attempted/started/failed evidence.

Project and workflow ids are context, not alternate escalation resume targets.
A new workflow phase receives a new `workflowRunId` and remains connected by
the event trace and project/domain correlation key.

## Nested Human Escalation

If an agent owner needs a human decision, create a child
`escalation.created` owned by `human:<role>` and link it causally to the parent.
Do not resolve the parent merely because the child was created. Resolve or
dismiss the parent after the human child receives a terminal disposition.

## Project And Task Integration

The project owner records escalation state on the affected task/branch:

- opening escalation event id;
- external owner and requested action;
- exact resume condition;
- next review/fallback;
- terminal escalation event and applied disposition.

The task may be `blocked` when the owner confirms an external blocker. The
project should become `blocked` only when the whole owner loop lacks other safe
autonomous work.

## Workflow Blocking

Workflows use only:

```ts
return ctx.done("phase completed");
return ctx.blocked("cannot continue locally", { evidence });
```

`ctx.blocked` is local and synchronous. It does not emit an escalation. Nested
workflows return it to their parent. Top-level runtime boundaries route blocked
task evidence to the project owner or blocked non-project work to
`workflow.owner.requested`. The caller/owner decides whether external
escalation is justified.

## Deduplication And Health

Deduplicate open escalations by a stable semantic key, not fuzzy reason text.
Health readouts should surface:

- open and overdue escalations;
- duplicate suppression;
- missing owner/requested action/resume context;
- terminal events without closure links;
- failed source resume;
- human notifications without actionable context;
- escalations repeatedly reopened without changed evidence.

## Compatibility

Historical rows may use `data.escalationId`, fuzzy correlation fields, or
session-result promotion paths. They remain graphable/readable. New writes use
canonical events, explicit owners, event-id/trace relationships, and structured
resume context.

## Integrity Checklist

- Escalation crosses a real ownership boundary.
- Opening event has exact owner, requested action, evidence, and resume path.
- Delivery acceptance and terminal disposition remain separate.
- Resolution/dismissal links to the opening event and closes the pair.
- Source owner applies the disposition before claiming project/task closure.
- Workflow local blocking never masquerades as external escalation.
- Duplicate/open/resume failures are observable.
