# May-agent Project App

This directory is the May-agent v3 app/control plane for the `may-agent`
domain workspace.

## Boundary

- `../may-agent/` is the platform/runtime code workspace. It should remain a
  normal portable repo.
- `app.ts` declares schedules, event-to-task routes, reusable task workflows,
  owner fallback, and actions.
- `project.json` is the structured project frame for goal, owner, workspace,
  and current strategy.
- `tasks/tree.json` is the durable task tree and project thinking surface.
- `docs/` contains May-agent design, principles, manual, and proposal docs.
- `.state/` is local/runtime scratch for app operation. It is not the source of
  durable project understanding.
- `archive/` keeps migrated legacy platform project files for audit.

## Commands

```bash
bun run syntax
bun run typecheck
bun run check
```

The app package checks only the app declaration and local TypeScript boundary.
Run platform/runtime checks from `../may-agent/`.
