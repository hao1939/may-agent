# Proposal: Tighten evaluator-aftermath forbidden-path classification

**Date:** 2026-05-11
**Author:** arc
**Priority:** P1
**Related:** KE-944, dev/workspace/investigations/2026-05-09-evaluator-forbidden-path-false-positive.md
**Implementation owner:** evaluator workflow owner (dev available as reviewer)
**Implementation file:** `agents/evaluator/workflows/evaluator-aftermath.ts`

## Problem (one paragraph)

`evaluator-aftermath.ts` produces false-positive `constraint violation: edited forbidden path(s)` routing reasons because (a) `forbiddenEditPathsFromTask()` extracts paths from any line containing the substring "do not" / "cannot" / "must not" / etc., even when those words are part of operator instructions unrelated to file edits, and (b) `editedForbiddenPaths()` detects "edits" with `\b(M|A|AM|MM)\s+[^\n]*<path>` which matches arbitrary English prose (any sentence starting with a capitalised "Audited", "Manual", "A ", etc.). Together they manufacture the signal from agents that only *read* the path. Evidence: `s_1778490258109_24` (may heartbeat, 2026-05-11) and `s_1778318889307_18` (2026-05-09, different surface). Two recurrences ≥2 days apart across two distinct trigger surfaces ⇒ bug, not noise.

## Bounded fix

### 1. Narrow `forbiddenEditPathsFromTask()`

Only extract paths from lines that begin with an explicit constraint marker. Replace the current "any line containing forbidden/cannot/do not/…" gate with:

- Line starts with (after optional list bullet `-`/`*`/`1.`) one of: `Forbidden:`, `Do not edit`, `Do NOT edit`, `Cannot edit`, `Must not edit`, `Never edit`, `No edits to`.
- Or the line is part of a clearly-delimited "Forbidden paths" / "You CANNOT edit" list block.

Sentences like "Do NOT take destructive actions" or "Do not investigate inline" must **not** promote anything path-shaped on the same line to forbidden status.

### 2. Tighten `editedForbiddenPaths()` git-status detection

Replace
```
\b(?:M|A|AM|MM)\s+[^\n]*${escaped}(?:\s|$)
```
with a strict line-start match against the literal `git status --short` shape:
```js
new RegExp(`^[ MADRCU?!][ MADRCU?!]?\\s+${escaped}(?:\\s|$)`, "m")
```
(or equivalent). Anchored to start-of-line, multiline mode, two-column status code. Prose like "Audited metric-alerts.md" will no longer match. The explicit JSON tool-call detection block above this regex already covers actual write/edit paths and should remain.

### 3. Regression test

In `agents/shared/tests/evaluator-aftermath.test.ts`, add a test using the **literal** may-heartbeat task text from `s_1778490258109_24` (or an equivalent fixture containing the line "follow agents/shared/may-agent-docs/manual/metric-alerts.md. Do NOT take destructive actions") with an ownText that mentions `metric-alerts.md` in prose but contains no edit/write tool call on it. Assert: `transcriptIssues()` emits **no** "edited forbidden path(s)" issue.

Keep existing positive tests for true violations (`STATUS.md`, `NEXT.md`, `project.md`, `journal.md`) so the classifier still catches real edits.

## Validation

- All existing `evaluator-aftermath.test.ts` tests pass.
- New regression test passes.
- 24h after deploy: zero aftermath routes citing `agents/shared/may-agent-docs/manual/metric-alerts.md` (or any other operator-doc path) as a forbidden-edit violation; true violations against `project.md`/`journal.md`/`STATUS.md`/`NEXT.md` continue to route correctly.

## Why P1

Not P0 (no destructive consequence; aftermath review reverses the bad route within minutes). But:

- Every false `needs_triage` route consumes an evaluator follow-up review session.
- The signal trains agents and humans to distrust the routing layer, which is load-bearing for hygiene metrics.
- The bug now has two confirmed surfaces and a clear recurrence pattern.
- The fix is small, scoped to one file plus one test.

## Out of scope

- Re-evaluating the underlying may session itself (already done — evaluator routed it as `needs_improvement` for unrelated workflow-drift reasons, independent of the false forbidden-path signal).
- Restructuring how forbidden paths are declared in task prompts. The fix lives in the consumer (aftermath classifier), not the producers.
