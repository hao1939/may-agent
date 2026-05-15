# C1.1 Coder Regression Analysis: Edit Without Prior Read

**Date**: 2026-04-16
**Convention**: C1.1 — Must read a file before editing it
**Current rate**: 83.4% (161/193 checks passed) — target is ~90%+

## Trend

All 193 checks lack proper timestamps (stored as epoch ms, grouped as single null day), so day-over-day trend is unavailable. The 83.4% rate represents the aggregate across all recorded sessions.

## Violation Pattern

Every single C1.1 failure follows the **same pattern**: coder edits gym scenario source files (`.js`) without reading them first. The violated files are:

- `src/penalties.js`, `src/grades.js`, `src/homework.js`, `src/pipeline.js`, `src/config.js`, `src/stats.js`, `src/product-search.js`

These are all **multi-file bug-fix scenarios** (cascading-fix-trap, sql-injection) where coder receives error context and jumps straight to editing the suspected file without reading it first.

**Root cause**: In fix tasks, coder infers what the file looks like from error messages/test output and edits directly. This works often (edit() fails gracefully on mismatch) but violates the convention.

## Existing Skills

| Skill | Addresses C1.1? |
|---|---|
| `verify-after-edit.md` | No — covers C1.3 (verify AFTER edit), not read BEFORE edit |
| `structured-plan-writing.md` | Mentions "read-before-write is always a dependency" as side note — not actionable |
| `efficient-file-reading.md` | About efficient reading, not about when to read |
| `context.md` | No mention of C1.1 or read-before-edit |

**No skill currently targets C1.1.** The gap is clear.

## Recommendation

**Create a minimal process skill** for coder: `read-before-edit.md`. One rule, no checklist.

Per KE-018, an alternative is adding to `context.md` (environmental nudge = equally effective). Given that coder already has 4 skills and this is a simple behavioral rule, **context.md injection is the lighter-weight option** and should be tried first.

### Proposed context.md addition:
```
- **C1.1 Rule**: Always `read()` a file before `edit()`-ing it — even if you think you know the contents from error output. No exceptions.
```

### Why not a full skill file?
1. KE-018: environmental nudges match text skills for behavioral change
2. The rule is one sentence — a full skill file adds overhead without added clarity
3. Coder already has 4 skills; adding a 5th increases context load

### If context.md nudge fails (re-measure after 1 day):
Escalate to a dedicated `read-before-edit.md` skill with a worked example showing the anti-pattern (jumping from error output to edit) vs correct pattern (read file → confirm state → edit).
