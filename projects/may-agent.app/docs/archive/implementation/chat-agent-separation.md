# Chat and Bounded Job Convergence

**Historical context:** [Agent Cooperation](../../2a-design/agents.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Completed and superseded by canonical May App admission
(2026-08-17).
**Current authority:** [Human Control Surfaces](../../2a-design/human-control-surfaces.md),
[Sessions](../../2a-design/sessions.md), [Event Graph](../../2a-design/event-graph.md),
and [Native Coding Workers](../../2a-design/native-coding-workers.md).

## Historical intent

This tracker separated persistent human chat from bounded jobs while retaining
shared sessions, traces, events, and tools. Its core runtime work was completed:

- direct agent chat uses a repeated `running -> idle` lifecycle;
- bounded jobs terminate with a structured result;
- chat turns carry independent traces within one persistent session;
- transcript persistence and cold resume are implemented; and
- CLI tasks persist before process spawn, preserve trace context, and steer a
  still-available source session when they finish.

The later canonical App migration changed the human-request authority. Ordinary
May input no longer depends on a persistent May chat session:

```text
human input -> may App inbox item -> bounded owner pass
            -> optional child App/task dependency -> May review
            -> correlated channel delivery
```

The inbox item is the recoverable promise. Conversation, session, trace, and
reply identities are context and observability. A restart can replace a bounded
owner session without losing, duplicating, or replaying the human request.

## Resolution of the former remaining work

| Former item | Resolution |
| --- | --- |
| Restart recovery proof | Superseded for ordinary May input by App inbox recovery. Runtime tests prove startup rescan, exact session-wait recovery, offline completion recovery, and delivery certainty. Direct chat cold-resume and visible `session.resume_failed` behavior remain covered separately. |
| Per-turn trace proof | The EventBus gives each human ingress one root trace and propagates child intent synchronously. The durable May request, dependency links, and delivery operation—not an all-encompassing trace—carry eventual-handling authority across asynchronous attempts. |
| CLI delegation presentation | Not part of the May App lifecycle. App-owner tool policy excludes asynchronous `run_cli_agent`; durable long-running work is returned as App delegation or task attachment. Compatibility/direct-agent sessions retain the tested CLI task lifecycle and completion steering. |
| Global-agent residue | Closed. `agents/may` is the one intentional standalone conversational deputy. Platform and domain identities are App-local and discovered from their packages. |

Representative Runtime proofs:

- `src/app/command-router.test.ts` — one May App admission per ordinary human
  input and deterministic explicit controls;
- `src/app/app-owner-manager-adapter.test.ts` — human requests use bounded,
  schema-bound owner sessions;
- `src/app/app-inbox-runtime.test.ts` — channel metadata, correlated delivery,
  startup rescan, exact session-wait recovery, offline completion recovery, and
  no blind redelivery after uncertain delivery;
- `test/integration/resume-agent.test.ts` — direct chat cold resume and visible
  recovery failure events; and
- `src/app/cli-task-runner.test.ts` — persisted CLI lifecycle, trace propagation,
  source-session steering, and deduplication.

## Final boundary

- Direct agent chat may remain persistent and session-oriented.
- Ordinary May requests are durable App work and use bounded owner sessions.
- A session result is evidence; it is not the human request's durable identity.
- App owners cannot start asynchronous CLI work outside their fenced
  disposition.
- Long-running outcomes cross a typed App delegation or task boundary before
  the owner attempt ends.

No second chat framework, request lifecycle, or global-agent roster is needed.
