# KE-449: A *third* fall-through path — `## Status: Active` (heading form) makes `extractField` return "" and bypasses every entry guard; `prompt-efficiency` ran hourly at :47 for 7+ hours
<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-01 ~16:55Z
**Author:** arc (heartbeat session, ~1h after KE-448)
**Confidence:** Very high — direct file read + 7 distinct workflow-run JSONs at :47 ±1min for 7 consecutive hours (10:47Z → 16:47Z), all `status:"error"`, all on the same `project.md`.
**Connects:** KE-447, KE-448 (parents — same dispatch-loop family but different fall-through mechanism), KE-432, KE-437, KE-438, KE-439.

## TL;DR

KE-447/448 documented that the **field-form** `**Status**: blocked` falls through master-worker.ts:240/245 because `blocked` isn't in the short-circuit set. This entry adds a *separate* fall-through path on the same code:

If `project.md` declares status with a markdown **heading** (`## Status: Active`) instead of a field (`**Status**: active`), `extractField()` in `project-helpers.ts:6` returns `""`. Empty string isn't in the guard set either, so the workflow enters the work loop unconditionally — once per hour at :47, the cron tick that runs project dispatch.

`prompt-efficiency` had the heading form. Result:

```
2026-05-01 10:47:14 — iter 1 — "No output files produced (1 consecutive failures)"
2026-05-01 11:47:13 — iter 1 — same
2026-05-01 12:47:15 — iter 1 — same
2026-05-01 13:47:13 — iter 1 — same
2026-05-01 14:47:16 — iter 1 — same
2026-05-01 15:47:14 — iter 1 — same
2026-05-01 16:47:14 — iter 1 — same
```

Seven workflow-runs (`/app/.state/workflow-runs/mon*.json`), all `status:"error"`,
each ~40 s long, each producing one `[STARTED]` worker session that emits zero
files because the worker's first prompt arrives with an empty task string and
the workflow errors before review. The journal accumulates blank
`**Worker**:` headers indefinitely.

This is *cheaper* than the system-efficiency cap loop (KE-447/448 did 50 iters in
~50 min) but *more durable*: it never hits the 50-iter cap, so it never writes
`Status: blocked`, so there's no header to clobber and nothing to escalate. It
just leaks one error/hour silently until somebody looks.

## Why this is a third path, not a duplicate

| KE | Mechanism | Where it leaks |
|----|-----------|----------------|
| KE-432/437/438/439 | `complete`/`done`/`finished` — body says done, status says active | line-630 `updateProjectStatus(..., "active", ...)` overwrites any external close |
| KE-446/447/448 | `blocked` (workflow's own cap output) is not a short-circuit value, so a fresh dispatch reads it then line 630 reopens it as `active` iter 1 | same line-630 clobber |
| **KE-449 (this)** | **Heading form** `## Status: Active` → `extractField` returns `""` → none of `paused`/`cancelled`/`closed` matches, so the work loop runs | `extractField`'s regex is field-only; doc templates use heading form |

The first two require the work-loop to *advance* (write Status, then get clobbered).
This one requires the work-loop only to *enter* (heading is invisible to the
guard from cycle 1). The fix surface is therefore in `extractField` /
`project-helpers.ts`, not in master-worker.ts:240–245 alone.

## Stop-the-bleed applied

Edited `agents/shared/projects/prompt-efficiency/project.md`:

- Replaced `## Status: Active` → `**Status**: closed` (field form)
- Added `**Stop Reason**` and `**Iteration**: 0`
- HTML comment pinning the constraint to KE-449

Falsifier check across all projects: `for f in agents/shared/projects/*/project.md; do grep -L '^\*\*Status\*\*' "$f"; done` — empty. Currently no other heading-form offenders. So the immediate bleed is closed, and any future template-style project will also fall through unless `extractField` is extended.

## Recommended fixes (for human / dev / coach)

1. **Cheap and durable**: Extend `extractField` (or add a sibling helper) to also match `^##\s*${field}:\s*(.+)$` so heading form ≡ field form. One regex addition in `project-helpers.ts`.
2. **Defensive**: When `status === ""`, `master-worker.ts:240` should `ctx.escalate("Project has no Status field — refusing to dispatch")` instead of falling through to the work loop. An empty status should never mean "go".
3. **Template lint**: A pre-commit or `arc audit` check that every `agents/shared/projects/*/project.md` matches `/^\*\*Status\*\*:\s*(active|paused|cancelled|closed|blocked|waiting)/m`. Three of these four KE families are about projects whose status string isn't what the workflow thinks it is.

I'm not landing any of these in this heartbeat — the master-worker.ts mtime is still 2026-05-01 09:02:34 (per KE-447/448), nobody has touched it, and arc's lane is observation + KE + stop-the-bleed, not code patching of the dispatch loop.

## Falsifier

If a fresh dispatch arrives at the next :47 mark and `prompt-efficiency` does
**not** appear in `events.project.iteration` (because `Status: closed` should
trigger the line-245 short-circuit on the closed-with-no-unread-comments path),
then this fix held. If it does appear, the line-630 clobber from KE-446 is
*also* eating field-form closes here (which would unify KE-449 with the KE-446
family rather than being a separate path). I'll check on next heartbeat.

## Connects

- KE-447, KE-448: parent observations (cap-not-durable, falsifier-positive). This is the same family of "guard set is incomplete" bugs but caught from a new angle: the *parser*, not the *guard*.
- KE-444: blocked-count metric is red but no prior art was injectable — these KE-44x entries are the prior art that should now be linked from `findRelatedKEs()` for `project.iterations-24h` and `project.stale-active-count`. (Front-matter metrics tag added above for that.)
- KE-432: original dispatch-loop antipattern.

## Evidence pointers

- `/app/.state/workflow-runs/mon{ul6zf782pmu5y,sg0mn48lcck12,wqcaa3py3nqr8,yvijjey4knmwn,10o9envjw6c0a,2397ir1gumlbe,35uzz6ixkw0xt,5b0vy79mmqr1m}.json` — 8 hourly error runs.
- `/app/agents/shared/projects/prompt-efficiency/journal.md` (last 60 lines) — seven `## Iteration 1` entries with empty `**Worker**:` body.
- `/app/agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/iter-1-*.json` — 7 incomplete iter-1 checkpoints (one per hour).
- `/app/agents/shared/workflows/project-helpers.ts:6-9` — `extractField` regex (field-only).
- `/app/agents/shared/workflows/master-worker.ts:237,240,245` — entry guards reading the empty `status`.
