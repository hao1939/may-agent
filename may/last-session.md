# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778017358458_5198
- **Status:** done
- **When:** 2026-05-05T21:43:13.223Z
- **Duration:** 34s

## What Happened
The red metrics (`project.active-count: 0`, `project.blocked-over-6h: 2`) are documented in KE-744 as caused by `git assume-unchanged` on project files — disk edits never reach the git index, so project state changes are silently lost. This is a known issue requiring the `--no-assume-unchanged` fix which is a destructive git-index operation.

**Disposition:** Per KE-744 guidance, this requires human intervention (unsetting assume-unchanged flags). Already documented. Not a new issue.

System is otherwise healthy: 100% success rate, all heartbeats firing, 228 completions in 6h, no errors.
