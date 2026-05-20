# Design: Escalation System

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
workflow can return `ctx.escalate(...)` as a local terminal result without
emitting `escalation.created`; the caller or runtime boundary decides whether
that local result should be promoted into the external lifecycle.

Escalation can chain upward. If an agent owner cannot resolve the blocker, it
emits or links the next escalation to a human owner; when that human escalation is
answered, the chain can pop back down and resume the original blocked work.

Escalation should not be a hidden human notification, an ad-hoc retry loop, or a project-specific workaround. It is an event-driven coordination lifecycle with enough context for the owner to investigate and act.

## Boundary

| Part | Responsibility |
|------|----------------|
| Source agent | Decide it is blocked, explain the blocker, attach evidence, and pause/checkpoint its work. |
| Runtime/infra | Persist events, route to the owner, wake/queue handlers, deduplicate noisy repeats, track correlation, and deliver the resolution back. |
| Owner | Investigate, fix, answer, reject, or route to a human. |
| Source agent after resolution | Resume with the resolution context and decide whether it is actually unblocked. |

`escalation.resolved` means the owner produced a disposition. It does not guarantee the source work is fixed. The source agent still owns the final unblock decision.

## Lifecycle

### 1. Create

When blocked work must be handled by another owner, the boundary emits
`escalation.created` and pauses or records the source work with a durable resume
reference.

Escalation events have two layers:

- **Event envelope** follows the normal event schema: `type`, `source`, `owner`,
  `urgency`, `ttl_ms`, and timestamp.
- **`data`** carries escalation-specific lifecycle fields and the agent-facing
  brief: escalation id, blocker context, requested action, evidence, and resume
  instructions.

```json
{
  "type": "escalation.created",
  "source": "agent:tech-lead",
  "owner": "agent:may",
  "urgency": "high",
  "data": {
    "escalationId": "esc_...",
    "sourceAgent": "tech-lead",
    "sourceSessionId": "s_...",
    "projectId": "platform",
    "projectPath": "/app/projects/platform",
    "reason": "The workflow needs a sessionId but the trigger payload did not include one.",
    "requestedAction": "Find the event producer and make the emitted event carry the needed sessionId in data.",
    "severity": "P1",
    "blockedOn": "event payload is incomplete",
    "evidence": {
      "events": ["handler.workflow_dispatched status=escalated"],
      "files": ["agents/evaluator/workflows/evaluator-aftermath.ts"],
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

The event envelope routes the work. `event.data` carries escalation correlation
and context. The framework must not lift domain fields such as `sessionId`,
`projectId`, `metricId`, or `escalationId` onto subscriber-specific shortcut
fields. Event-subscribed handlers receive the original event envelope and read
escalation fields from `event.data`.

### 2. Route And Wake

Infra persists the event and routes it by owner:

| `owner` | Runtime action |
|---------|----------------|
| `agent:<name>` | Add owner-targeted inbox event and trigger or queue the matching owner handler. |
| `human:<role>` | Deliver to May because May is the human's deputy; May chooses Telegram/UI/defer/dismiss. |

`owner` is the responsibility label. Infra may deliver human-owned escalations to
May, but it must preserve `owner: "human:<role>"` on the event.

Routing is mechanical. The owner decides the actual fix. A valid route emits
`escalation.routed`; malformed or unowned input emits `handler.skipped`.

### 3. Resolve

The owner emits `escalation.resolved` when it has a disposition.

```json
{
  "type": "escalation.resolved",
  "source": "agent:may",
  "owner": "agent:tech-lead",
  "data": {
    "escalationId": "esc_...",
    "resolverAgent": "may",
    "outcome": "fixed",
    "summary": "The session.completed emitter now includes sessionId in event data and the subscribed handler reads it from event.data.",
    "evidence": {
      "commits": ["abc1234"],
      "files": ["src/app/daemon-events.ts", "agents/evaluator/handlers/evaluator-aftermath.ts"],
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
resolution event -> lookup escalationId -> resume sourceSessionId/checkpointRef -> inject summary/evidence/resumeInstruction + workflow/project context
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
- the escalation did not include a recoverable source session

The fallback should still preserve the same `escalationId` and pass the original checkpoint and resolution context.

## State

The events table remains the audit trail. `events.data` stores the
event-specific `data` object from the canonical event envelope, not a second
copy of envelope fields. A small projection table may be useful later for query
speed, but it should not become the source of truth.

Minimum derived state:

```text
created -> routed -> in_progress -> waiting_human -> resolved | dismissed | expired
```

The first implementation can derive this from events:

```sql
-- open escalations
SELECT *
FROM events c
WHERE c.event_type = 'escalation.created'
  AND NOT EXISTS (
    SELECT 1 FROM events r
    WHERE r.event_type IN ('escalation.resolved', 'escalation.dismissed')
      AND json_extract(r.data, '$.escalationId') = json_extract(c.data, '$.escalationId')
      AND (
        r.event_type = 'escalation.dismissed'
        OR COALESCE(json_extract(r.data, '$.outcome'), '') != 'needs_human'
      )
  );
```

Use a projection only when UI/handler queries need it.

## Visibility

Escalation should be observable in three places:

| Surface | What it shows |
|---------|---------------|
| Events/session trace | Raw `escalation.*` events with payload and correlation. |
| Owner heartbeat/inbox | Actionable owner item with reason, requested action, evidence, and source. |
| Source session/project | Blocked/waiting/pending-review state, escalation id, owner, and latest disposition. |

The UI should make correlation explicit: click an escalation, see the source session lines, owner session, resolution event, child escalation chain, and resume attempt.

## Metrics

Metrics should measure lifecycle health, not replace judgment:

| Metric | Meaning |
|--------|---------|
| `escalation.open-count` | Created escalations without terminal disposition. |
| `escalation.resolve-time-ms` | Time from created to terminal resolved/dismissed. |
| `escalation.resume-success-rate` | Resolutions that resumed the original source work successfully. |
| `escalation.noisy-dedup-count` | Suppressed duplicate escalations by `dedupKey`. |
| `escalation.unowned-count` | Escalations without a concrete agent/human owner. |

## Current Implementation Cross-Check

| Area | Current state | Gap |
|------|---------------|-----|
| Event payload delivery | `Cron.triggerSubscribers()` passes the original bus event envelope directly; canonical handlers read domain fields from `event.data`. | Implemented. Keep this model; do not add per-field framework promotion or wrapper payloads. |
| Workflow-backed handler | `handler: { workflow, agent, task, includeEvent: true }` uses the SDK workflow adapter, appends the event envelope, and can skip when missing. | Good for event-to-workflow bridges without custom handler code. |
| SDK escalation | `sdk.escalate(reason, opts?)` emits canonical `escalation.created`, keeps envelope fields out of `data`, and relies on the event pipeline for persistence. | Structured create is in place. |
| Workflow escalation | Workflow `ctx.escalate(reason, context)` returns an escalated workflow result and stops the synchronous workflow. | Good target shape. It should not automatically publish `escalation.created`; boundary code decides whether the local workflow escalation needs owner routing. |
| Session boundary promotion | Blocked/failure `session.end` with structured `finishParams` emits canonical `escalation.created` owned by May, with source agent/session and blocker context in `data`. | Session-source escalation resume is wired after terminal resolution. Owner routing still depends on subscribed handlers/workflows. |
| Resume capability | Runtime has session/workflow resume primitives and resume diagnostic events. | Terminal `escalation.resolved` resumes the original source session when `sourceSessionId` is available. Workflow checkpoint resume from escalation resolution is still not wired. |
| Docs | `events.md` documents the common event envelope and canonical escalation taxonomy. | Handler/manual examples should keep using direct `event.data` payloads. |

## Workflow Escalation: Simple Sync Path

Workflow execution is synchronous: `runWorkflow(...)` blocks until the workflow
returns `done` or `escalate`. That means escalation inside workflow code is a
local terminal result, not automatically a cross-agent event:

```typescript
if (!sessionId) {
  return ctx.escalate("Missing sessionId", {
    requestedAction: "Fix the event producer so session.completed includes sessionId.",
    evidence: { trigger },
  });
}
```

The workflow author does not create escalation ids, write lifecycle rows, wake
owners, or manage resume. `ctx.escalate(reason, context?)` does exactly one
thing:

1. Return `{ type: "escalate", reason, context }` to the synchronous workflow
   caller, so the current workflow stops cleanly.

The synchronous caller then chooses one of three paths:

| Caller decision | Meaning |
|-----------------|---------|
| Handle locally | The caller has enough context to retry, repair, mark the job failed, or return a normal error. No external event is needed. |
| Record as workflow result | The escalation is useful trace context but not an owner-routed work item. Persist the workflow run as `escalated`; do not wake another owner. |
| Promote to external escalation | The blocker crosses an ownership boundary. Emit canonical `escalation.created` from the boundary layer with workflow lineage and resume context. |

When a boundary promotes the local workflow escalation to `escalation.created`,
runtime owns the canonical event defaults:

| Field | Default for workflow escalation |
|-------|---------------------------------|
| `owner` | `context.owner` when supplied; otherwise `agent:may` |
| `source` | current workflow agent, e.g. `agent:evaluator` |
| `data.escalationId` | generated by runtime |
| `data.sourceAgent` | current workflow agent |
| `data.sourceSessionId` | parent session id when available |
| `data.projectId` | workflow/project context when available |
| `data.reason` | first argument to `ctx.escalate` |
| `data.requestedAction` | `context.requestedAction`, or `Investigate and resolve or answer this blocker: ${reason}` |
| `data.evidence` | `context.evidence`, plus compact workflow context if present |
| `data.resume` | `{ kind: "session", checkpointRef, instruction }`; include `workflowRunId` separately as context |
| `data.dedupKey` | stable hash from workflow, owner, source agent, and reason |

The synchronous caller should treat `escalate` as a terminal workflow result. It
should not wait for the owner to resolve anything in the same call stack. Later
resolution is event-driven only if a boundary promoted the local result into an
external `escalation.created` event.

This keeps workflow code straightforward while still following the event-driven
escalation lifecycle.

## Implementation Slices

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
- Generate `escalationId` if missing.
- Reject the removed `sdk.escalate(target, reason)` shape. Callers pass routing
  through `opts.owner`; the only shorthand is `owner: "human"` mapping to
  `owner: "human:operator"`.
- Keep workflow `ctx.escalate(reason, context)` as the sync terminal helper
  above. It should not emit `escalation.created` by itself.
- Add a boundary promotion helper only where needed, for example
  `promoteWorkflowEscalation(result, lineage)` or equivalent handler/runtime
  code that emits canonical `escalation.created` when the blocker must route to
  another owner.

### Slice 2: Owner Routing

- Add or update an event-subscribed owner routing handler for `escalation.created`.
- Validate that `owner` resolves to `agent:<name>` or `human:<role>`.
- Emit `handler.skipped` for malformed events and `escalation.routed` for valid ones.
- Wake the owner through inbox/handler dispatch without domain-specific payload hacks.

### Slice 3: Resolution

- Add an owner handler/session convention for emitting `escalation.resolved`.
- Include `outcome`, `summary`, `evidence`, and `resumeInstruction`.
- For `needs_human`, create or link a child `escalation.created` with `parentEscalationId` and `owner: "human:<role>"`; do not resume the original source until the human child reaches a terminal disposition.
- Add tests proving resolution is correlated by `escalationId`, not by fuzzy reason text. Current coverage includes terminal session resume, active-session send, and the `needs_human` child chain.

### Slice 4: Resume Delivery

- On `escalation.resolved`, look up the original `escalation.created`.
- Try to resume the original source session: send into an active session, otherwise cold-resume it.
- Emit `escalation.resume_attempted`, `escalation.resume_failed`, or `escalation.resume_started`.
- Keep `workflowRunId` and `projectId` as context for the resumed task. Do not make project or workflow records separate escalation resume targets.

### Slice 5: UI And Metrics

- Show escalation lifecycle in session/project traces.
- Add open escalation and resume-success metrics.
- Show duplicate suppression and unowned escalations as operational hygiene signals.

## Non-Goals

- Do not create project-specific escalation handlers.
- Do not teach the framework special fields such as `sessionId`.
- Do not treat `escalation.resolved` as proof the original project is fixed.
- Do not start a new continuation session when the original session can be resumed.
- Do not route every evaluator/guard signal as an escalation. Evaluator findings use `learning.feedback`; raw guard events are hypotheses until reviewed.
