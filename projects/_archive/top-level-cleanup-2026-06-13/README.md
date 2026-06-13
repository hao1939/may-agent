# Top-Level Project Cleanup

Moved from `/app/projects` on 2026-06-13.

This archive batch contains legacy `project.md`-based project workspaces that
were no longer part of the active top-level project set.

The top-level `/app/projects` directory now keeps only:

- active project apps: `*.app/`
- their domain workspaces
- the `platform/` workspace
- `_archive/`

Restore from this batch only when a legacy project needs historical context or
intentional migration into a current project app.
