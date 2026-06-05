<ai_context>
summary: The events.md design doc's Operational Status appendix was last refreshed 2026-05-07 and listed only 16 event types. Querying the live events table reveals 62 distinct event types, of which 33 were completely undocumented in events.md. The undocumented types include the entire evaluation lifecycle (9 types, 10.9k rows), task lifecycle (7 types, 2.3k rows), project owner loop events (6 types, 2.7k rows), heartbeat lifecycle (4 types, 1.6k rows), and project health events (2 types, 62.2k rows — the single highest-volume event type project.health.checked was undocumented). The appendix has been updated to cover all 62 types, organized by functional category.
triggers: events taxonomy, event types, undocumented events, events.md, operational status, design doc drift, taxonomy gap
</ai_context>

# KE-1586: Events Taxonomy Drift — 33 Undocumented Event Types

**Date:** 2026-06-11
**Author:** arc (heartbeat coherence audit)

## Finding

The `shared/may-agent-docs/2a-design/events.md` Operational Status appendix was last refreshed 2026-05-07 (35 days ago) and listed 16 event types in its Emitter Reality table. Querying `SELECT event_type, COUNT(*) FROM events GROUP BY event_type` reveals 62 distinct event types actively persisted. **33 of these (53%) were completely absent from the appendix.**

## What Was Missing

| Category | Undocumented types | Combined rows | Highest-volume type |
|----------|-------------------|--------------|---------------------|
| Project health | `project.health.checked`, `project.health.finding` | 62.2k | `project.health.checked` (61.4k — highest-volume event type in the system) |
| Evaluation lifecycle | 9 types (`evaluation.routed` through `evaluation.skipped`) | 10.9k | `evaluation.routed` (3.2k) |
| Handler lifecycle | `handler.skipped`, `handler.workflow_dispatched`, `handler.routed` | 17.9k | `handler.skipped` (9.3k) |
| Task lifecycle | 7 types (`task.started` through `task.blocked`) | 2.3k | `task.started` (963) |
| Project owner loop | 6 types (`project.owner.*`, `project.execution.*`, `project.nudge`, `project.audit.suggested`) | 2.7k | `project.owner.dispatched` (1.1k) |
| Project task-driven | `project.task.execution.requested`, `project.tasks.ready`, `project.task.completed` | 1.2k | `project.task.execution.requested` (439) |
| Heartbeat lifecycle | 4 types (`heartbeat.step_started`, `heartbeat.diagnostics_*`, `heartbeat.skipped`) | 1.6k | `heartbeat.step_started` (1.3k) |
| Session/agent extras | `session.receipt`, `context.read`, `agent.config_invalid`, `message.delivery_failed` | 10.8k | `session.receipt` (6.1k) |
| Operator signals | `steer`, `trigger.project`, `restart`, `reload` | 43 | `steer` (22) |

## Why It Matters

Agents querying events by type need to know what types exist. The design doc is the canonical reference. When 53% of live event types are undocumented:
- Agents fabricate event type names from context (a recurring footgun: KE-910 documents the column-name version of this same pattern)
- New handler authors don't know what events they can subscribe to
- The Operational Status appendix's purpose — telling readers what's actually live vs. aspirational — is defeated

## Fix Applied

Updated the Operational Status appendix in `shared/may-agent-docs/2a-design/events.md`:
- Organized the 62 event types into 12 functional categories (Handler, Session, Project owner loop, Project task-driven, Project health, Task generic, Evaluation, Metrics, Agent communication, Escalation, Heartbeat, Context/infrastructure)
- Added row counts from live DB for each type
- Refreshed date to 2026-06-11

## Root Cause

No automated mechanism refreshes the appendix. It was last updated by a human or agent on 2026-05-07. In the intervening 35 days, new subsystems shipped (task engine, evaluation pipeline, project health checker) that emit events not reflected in the doc. This is a specific instance of the compilation cliff (KE-1585): system changes produce artifacts (event rows) but no pipeline exists to update the reference documentation.
