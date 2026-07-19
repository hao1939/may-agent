# Handler Boundary Audit

**Design status:** Accepted.
**Implementation status:** Current after the convention-first Agent App
migration.

## Rule

A handler is a small infrastructure adapter. It accepts a timer or event,
performs bounded mechanical work, and emits facts or invokes an agent-owned
workflow. It must not become a second task scheduler, task-state writer, owner,
or learned process.

Agent Apps own domain event correlation. Apps with `tasks` attach one queue and
controller. Apps without `tasks` install no task state, recovery, or resync.
Reusable judgment belongs to a workflow under its owning agent.

## Current Global Handlers

| Handler | Responsibility | Boundary |
| --- | --- | --- |
| `metric-alert-reactor` | Deduplicate and route metric breaches | Reads bounded alert state; routes to the accountable owner/workflow |
| `session-recovery` | React to terminal failed/interrupted sessions | Produces recovery evidence; does not reconcile app tasks directly |
| `escalation` | Route `escalation.created` to human/owner surfaces | Delivery and lifecycle adapter only |
| `metrics-snapshot` | Measure and project runtime health | Mechanical observation and metric persistence |
| `coaching-consumer` | Consume bounded coaching signals | Invokes agent-owned coaching behavior |
| `feedback-echo-sync` | Synchronize feedback evidence | Mechanical projection, not owner judgment |

Project-specific schedules, event selectors, actions, task resolution, and
watchers live in sibling `projects/<id>.app/` packages. A watcher observes
provider state and emits semantic events; it never knows task IDs or mutates
task resources.

## Retired And Deleted

The migration deleted these global control paths rather than retaining disabled
compatibility code:

- `project`, `project-steward`, and `project-creative-audit`;
- `closed-loop-steward` and its query API;
- `eval-llm-scan` and session-aftermath scan ownership in May;
- app-root May heartbeat, project audit, and steward workflows;
- Markdown task parsing/assignment/review handlers and their live E2E fixtures.

Deep evaluation now belongs to Evaluation's evaluator-owned workflow and app
schedule. Session aftermath belongs to Evaluation. Platform operations review
and daily digest are tech-lead-owned workflows scheduled by `may-agent.app`.

## Review Checklist

- Does the handler only translate, observe, persist, or dispatch bounded work?
- Is reusable judgment implemented as an agent-owned workflow?
- Does any project event bypass the app's single resolver/queue/controller?
- Does any watcher import task-tree APIs or address a task ID?
- Does any deleted event name or task mutation API remain reachable?
- Can the same work be recovered from durable state without replaying a
  synthetic scheduler event?
