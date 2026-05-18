# Bug E + F: Multi-line stop_reason truncation and Current State overwrite

**Date:** 2026-05-18
**Status:** ✅ Fixed
**Owner:** platform

## Background

These were carried over from earlier platform work as "separate, larger"
issues deferred behind the `shared/workflows` dissolution refactor.
With that refactor complete, both bugs are now in scope.

## Bug E — `stop_reason` truncated on round-trip

**Symptom:** Multi-line `stop_reason` or `resume_condition` frontmatter
values silently lose all but the first line on the next workflow
write-back, because `parseProjectMeta` was line-based and
`formatProjectMeta` always emitted bare `key: value`.

**Fix:** `packages/sdk/src/project-schema.ts` now encodes any value
needing escapes as a double-quoted YAML flow scalar with JS-style
`\n`, `\t`, `\\`, `\"` escapes, and decodes the same on parse. Bare
scalars are still used for simple values to keep on-disk files clean
and back-compatible.

**Triggers quoted form:** `\n`, `\r`, `\t`, `"`, `\`, leading/trailing
whitespace, `:` followed by space (which would otherwise split into a
new field), or values starting with `# & * ! % @ \` > | [ { ' "`.

**Test:** `packages/sdk/src/project-schema.test.ts` (8 cases).

**Commit:** `repos/may-agent eae76999` — `fix(sdk/project-schema):
preserve multi-line stop_reason on round-trip (Bug E)`

## Bug F — `## Current State` body overwritten by stop-line

**Symptom:** Every terminal decision (WAITING, BLOCKED, PAUSED,
worker-failed-2x, stuck-5-iterations) called
`updateSection(..., "Current State", "<one-sentence status>")`, which
replaced the entire body. Reviewer- and agent-authored narrative was
silently erased on every stop.

**Fix:** New `setStatusFooter(content, heading, footerLine)` helper
in `projects/platform/workflows/platform-iteration.ts` prepends a
single `**Status:** <line>` marker to the section, preserving the
body. A subsequent call replaces the marker line in-place rather
than stacking.

**Call sites converted from `updateSection` → `setStatusFooter`:**

| Site | Trigger |
|------|---------|
| line 856 | waiting-overridden by open work |
| line 911 | `handleWaitingDecision` |
| line 935 | `handleBlockedDecision` |
| line 1199 | comment-driven CONTINUE w/o `CURRENT_STATE_UPDATE` |
| line 1221 | worker failed twice consecutively |
| line 1330 | 5 consecutive iterations without progress |
| line 1339 | normal iteration narrative refresh w/o directive |
| line 1340 | max-iterations cap |

**Sites intentionally left as `updateSection`:**

| Site | Reason |
|------|---------|
| line 1029 | `applyReviewerProjectDirectives` with explicit `CURRENT_STATE_UPDATE` |
| line 1347 | normal iteration with reviewer-provided `CURRENT_STATE_UPDATE` |

Both are explicit reviewer-directive paths where overwriting is the
documented intent.

**Test:** `projects/platform/workflows/project-iteration.test.ts`
(3 new cases in `setStatusFooter (Bug F regression)`).

**Commit:** `/app 5bd4bf4a5` — `fix(platform-iteration): preserve
Current State narrative on stops (Bug F)`

## Forward concern

`platform-iteration.ts` is now the canonical fork. The other 12
project workflow forks (created by Phase 5b/6) still carry the
**old** unconditional-overwrite behaviour. Per the "copy not share"
principle, that's expected — each project may diverge from platform
as it sees fit. But for newly-spawned projects we may want
`scripts/seeds/project-iteration-seed.ts` to be re-snapshotted from
the fixed platform copy so new forks inherit the fix.

**Decision pending:** refresh the seed now, or wait until a project
hits the bug to motivate the change? Defaulting to "wait" — the seed
remains the pre-fix snapshot so divergence is *visible* per project.

If a project owner wants the fix, they can:

```
diff projects/platform/workflows/platform-iteration.ts \
     projects/<id>/workflows/<id>-iteration.ts
```

and cherry-pick the `setStatusFooter` helper plus the call-site
conversions.
