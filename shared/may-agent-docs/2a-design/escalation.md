# Design: Escalation System

**Status:** proposal refined against current docs and implementation
**Date:** 2026-05-19
**References:** [events.md](./events.md), [handler-authoring.md](../2b-manual/handler-authoring.md), [practice-learning-loop.md](./practice-learning-loop.md), KE-1242

## Purpose

Escalation is how one agent asks another owner for help without mixing responsibilities.

The clean model is:

```text
blocked work -> escalation.created -> owner handles it -> escalation.resolved -> original work resumes
```

Escalation should not be a hidden human notification, an ad-hoc retry loop, or a project-specific workaround. It is an event-driven coordination lifecycle with enough context for the target owner to investigate and act.

## Boundary

| Part | Responsibility |
|------|----------------|
| Source agent | Decide it is blocked, explain the blocker, attach evidence, and pause/checkpoint its work. |
| Runtime/infra | Persist events, route to the target owner, wake/queue handlers, deduplicate noisy repeats, track correlation, and deliver the resolution back. |
| Target owner | Investigate, fix, answer, reject, or route to a human. |
| Source agent after resolution | Resume with the resolution context and decide whether it is actually unblocked. |

`escalation.resolved` means the target owner produced a disposition. It does not guarantee the source work is fixed. The source agent still owns the final unblock decision.

## Lifecycle

### 1. Create

When the source agent cannot responsibly continue, it emits `escalation.created` and pauses with a durable resume reference.

```json
{
  "type": "escalation.created",
  "escalationId": "esc_...",
  "sourceAgent": "tech-lead",
  "sourceSessionId": "s_...",
  "targetOwner": "agent:may",
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
    "instruction": "Continue the paused session after reading the resolution summary and evidence."
  },
  "dedupKey": "evaluator-aftermath:missing-session-id",
  "createdAt": 1770000000000
}
```

The event type routes the work. The payload carries the facts. The framework must not lift domain fields such as `sessionId`, `projectId`, or `metricId` onto `TriggerEvent`; handlers read them from `event.data`.

### 2. Route And Wake

Infra persists the event and routes it by owner:

| `targetOwner` | Runtime action |
|---------------|----------------|
| `agent:<name>` | Add owner-targeted inbox event and trigger or queue the matching owner handler. |
| `human:<role>` | Route to May; May chooses Telegram/UI/defer/dismiss. |

Routing is mechanical. The owner decides the actual fix.

### 3. Resolve

The target owner emits `escalation.resolved` when it has a disposition.

```json
{
  "type": "escalation.resolved",
  "escalationId": "esc_...",
  "resolverAgent": "may",
  "outcome": "fixed",
  "summary": "The session.completed emitter now includes sessionId in event data and the subscribed handler reads it from trigger.data.",
  "evidence": {
    "commits": ["abc1234"],
    "files": ["src/app/daemon-events.ts", "agents/evaluator/handlers/evaluator-aftermath.ts"],
    "events": ["handler.workflow_dispatched status=done"]
  },
  "resumeInstruction": "Retry the blocked aftermath review for the original session.",
  "resolvedAt": 1770000300000
}
```

Allowed outcomes:

| Outcome | Meaning |
|---------|---------|
| `fixed` | Target owner believes the blocker is repaired. |
| `answered` | Target owner supplied the missing decision or information. |
| `rejected` | Target owner says the request is invalid or should not be acted on. |
| `needs_human` | Target owner cannot decide without a human. |
| `superseded` | The original request no longer matters. |

### 4. Resume First

On `escalation.resolved`, infra should resume the original paused session when possible and inject the resolution context.

```text
resolution event -> lookup escalationId -> resume original sourceSessionId/checkpointRef -> inject summary/evidence/resumeInstruction
```

Starting a new continuation session is only a fallback when true resume is unavailable:

- original session expired or crashed
- resume token/checkpoint is invalid
- model/runtime state is unavailable
- policy says a fresh session is safer
- the source was a project/workflow checkpoint rather than a live resumable session

The fallback should still preserve the same `escalationId` and pass the original checkpoint and resolution context.

## State

The events table remains the audit trail. A small projection table may be useful later for query speed, but it should not become the source of truth.

Minimum derived state:

```text
created -> routed -> in_progress -> resolved | dismissed | expired
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
  );
```

Use a projection only when UI/handler queries need it.

## Visibility

Escalation should be observable in three places:

| Surface | What it shows |
|---------|---------------|
| Events/session trace | Raw `escalation.*` events with payload and correlation. |
| Owner heartbeat/inbox | Actionable owner item with reason, requested action, evidence, and source. |
| Source session/project | Paused state, escalation id, target owner, and latest disposition. |

The UI should make correlation explicit: click an escalation, see the source session lines, target owner session, resolution event, and resume attempt.

## Metrics

Metrics should measure lifecycle health, not replace judgment:

| Metric | Meaning |
|--------|---------|
| `escalation.open-count` | Created escalations without terminal disposition. |
| `escalation.resolve-time-ms` | Time from created to resolved/dismissed. |
| `escalation.resume-success-rate` | Resolutions that resumed the original source session successfully. |
| `escalation.noisy-dedup-count` | Suppressed duplicate escalations by `dedupKey`. |
| `escalation.unowned-count` | Escalations without a concrete agent/human owner. |

## Current Implementation Cross-Check

| Area | Current state | Gap |
|------|---------------|-----|
| Event payload delivery | `Cron.triggerSubscribers()` passes the original bus event as `TriggerEvent.data`; handler docs now tell handlers to read domain fields from `event.data`. | Good. Keep this model; do not add per-field framework promotion. |
| SDK helper | `createWorkflowHandler({ includeEvent: true })` appends the trigger object and can skip when missing. | Good for event-to-workflow bridges. |
| SDK escalation | `sdk.escalate(target, reason)` persists `escalations.jsonl`, emits minimal `escalation.created { owner, source, reason }`, and sends a human-visible `message.created`. | Payload is too small for lifecycle correlation; no `escalationId`, evidence, requested action, or resume reference. |
| Workflow escalation | Workflow `ctx.escalate(reason, context)` emits `escalation.created` with the old `id`, `agent`, `reason`, `context`, `level`, `source` shape and ends the workflow as escalated. | Need the emitted event to use the structured lifecycle shape with `escalationId`, `targetOwner`, evidence, and resume reference. |
| Existing May escalation handler | `agents/may/handlers/escalation.ts` listens to `session.escalated`, classifies digest, and forwards to human when needed. | This is a router for blocked/failed finishes, not the lifecycle manager described here. |
| Resume capability | Runtime has session/workflow resume primitives and resume diagnostic events. | No escalation correlation path resumes the original paused session after `escalation.resolved`. |
| Docs | `events.md` and `handler-authoring.md` document the clean trigger payload model. | Escalation taxonomy needs the richer lifecycle shape and should avoid the old promotion-first design. |

## Implementation Slices

### Slice 1: Structured Create

- Add a structured escalation helper that accepts `targetOwner`, `reason`, `requestedAction`, `evidence`, `severity`, `projectId`, `sourceSessionId`, `resume`, and `dedupKey`.
- Generate `escalationId` if missing.
- Preserve the existing simple `sdk.escalate(target, reason)` as a compatibility wrapper only if needed by current callers, but have it emit the structured shape internally.
- Make workflow `ctx.escalate(reason, context)` include context in the emitted `escalation.created` data.

### Slice 2: Owner Routing

- Add or update an event-subscribed owner routing handler for `escalation.created`.
- Validate that `targetOwner` resolves to `agent:<name>` or `human:<role>`.
- Emit `handler.skipped` for malformed events and `escalation.routed` for valid ones.
- Wake the target owner through inbox/handler dispatch without domain-specific payload hacks.

### Slice 3: Resolution

- Add a target-owner workflow convention for emitting `escalation.resolved`.
- Include `outcome`, `summary`, `evidence`, and `resumeInstruction`.
- Add tests proving resolution is correlated by `escalationId`, not by fuzzy reason text.

### Slice 4: Resume Delivery

- On `escalation.resolved`, look up the original `escalation.created`.
- Try to resume the original source session/checkpoint first.
- Emit `escalation.resume_attempted`, `escalation.resume_failed`, or `escalation.resume_started`.
- Start a continuation session only when the resume attempt is impossible or fails.

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
