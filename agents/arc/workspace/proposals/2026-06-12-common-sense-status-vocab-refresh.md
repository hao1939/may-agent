# Proposal: Add Missing Project Statuses to common-sense.md

**Date:** 2026-06-12
**Author:** arc
**Supersedes:** 2026-05-02-common-sense-and-projects-md-status-vocabulary.md (never queued; references stale `agents/shared/` paths)
**Priority:** P1
**Approver:** May or Hao (common-sense.md is human-controlled)

## Problem

`shared/common-sense.md` (lines 14–19) lists five project statuses:

```
- `active` = concrete next action ready NOW
- `paused` = waiting, with explicit resume trigger
- `blocked` = needs external help
- `pending-review` = needs human approval
- `done` = finished
```

This omits the two most-used terminal/suspended statuses in the real system:

| Status | Projects using it | In common-sense.md? | In projects.md design doc? |
|--------|-------------------|---------------------|---------------------------|
| `closed` | **35** | ❌ No | ✅ Yes (line 137) |
| `waiting` | **3** | ❌ No | ✅ Yes (line 137) |
| `archived` | 3 | ❌ No | ❌ No |
| `done` | 6 | ✅ Yes | ✅ Yes |
| `paused` | 1 | ✅ Yes | ✅ Yes |
| `active` | 0 (all current active projects are in-flight) | ✅ Yes | ✅ Yes |
| `pending-review` | **0** | ✅ Yes | ✅ Yes |

`closed` is the dominant terminal status (35/48 projects = 73%) and is not documented in the doc every agent reads at session start. `waiting` is the standard suspended-with-resume-trigger status (3 projects including arc's ruflo-learning-loop) and is also missing.

## Evidence

```sql
-- Verified 2026-06-12 ~20:50Z
SELECT status, COUNT(*) FROM projects GROUP BY status ORDER BY COUNT(*) DESC;
-- closed: 35, done: 6, archived: 3, waiting: 3, paused: 1
```

The design doc at `shared/may-agent-docs/2a-design/projects.md` line 137 already lists the correct full vocabulary: `active, waiting, blocked, pending-review, paused, done, closed`.

## Proposed Change

Replace lines 14–19 of `shared/common-sense.md`:

```markdown
**Project status must match reality:**
- `active` = concrete next action ready NOW
- `waiting` = suspended, with explicit resume trigger
- `paused` = temporarily stopped by owner
- `blocked` = needs external help
- `pending-review` = needs human approval
- `done` = goal achieved
- `closed` = resolved (done, superseded, or rejected)
```

This matches the design doc vocabulary and DB reality. The only addition beyond the design doc would be `archived` (3 projects), which I omit because it's not in the design doc either — it may be a legacy status.

## Risk

Zero — this is documentation alignment. No code or runtime behavior changes.

## History

This issue was first identified in KE-478/479 on 2026-05-02. A comprehensive proposal was written (`2026-05-02-common-sense-and-projects-md-status-vocabulary.md`) but never added to the work queue and referenced pre-migration `agents/shared/` paths. This refreshed version addresses only common-sense.md since projects.md already has the correct vocabulary.
