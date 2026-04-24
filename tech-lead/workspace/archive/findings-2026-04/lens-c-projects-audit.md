# Lens C — Dead Weight Audit: tech-lead/workspace/projects/

**Date**: 2026-04-18
**Scope**: 6 project files in `agents/tech-lead/workspace/projects/`
**Method**: read-only — grep for Status headers, inspect mtime, cross-check disposition.

## Summary

**All 6 files are in terminal state** (cancelled / complete / done). Zero active projects.
The `projects/` directory is currently 100% dead weight. Recommend creating `projects/archive/` and moving all 6 files there in one sweep.

mtimes are not discriminating — all files stamp `2026-04-17 04:45:43` (uniform checkout time), so disposition is driven entirely by the in-file Status markers, which are explicit and unambiguous.

## Per-File Findings

| File | Status Header | Evidence (path:line) | Disposition |
|------|---------------|----------------------|-------------|
| `auto-resume.md` | cancelled (Hao directive 2026-04-16) | `projects/auto-resume.md:3` — "**Status**: cancelled (Hao directive 2026-04-16: no auto-resume of any kind)" | **ARCHIVE** |
| `cold-start-fix.md` | Complete | `projects/cold-start-fix.md:6` — "**Status:** Complete"; `projects/cold-start-fix.md:53` — "All 4 milestones checked, status is Complete." | **ARCHIVE** (already flagged in task description) |
| `context-management.md` | complete | `projects/context-management.md:5` — "**Status:** complete"; `projects/context-management.md:65` — "**Status**: This concern is resolved." | **ARCHIVE** |
| `fix-verify-wrap.md` | done | `projects/fix-verify-wrap.md:3` — "**Status**: done"; `projects/fix-verify-wrap.md:45` — "**DONE** — Fix deployed on main (commit fa5d279d)" | **ARCHIVE** |
| `metric-system-phase1.md` | ✅ complete (2026-04-15) | `projects/metric-system-phase1.md:3` — "**Status:** ✅ complete (2026-04-15)" | **ARCHIVE** |
| `verification-streamline.md` | Complete | `projects/verification-streamline.md:6` — "**Status:** Complete"; milestones at `:16-20` all show "Done (commit ...)" | **ARCHIVE** |

## Recommendation

**Action**: `mkdir -p agents/tech-lead/workspace/projects/archive/ && git mv agents/tech-lead/workspace/projects/{auto-resume,cold-start-fix,context-management,fix-verify-wrap,metric-system-phase1,verification-streamline}.md agents/tech-lead/workspace/projects/archive/`

**Rationale**:
- ARCHIVE (not DELETE): these files contain commit refs (e.g. `fa5d279d`, `34e27864`, `4cee1ca8`) and rationale that may be useful when revisiting decisions. Delete loses audit trail; archive preserves it while clearing the active working set.
- None qualifies for KEEP+ADD-STATUS — all already have explicit Status headers.
- After archival, `projects/` will contain only `.gitkeep`, which correctly signals "no active projects" and makes future Lens C audits trivial.

## Severity

**Low.** Dead project files are inert — they don't run code or consume runtime resources. Cost is purely cognitive: noise when the tech-lead agent scans `projects/` looking for active work. Cleanup is a one-shot `git mv`.

## Follow-up (separate session)

A coder/tech-lead follow-up session should execute the `git mv` sweep above. No code changes, no tests needed — just a move + commit on a review branch.
