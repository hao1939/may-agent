# Design: Escalation System

> **Status (2026-07-11):** Routing (slices 1-2) is shipped: `escalation.created`
> events route to the owner via the `escalation` handler. The handler records
> routing with `handler.routed`; it no longer emits `escalation.routed` because
> that event was not consumed and accumulated as pending noise. Lifecycle
> tracking (slices 3-5) is only partially implemented —
> there is no `escalations` entity table, no `escalation.resolved` handler,
> and no lifecycle metrics.
>
> In practice, escalations can still accumulate if no owner emits
> `escalation.resolved` or `escalation.dismissed`. The event trace should link
> `escalation.created` to the human/message/workflow path through
> `parentEventId`, and the terminal event should link back to the opening event
> with `trace.links[].type = "closure"`. Missing closure links are the primary
> orphan signal.
>
> Immediate gap: 400+ escalations accumulated before anyone noticed. The system
> can query raw events today, but the durable graph should make "open
> escalations" a direct graph query: `escalation.created` nodes without a
> terminal closure link.

**Status:** proposal refined against current docs and implementation
**Date:** 2026-05-19
**References:** [events.md](./events.md), [handler-authoring.md](../2b-manual/handler-authoring.md), [practice-learning-loop.md](./practice-learning-loop.md), KE-1242

## Purpose

External escalation is how one agent asks another owner for help without mixing
responsibilities.

The clean model is:

```text
blocked work -> escalation.created -> owner handles it -> escalation.resolved -> original work resumes
```

This lifecycle starts only when work crosses an ownership boundary. A synchronous
workflow can return `ctx.blocked(...)` as a local terminal result without
emitting `escalation.created`; the caller or runtime boundary decides whether
that local blocked result should be promoted into the external lifecycle.
For top-level workflows, the runtime first routes the blocked workflow back to
the most specific owner of context. If the workflow is handling a project task,
the task is the recovery target: runtime emits a blocked
`project.task.completed` carrying the task id, attempt id, workflow lineage,
reason, and compact context. If there is project context but no task, runtime
uses `project.owner.requested`. Non-project workflows use
`workflow.owner.requested`, which follows the default owner-inbox route for
`*.requested` events. These owner routes are still not escalations; they are
normal ownership following the work.

Escalation can chain upward. If an agent owner cannot resolve the blocker, it
emits or links the next escalation to a human owner; when that human escalation is
answered, the chain can pop back down and resume the original blocked work.

Escalation should not be a hidden human notification, an ad-hoc retry loop, or a project-specific workaround. It is an event-driven coordination lifecycle with enough context for the owner to investigate and act.

## Boundary

| Part | Responsibility |
|------|----------------|
| Source agent | Decide it is blocked, explain the blocker, attach evidence, and pause/checkpoint its work. |
| Runtime/infra | Persist events, route to the owner, wake/queue handlers, deduplicate noisy repeats, track event links, and deliver the resolution back. |
| Owner | Investigate, fix, answer, reject, or route to a human. |
| Source agent after resolution | Resume with the resolution context and decide whether it is actually unblocked. |

`escalation.resolved` means the owner produced a disposition. It does not guarantee the source work is fixed. The source agent still owns the final unblock decision.

## Lifecycle

### 1. Create

When blocked work must be handled by another owner, the boundary emits
`escalation.created` and pauses or records the source work with a durable resume
reference.

Escalation events use the same event identity and graph model as every other
event. The persisted `escalation.created` event id is the escalation identity
when available. A legacy or external `data.escalationId` may still exist for
compatibility, but new runtime relationships should prefer trace metadata.

Escalation events have two layers:

- **Event envelope** follows the normal event schema: `type`, `source`, `owner`,
  `urgency`, `ttl_ms`, and timestamp.
- **`data`** carries escalation-specific lifecycle fields and the agent-facing
  brief: blocker context, requested action, evidence, and resume instructions.

```json
{
  "type": "escalation.created",
  "source": "agent:tech-lead",
  "owner": "agent:may",
  "urgency": "high",
  "data": {
    "sourceAgent": "tech-lead",
    "sourceSessionId": "s_...",
    "projectId": "platform",
    "projectPath": "/app/projects/may-agent",
    "reason": "The workflow needs a sessionId but the trigger payload did not include one.",
    "requestedAction": "Find the event producer and make the emitted event carry the needed sessionId in data.",
    "severity": "P1",
    "blockedOn": "event payload is incomplete",
    "evidence": {
      "events": ["handler.workflow_dispatched status=escalated"],
      "files": ["projects/evaluation.app/workflows/evaluator-aftermath.ts"],
      "sessionLines": [{"sessionId": "s_...", "line": 14}]
    },
    "resume": {
      "kind": "session",
      "checkpointRef": "s_...",
      "instruction": "Continue the blocked work after reading the resolution summary and evidence."
    },
    "dedupKey": "evaluator-aftermath:missing-session-id"
  }
}
```

The event envelope routes the work. `event.data` carries escalation context.
The graph links carry event relationships. The framework must not lift domain
fields such as `sessionId`, `projectId`, or `metricId` onto
subscriber-specific shortcut fields. Event-subscribed handlers receive the
original event envelope and read escalation fields from `event.data`.

### 2. Route And Wake

Infra persists the event and routes it by owner:

| `owner` | Runtime action |
|---------|----------------|
| `agent:<name>` | Add owner-targeted inbox event and trigger or queue the matching owner handler. |
| `human:<role>` | Deliver to May because May is the human's deputy; May chooses Telegram/UI/defer/dismiss. |

`owner` is the responsibility label. Infra may deliver human-owned escalations to
May, but it must preserve `owner: "human:<role>"` on the event.

Routing is mechanical. The owner decides the actual fix. A valid route emits
`handler.routed`; malformed or unowned input emits `handler.skipped`.

### Human Reply Bridge

Human-owned escalations are usually delivered through May and a human channel
such as Telegram. Transport code only moves messages and restores context. May
owns the reply as a decision task. The human reply is not itself the lifecycle
resolution until May or another owner converts it into a structured outcome.

End-to-end path:

```text
escalation.created(owner = human:operator)
  -> May emits message.created to human
     trace.parentEventId = escalation.created event id
     data.originalIssue.eventType = escalation.created
     data.expectedClosure = [escalation.resolved, escalation.dismissed]
  -> human replies in Telegram/Web/etc.
  -> transport emits human.input.received with the human text and restored context
     trace.parentEventId = message.created event id
  -> command-router gives May one correlated reply-handling work item
  -> May agent decides what the reply means
  -> May emits escalation.resolved, escalation.dismissed, or a clear follow-up event
     trace.parentEventId = human.input.received event id
     trace.links includes closure link to escalation.created event id
  -> escalation-lifecycle resumes sourceSessionId/checkpointRef after terminal closure
```

`sourceSessionId` and `resume.checkpointRef` are context for step 4, not a
direct reply target. A human reply must not be steered straight into the
original blocked source session, because that bypasses `escalation.resolved`
and leaves the escalation open. The source session resumes only after the
terminal resolution event.

Responsibility split:

- Telegram/Web transport stores and restores reply context.
- Command routing delivers one clear work item to May.
- May agent interprets the reply and emits the next structured event.
- Runtime lifecycle code observes terminal escalation events and resumes source
  work when appropriate.
- Watchdogs audit missing closure; they do not interpret the human answer.

The internal delivery message should include enough attached context for the
May agent to act without guessing:

```text
Human reply
approve

Attached context
Conversation: escalation:esc_123
Original issue: escalation.created
Escalation: esc_123
Source session: s_blocked
Reason: Needs owner approval.
Original ask: Approve the run or provide an alternate target.
Expected closure: escalation.resolved, escalation.dismissed

Use the human reply as the decision or missing input. Emit the expected
resolution/dismissal event when done.
```

The May reply-handling work item should not introduce a new lifecycle object
unless it has to. It should read the attached context, decide the next event, and
emit that event. If the reply is insufficient, it should emit or create one exact
follow-up ask or wait with a recheck/fallback, not leave the conversation as a
loose chat.

### 3. Resolve

The owner emits `escalation.resolved` when it has a disposition.

```json
{
  "type": "escalation.resolved",
  "source": "agent:may",
  "owner": "agent:tech-lead",
  "trace": {
    "traceId": "event:100",
    "parentEventId": 102,
    "links": [{ "eventId": 100, "type": "closure" }]
  },
  "data": {
    "resolverAgent": "may",
    "outcome": "fixed",
    "summary": "The session.completed emitter now includes sessionId in event data and the subscribed handler reads it from event.data.",
    "evidence": {
      "commits": ["abc1234"],
      "files": ["projects/may-agent/src/app/daemon-events.ts", "projects/evaluation.app/workflows/evaluator-aftermath.ts"],
      "events": ["handler.workflow_dispatched status=done"]
    },
    "resumeInstruction": "Retry the blocked aftermath review for the original session."
  }
}
```

Allowed outcomes:

| Outcome | Meaning |
|---------|---------|
| `fixed` | Owner believes the blocker is repaired. |
| `answered` | Owner supplied the missing decision or information. |
| `rejected` | Owner says the request is invalid or should not be acted on. |
| `needs_human` | Owner cannot decide without a human and has created or linked a child escalation whose `owner` is `human:<role>`. |
| `superseded` | The original request no longer matters. |

For `needs_human`, the source escalation stays effectively open until the child
human escalation resolves or is dismissed. Runtime should not resume the original
source work merely because an intermediate owner asked a human.

### 4. Resume The Blocked Task

On terminal `escalation.resolved`, infra should resume the blocked task session
when possible and inject the resolution context. The source session is the resume
target. `workflowRunId` and `projectId` are context for that resumed task, not
separate things that the escalation lifecycle resumes.

```text
resolution event -> follow closure link to escalation.created -> resume sourceSessionId/checkpointRef -> inject summary/evidence/resumeInstruction + workflow/project context
```

Resume behavior must map to current work state:

| Source context | Resume behavior |
|----------------|-----------------|
| Active source session | Send the resolution into the same session. |
| Finished job/call/chat session | Use `resumeSession(sessionId, message)` when the transcript/state is recoverable. |
| Workflow run id | Include it in the resumed session context; the task can call workflow resume if that is still the right next action. |
| Project id/path/status | Include it as context only. Project status changes are handled by the project handler/owner loop, not by escalation resume. |

Starting a new continuation session is only a fallback when true resume is unavailable:

- original session expired or crashed
- model/runtime state is unavailable
- policy says a fresh session is safer
- the opening event did not include a recoverable source session

The fallback should still link back to the same opening event and pass the
original checkpoint and resolution context.

## State

The events table remains the audit trail. `events.data` stores the
event-specific `data` object from the canonical event envelope, not a second
copy of envelope fields. A small projection table may be useful later for query
speed, but it should not become the source of truth.

Minimum derived state:

```text
created -> routed -> in_progress -> waiting_human -> resolved | dismissed | expired
```

The graph implementation derives open escalations from events and close edges:

```sql
-- open escalations
SELECT *
FROM events c
WHERE c.event_type = 'escalation.created'
  AND NOT EXISTS (
    SELECT 1 FROM event_trace_links l
    JOIN events r ON r.id = l.from_event_id
    WHERE l.to_event_id = c.id
      AND l.type = 'closure'
      AND r.event_type IN ('escalation.resolved', 'escalation.dismissed')
      AND COALESCE(json_extract(r.data, '$.outcome'), '') != 'needs_human'
  );
```

Use a projection only when UI/handler queries need it.

## Visibility

Escalation should be observable in three places:

| Surface | What it shows |
|---------|---------------|
| Event graph/session trace | Raw `escalation.*` events, generic links, source session lines, resolution event, and resume attempt. |
| Owner heartbeat/inbox | Actionable owner item with reason, requested action, evidence, and source. |
| Source session/project | Blocked/waiting/pending-review state, opening event id, owner, and latest disposition. |

The UI should make event links explicit: click an escalation event, see the
source session lines, owner session, resolution event, child escalation chain,
and resume attempt.

## Project Task Integration

For Project App V3 task-tree projects, escalation is attached to the blocked task
itself. Do not create top-level `escalation-*` task branches or a separate
project-control lane.

Minimum task overlay:

```json
{
  "state": "blocked",
  "blocker": "Needs owner approval.",
  "session_id": "s_task_live_run",
  "escalation_event_id": 100,
  "escalation": {
    "state": "open",
    "owner": "human:project-owner",
    "severity": "P1",
    "reason": "Needs owner approval.",
    "requested_action": "Approve the run or provide an alternate target.",
    "resume_condition": "Owner answers.",
    "dedup_key": "project:task:blocker"
  }
}
```

Resolution should wake the project owner loop, not mutate project state from the
router directly. The project engine reads the resolution event, updates the task
overlay, and then either moves the task back to `backlog`, keeps it `blocked`,
marks it `done` with `resolution: "superseded"`, or waits for a child human
escalation.

## Metrics

Metrics should measure lifecycle health, not replace judgment:

| Metric | Meaning |
|--------|---------|
| `escalation.pending-count` | Created escalations without terminal disposition. |
| `escalation.resolve-time-ms` | Time from created to terminal resolved/dismissed. |
| `escalation.resume-success-rate` | Resolutions that resumed the original source work successfully. |
| `escalation.noisy-dedup-count` | Suppressed duplicate escalations by `dedupKey`. |
| `escalation.unowned-count` | Escalations without a concrete agent/human owner. |

## Current Implementation Cross-Check

> **Last verified: 2026-06-13 ~00:30Z** — DB evidence from full escalation event
> history (35 created, 35 routed, 0 resolved, 0 dismissed, 0 resume events).
> All 35 escalations remain `pending` status — zero have been handled.
> See KE-1739 for detailed analysis of the escalation graveyard.

| Area | Current state | Gap |
|------|---------------|-----|
| Event payload delivery | `Cron.triggerSubscribers()` passes the original bus event envelope directly; canonical handlers read domain fields from `event.data`. | Implemented. Keep this model; do not add per-field framework promotion or wrapper payloads. |
| Workflow-backed handler | `handler: { workflow, agent, task, includeEvent: true }` uses the SDK workflow adapter, appends the event envelope, and can skip when missing. | Good for event-to-workflow bridges without custom handler code. |
| SDK escalation | `sdk.escalate(reason, opts?)` emits canonical `escalation.created`, keeps envelope fields out of `data`, and relies on the event pipeline for persistence. | Structured create is in place. |
| Session boundary promotion | 100% of real `escalation.created` events come from `runtime:session-finish` — agents use `finish({ blockers })` which promotes to escalation, not `sdk.escalate()` in-session. | In-session `sdk.escalate()` is available but unused. All 35 escalations originate from session-finish boundary code, not proactive mid-session calls. |
| Routing handler | `agents/may/handlers/escalation.ts` subscribes to `escalation.created`, emits `handler.routed`, and sends a message to the owner. Human-owned routes emit `message.created` with `conversationId`, `originalIssue`, and `expectedClosure`. | Implemented (Slice 2). Keep routing evidence as `handler.routed`; do not reintroduce orphan `escalation.routed` events. |
| Human reply bridge | Telegram can recover `message.created` context and emit `human.input.received` with `context.telegramReply`. Command-router can enrich internal delivery messages from that context. | Escalation replies must route to May as a correlated reply-handling work item, not directly to `sourceSessionId`. |
| Resolution | **Owner convention still needed.** May or the target owner must turn human/agent answers into `escalation.resolved` or `escalation.dismissed`. | Slice 3 remains the critical missing closure path. Without it, human replies are acknowledged but escalations stay open. |
| Resume lifecycle | `projects/may-agent/src/lib/escalation-lifecycle.ts` subscribes to `escalation.resolved` to drive session resume. Event types are defined in `event-bus.ts`. | Slice 4 infra exists. It works only after Slice 3 emits terminal resolution events. Directly steering the source session bypasses this lifecycle and should be avoided for escalations. |
| `dedupKey` | Design doc specifies `dedupKey` for duplicate suppression. | **All 35 escalations have `dedupKey: null`.** Session-finish boundary does not populate it. Dedup metric (`escalation.noisy-dedup-count`) has no signal. |
| Escalation metrics | Doc specifies 5 lifecycle metrics (open-count, resolve-time, resume-success, dedup-count, unowned-count). | **None exist** in the active metrics table. No escalation health observability. |
| Workflow blocking | Workflow `ctx.blocked(reason, context)` returns a local blocked workflow result and stops the synchronous workflow. | It should not automatically publish `escalation.created`; boundary code decides whether the local blocker needs owner routing. |
| Docs | `events.md` documents the common event envelope and canonical escalation taxonomy. | Handler/manual examples should keep using direct `event.data` payloads. |

## Workflow Blocking: Simple Sync Path

Workflow execution is synchronous: `runWorkflow(...)` blocks until the workflow
returns `done` or `blocked`. A local workflow blocker is not automatically a
cross-agent event:

```typescript
if (!sessionId) {
  return ctx.blocked("Missing sessionId", {
    requestedAction: "Fix the event producer so session.completed includes sessionId.",
    evidence: { trigger },
  });
}
```

The workflow author does not create separate escalation ids, write lifecycle
rows, wake owners, or manage resume. `ctx.blocked(reason, context?)` does
exactly one thing:

1. Return `{ type: "blocked", reason, context }` to the synchronous workflow
   caller, so the current workflow stops cleanly.

The synchronous caller then chooses one of three paths:

| Caller decision | Meaning |
|-----------------|---------|
| Handle locally | The caller has enough context to retry, repair, mark the job failed, or return a normal error. No external event is needed. |
| Record as workflow result | The blocker is useful trace context but not an owner-routed work item. Persist the workflow run as `blocked`; do not wake another owner. |
| Return to task/project owner | A top-level workflow is blocked. If it was triggered by `project.task.assigned`, runtime emits blocked `project.task.completed`. Otherwise it emits `project.owner.requested` for project workflows or `workflow.owner.requested` for non-project workflows. The owner can repair, retry, update the task tree when applicable, or decide the next route. |
| Promote to external escalation | The blocker crosses beyond the responsible workflow owner boundary. Emit canonical `escalation.created` from the boundary layer with workflow lineage and resume context. |

When a boundary promotes the local workflow blocker to `escalation.created`,
runtime owns the canonical event defaults:

| Field | Default for promoted workflow blocker |
|-------|---------------------------------|
| `owner` | `context.owner` when supplied; otherwise `agent:may` |
| `source` | current workflow agent, e.g. `agent:evaluator` |
| event id | assigned by event store; this is the escalation identity |
| `data.sourceAgent` | current workflow agent |
| `data.sourceSessionId` | parent session id when available |
| `data.projectId` | workflow/project context when available |
| `data.reason` | first argument to `ctx.blocked` |
| `data.requestedAction` | `context.requestedAction`, or `Investigate and resolve or answer this blocker: ${reason}` |
| `data.evidence` | `context.evidence`, plus compact workflow context if present |
| `data.resume` | `{ kind: "session", checkpointRef, instruction }`; include `workflowRunId` separately as context |
| `data.dedupKey` | stable hash from workflow, owner, source agent, and reason |

The synchronous caller should treat `blocked` as a terminal workflow result. It
should not wait for the owner to resolve anything in the same call stack. Later
resolution is event-driven only if a boundary promoted the local result into an
external `escalation.created` event.

This keeps workflow code straightforward while still following the event-driven
escalation lifecycle.

## Implementation Slices

> **Slice status as of 2026-06-08:** Slice 1 (create) and Slice 2 (routing) are
> implemented and live. Slices 3–5 are unbuilt. See cross-check table above.

### Slice 1: Structured Create

- Add a structured escalation helper:

  ```typescript
  sdk.escalate(reason, {
    owner?: string, // "agent:<name>" or "human:<role>"
    requestedAction?,
    evidence?,
    severity?,
    projectId?,
    sourceSessionId?,
    resume?,
    dedupKey?
  })
  ```

- Default `owner` to `agent:may`. This makes the simple path meaningful: "I am
  blocked; ask May to route or resolve it."
- Persist `escalation.created` and use the resulting event id as the escalation
  identity. Keep `data.escalationId` only as a legacy compatibility key for old
  rows or external integrations that cannot reference event ids yet.
- Reject the removed `sdk.escalate(target, reason)` shape. Callers pass routing
  through `opts.owner`; the only shorthand is `owner: "human"` mapping to
  `owner: "human:operator"`.
- Keep workflow `ctx.blocked(reason, context)` as the sync terminal helper
  above. It should not emit `escalation.created` by itself. `ctx.escalate(...)`
  may remain as a deprecated compatibility alias, but docs and new workflows
  should not use it.
- Add a boundary promotion helper only where needed, for example
  `promoteWorkflowEscalation(result, lineage)` or equivalent handler/runtime
  code that emits canonical `escalation.created` when the blocker must route to
  another owner.

### Slice 2: Owner Routing

- Add or update an event-subscribed owner routing handler for `escalation.created`.
- Validate that `owner` resolves to `agent:<name>` or `human:<role>`.
- Emit `handler.skipped` for malformed events and `handler.routed` for valid ones.
- Wake the owner through inbox/handler dispatch without domain-specific payload hacks.

### Slice 3: Resolution

- Add an owner handler/session convention for emitting `escalation.resolved`.
- Include `outcome`, `summary`, `evidence`, and `resumeInstruction`.
- For `needs_human`, create or link a child `escalation.created` with a generic
  `parentEventId` pointing to the parent escalation event and `owner:
  "human:<role>"`; do not resume the original source until the human child
  reaches a terminal disposition.
- Add tests proving resolution closes the original event by event id / graph
  link, not by fuzzy reason text. Current legacy coverage may still include
  terminal session resume, active-session send, and the `needs_human` child
  chain by compatibility id.

### Slice 4: Resume Delivery

- On `escalation.resolved`, look up the original `escalation.created`.
- Try to resume the original source session: send into an active session, otherwise cold-resume it.
- Emit `escalation.resume_attempted`, `escalation.resume_failed`, or `escalation.resume_started`.
- Keep `workflowRunId` and `projectId` as context for the resumed task. Do not make project or workflow records separate escalation resume targets.

### Slice 5: UI And Metrics

- Show escalation lifecycle in event graph and session/project traces.
- Add open escalation and resume-success metrics.
- Show duplicate suppression and unowned escalations as operational hygiene signals.

## Non-Goals

- Do not create project-specific escalation handlers.
- Do not teach the framework special fields such as `sessionId`.
- Do not treat `escalation.resolved` as proof the original project is fixed.
- Do not start a new continuation session when the original session can be resumed.
- Do not route every evaluator/guard signal as an escalation. Evaluator findings use `learning.feedback`; raw guard events are hypotheses until reviewed.
