---
id: platform
owner: tech-lead
status: waiting
type: milestone
priority: P0
project_policy: signal-driven
max_concurrent: 2
task_tree: ../tasks/tree.json
domain_project: ../project.md
---

# Platform Runtime Frame

## Goal

Keep the May-agent platform stable and evolvable: runtime, SDK, event/session
task execution, persistence, read models, HTTP/UI surfaces, build/test tooling,
and reusable project app infrastructure.

The root `../project.md` remains the human-visible domain goal. This file is
the runtime control-plane frame for agents and project app handlers.

## Current State

Project App V2 is being adopted by the platform project as the second proving
project after `aks-rp-e2e`. The shared platform web UI now owns the generic
Project Kanban projection from `tasks/tree.json`; project-local `/ui` surfaces
remain domain-specific.

Canonical execution state:

- Task tree: `../tasks/tree.json`
- Code repo: `../repos/may-agent/`
- Shared UI source: `../repos/may-agent/packages/webui/static/`
- Served platform UI copy: `../ui/`

## Runtime Policy

- Platform runs from concrete signals: human comments, platform metrics,
  project task events, failing build/test checks, or explicit owner advance.
- Standing work such as signal intake, planning, and hygiene is represented by
  stable loop tasks, not by creating a new root task for every loop run.
- Workers execute leased leaf tasks. The planner/reviewer loop owns tree shape,
  parent rollup, refill, and concrete stop reasons.
- `blocked` is only for external/input/safety waits. Validation failures,
  vague scope, stale evidence, and parent bookkeeping become review/rework
  tasks, not passive waiting.

## Next Action

Waiting for next platform signal — failing metric, unread comment, or owner
push. All iter40 tasks (v2 adoption, shared Kanban, test fixes) are complete.
The `platform-v2-second-adopter-rollup` review task is accepted and ready for
execution when scheduled.
