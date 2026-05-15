# Red Metric Analysis — 2026-05-04

## project.active-count: 0 (target 3)

**Root cause (KE-744)**: `git update-index --assume-unchanged` was set on 21 project files on 2026-04-29, causing edits to be silently lost.

**Current status**: FIX CONFIRMED APPLIED. `git ls-files -v | grep '^[a-z]'` returns 0 results.

**Why metric is still red**: All projects are genuinely archived/done. No new projects have been created. This requires Hao to assign new work — not a technical fix.

## project.blocked-over-6h: 2 (target 0)

Stale DB entries from the drift period. No active projects exist on disk to be blocked.

## Recommendation

No destructive action needed. Awaiting new project assignments from Hao.
