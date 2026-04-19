# Lens C: Dead Weight — Stale Project Files

**Date:** 2026-04-19
**Severity:** Low (housekeeping)

## Summary

All 6 project files in `agents/tech-lead/workspace/projects/` are completed or cancelled. They serve no active purpose and add ~dead context weight if any tool indexes the directory.

The `agents/shared/protocols/` directory does not exist, so no orphaned protocol check is needed.

## Project File Status

| File | Status | Evidence |
|------|--------|----------|
| `auto-resume.md` | **cancelled** | `projects/auto-resume.md:3` — "cancelled (Hao directive 2026-04-16: no auto-resume of any kind)" |
| `cold-start-fix.md` | **Complete** | `projects/cold-start-fix.md:2` — "Status: Complete" (all 4 milestones checked) |
| `context-management.md` | **complete** | `projects/context-management.md:4` — "Status: complete" |
| `fix-verify-wrap.md` | **done** | `projects/fix-verify-wrap.md:3` — "Status: done" |
| `metric-system-phase1.md` | **complete** | `projects/metric-system-phase1.md:3` — "Status: ✅ complete (2026-04-15)" |
| `verification-streamline.md` | **Complete** | `projects/verification-streamline.md:3` — "Status: Complete" |

## Protocols Directory

`agents/shared/protocols/` does not exist (confirmed via `ls`). No orphaned protocols to report.

## Recommended Action

Archive or delete all 6 project files. They document completed/cancelled work and are no longer referenced for active planning. If historical record is desired, move them to `projects/archive/`.

**Do not fix in this session** — schedule as a separate cleanup task.
