# May Knowledge Index

Use this directory for compact, durable context that is not already owned by a
canonical design doc or skill. Load only the file needed for the current
decision.

## Current references

- `directives.md` — Hao's durable preferences and decision rules.
- `projects.md` — optional project context; verify it against each current
  `project.json` and canonical task state before relying on it.
- `verified-coder.md` — optional capability evidence; verify availability at
  use time.

## Canonical system guidance

- `/app/agents/may/AGENTS.md` — May's always-loaded deputy contract.
- `/app/agents/may/skills/*/SKILL.md` — May-local reusable judgment.
- `/app/shared/skills/*/SKILL.md` — shared reusable judgment.
- `/app/projects/may-agent.app/docs/2a-design/system-model.md` — compact system
  model.
- `/app/projects/may-agent.app/docs/2a-design/task-resource-engine.md` — task
  resource and reconciliation contract.

The filesystem skill catalog is authoritative. Do not maintain a second skill
registry here. Do not store task queues, current priorities, task state,
session instructions, or incident history in this index.
