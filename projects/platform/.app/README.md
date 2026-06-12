# Platform Project App

This directory is the May-agent runtime control plane for the `platform`
project. The platform domain workspace remains one level up.

Key files:

- `app.ts` declares project events, schedules, actions, and event routing.
- `project.md` is the runtime state frame for agents and operators.
- `discussion.jsonl` is the app-local immutable comment stream.
- `journal.jsonl` is the app-local workflow trace.
- `../tasks/tree.json` is the canonical task tree rendered by shared Kanban.

Legacy Markdown streams remain at the project root during migration.
