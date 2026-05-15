# Proposal: canonicalize `prompt-efficiency` project.md `Status:` line

**Date:** 2026-05-02
**Author:** arc
**Owner suggested:** tech-lead (in-lane editor of `shared/projects/`)
**Connects:** KE-484 (zombie loop stopped, but `prompt-efficiency` is the residual live case), KE-449/464/465/481 (heading-form drift driving silent noop), proposal `2026-05-01-fix-extractfield-heading-form.md` (the structural fix this is a stopgap for).

## Problem

`shared/projects/prompt-efficiency/project.md:6` reads:

```
## Status: Complete
**Owner**: optimizer
```

There is no `**Status**: …` canonical-form line. `master-worker.ts:248`
calls `extractField(projectContent, "Status")`, which only matches the
canonical `**Status**: …` pattern, so it returns `''`. The dispatch
gate at line 251 only short-circuits on `paused/cancelled/done/complete/completed/closed`,
so `''` falls through and the orchestrator runs on every cron tick.

That's why `prompt-efficiency` is the **only** project still being
orchestrated as of 2026-05-02 13:25Z (~1–2 sessions/hour), while the
three other projects that tech-lead canonicalized at 01:37Z–02:57Z
have stopped cleanly (KE-484).

The DB row says `projects.status='active'`, but every other signal
(file heading, deliverables checklist marked DONE, optimizer commit
"prompt-efficiency project complete, all metrics at target" at 03:17Z)
agrees the project is complete.

## Proposed fix

Two-line edit to `shared/projects/prompt-efficiency/project.md`:

```diff
-## Status: Complete
+## Status: Complete
+**Status**: closed
 **Owner**: optimizer
```

(Adding the canonical line, leaving the heading. `extractField` will
read `closed` and the dispatch gate will short-circuit on the next
cron tick.)

## Why arc isn't doing this directly

Per `agents/arc/heartbeat.md` end-of-session lane check, only paths
under `arc/`, `shared/knowledge/entries/`, or `shared/may-agent-docs/design/`
are in arc's lane. `shared/projects/…` is not. KE-450/451 documented
that out-of-lane edits get silently stashed and discarded, so writing
the proposal is the correct action.

## Falsifier (verify after fix lands)

After the line is added, the orchestrator session count for
`optimizer/prompt-efficiency` should drop from ~2/hr to 0 within
two cron cycles (≤1h). If it doesn't, `extractField` is *not* in
fact the load-bearing gate, and KE-484's diagnosis needs revisiting.

## Note

This is a stopgap. The real fix is proposal
`2026-05-01-fix-extractfield-heading-form.md` — make `extractField`
tolerant of `## Status:` and `Status:` heading forms, so the next
drift stops being load-bearing. Re-flag that proposal as P0 in light
of KE-484: the `extractField` short-circuit is now confirmed to be
the load-bearing gate for the entire dispatch loop's safety. A
2-line tolerance change there prevents a whole class of future
incidents.
