# Host Operations App (`may-agent`)

This directory contains the ordinary App that owns operation of the May Host.
Its human name is **Host Operations App**. Its stable technical App ID remains
`may-agent` so retained Task identities do not change.

## Boundary

- `../may-agent/` is the platform/runtime code workspace. It should remain a
  normal portable repo.
- `app.ts` is the single canonical Host Operations App manifest: addressed
  input, event schedules, task subscriptions, actions, and task policy.
- `../may.app/app.ts` is the separate May App (`appId: may`): it owns human
  Conversation Tasks, answers directly, or requests typed work from the
  responsible App.
- `project.json` is the structured project frame for goal, owner, workspace,
  and current strategy.
- Host Task resources are the sole mutable work authority. Retained
  `.state/tasks/state.json` and `.state/tasks/tree.json` files are migration
  evidence or generated projections, never runnable authority.
- `tasks/seed.json` is used only to initialize an empty runtime state.
- `docs/` contains May-agent design, principles, manual, and proposal docs.
- `.state/` contains local runtime state. Durable understanding belongs in
  project metadata, design, workflows, receipts, and domain evidence.
- `archive/` keeps migrated legacy platform project files for audit.

## Commands

```bash
bun run syntax
bun run typecheck
bun run check
```

The app package checks only the app declaration and local TypeScript boundary.
Run platform/runtime checks from `../may-agent/`.
