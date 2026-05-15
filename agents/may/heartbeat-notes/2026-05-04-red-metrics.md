# Red Metric Analysis — 2026-05-04

## project.active-count = 0 (target 3)
- **Root cause (KE-744)**: assume-unchanged flags were set on project files
- **Current status**: Flags already cleared (`git ls-files -v | grep '^h '` returns empty)
- **Actual state**: There are genuinely 0 active projects — this is not data corruption
- **Action**: Escalated to Hao for direction

## project.blocked-over-6h = 2 (target 0)
- Likely stale DB entries referencing projects that no longer exist on disk
- No blocked project.md files found in non-archived directories
- **Action**: Escalated to Hao for direction
