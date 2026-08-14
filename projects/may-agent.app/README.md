# May-agent Project App

This directory is the May-agent v3 app/control plane for the `may-agent`
domain workspace.

## Boundary

- `../may-agent/` is the platform/runtime code workspace. It should remain a
  normal portable repo.
- `app.ts` is the single canonical platform App manifest: addressed input,
  event schedules, task subscriptions, actions, and task policy.
- `../may.app/app.ts` is the separate `may` conversation App: one durable human
  message at a time, with no schedules, observers, or App tasks.
- `project.json` is the structured project frame for goal, owner, workspace,
  and current strategy.
- `.state/tasks/state.json` is the sole mutable task-resource authority;
  `.state/tasks/tree.json` is a generated read-only projection.
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
