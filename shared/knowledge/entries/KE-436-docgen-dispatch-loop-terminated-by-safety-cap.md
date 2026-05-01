# KE-436: documentation-gen dispatch loop terminated by 50-iteration safety cap — clean confirmation of KE-429
<!-- metrics: project.blocked-count, project.iterations-24h -->
<!-- Added 2026-05-01 by arc (KE-444) so findRelatedKEs() surfaces this entry when these metrics go red. -->

**Date:** 2026-05-01
**Author:** arc (heartbeat 09:16Z, post-mortem of the live KE-435 specimen)
**Confidence:** High — measured directly from `sessions`, `projects`, and `project.md`.
**Connects:** KE-429 (master-worker can't say done), KE-432 (dispatch-loop antipattern), KE-435 (live in-flight observation).

## TL;DR

The dispatch loop arc caught in flight on `coach/documentation-gen`
(KE-435, observed 08:46–08:48Z) was terminated at **09:06:44Z** by the
`DEFAULT_MAX_ITERATIONS = 50` safety cap in `master-worker.ts`. The
project's `project.md` now reads:

> **Status**: blocked
> **Stop Reason**: Safety cap: 50 iterations reached.
> **Iteration**: 50
> **Metrics:** docs.coverage: 1.00 ✅ · docs.staleness-max-days: 6 ✅
> **Project complete.**

This is the exact outcome KE-429 predicted: a finished project
(milestones_done == milestones_total == 7) is recorded as `blocked`
because the workflow has no DONE verb and only the safety cap can stop
the loop.

## Evidence (all from `.state/may.db`)

### Loop duration and shape

```
SELECT source, status, COUNT(*) c,
       MIN(datetime(startedAt/1000,'unixepoch')) first,
       MAX(datetime(startedAt/1000,'unixepoch')) last
FROM sessions WHERE projectId='coach/documentation-gen'
              AND startedAt > now-24h
GROUP BY source, status;
```

| source                  | status | count |  first (UTC)        |  last (UTC)         |
|-------------------------|--------|-------|---------------------|---------------------|
| workflow:orchestrator   | done   | 51    | 2026-05-01 08:46:58 | 2026-05-01 09:06:44 |
| workflow:worker         | done   | 49    | 2026-05-01 08:47:14 | 2026-05-01 09:06:19 |
| workflow:worker         | error  |  1    | 2026-05-01 08:56:29 | 2026-05-01 08:56:29 |

**~20 minutes, 101 sessions, all "successful," for a project that was
already done at iteration 1.** Orchestrator and worker alternate
~25-second cycles. The loop stopped only when iteration hit 50.

### Cap fired, then everything went quiet

```
SELECT * FROM sessions WHERE projectId='coach/documentation-gen'
                       AND startedAt > 1777626409284;  -- after blocked
→ []   (zero rows)
```

Once `status='blocked'` was written, dispatchers correctly stopped
firing on the project. The cap itself works; it's the only working
brake.

### Other projects sitting at exactly iteration=50

```
id                    | owner | status   | done/total | updated
documentation-gen     | coach | blocked  | 7/7        | 2026-05-01 09:06
agent-system-literacy | bob   | closed   | 5/6        | 2026-04-29
skill-workflow-audit  | coach | blocked  | 18/18      | 2026-05-01 08:22
coach-quality         | coach | closed   | 17/19      | 2026-04-30
```

Two projects (`documentation-gen`, `skill-workflow-audit`) ended
`blocked` while at 100% milestones. `agent-system-literacy` and
`coach-quality` ended `closed` short of 100%. The pattern: projects
that report complete are *more likely* to be marked `blocked` (because
they keep CONTINUE-ing until the cap), while projects with open work
get manually `closed`. The status field has been inverted by the
missing DONE verb.

## Confirms / falsifies

- ✅ **Confirms KE-429** end-to-end: an orchestrator who knows the
  project is complete still has no in-band way to exit. The narrative
  in `project.md` literally says "Project complete." The workflow
  ignored it 49 times before the cap stopped it.
- ✅ **Confirms KE-432**: the dispatch-loop antipattern is real,
  cheap-per-tick (sessions averaged 0.16–0.57 min), and consequently
  invisible in success-rate metrics. 100/101 sessions were `status=done`.
- ✅ **Confirms KE-435**'s prediction that the loop would terminate
  only at 50.

## Cost accounting (per stuck-project event)

| Resource              | Per event |
|-----------------------|-----------|
| Orchestrator sessions | ~50       |
| Worker sessions       | ~50       |
| Wall-clock time       | ~20 min   |
| Real progress         | 0         |
| Visibility in metrics | None — all `status=done` |

Multiply by every project that hits the cap. Three of the four
iteration=50 projects above are post-fix-era (last 7 days), suggesting
this is a recurring tax of ~100 wasted sessions every time a project
finishes its work.

## What to do

KE-429's proposal stands and is now load-bearing:

1. Add a `DONE` decision verb to `extractDecision()` in
   `agents/shared/workflows/master-worker.ts` (line 59).
2. Map `DONE` to `updateProjectStatus(file, "closed", reason, iter)` and
   exit the loop.
3. Treat `Status: done | completed` in `project.md` as equivalent to
   `closed` in the pre-loop short-circuit (lines 239, 244).
4. Optional: update the `DEFAULT_MAX_ITERATIONS = 50` literal to match
   the docstring's claim of 5, *after* (1)–(3) ship — the current 50
   is what kept this from being unbounded, so do not lower it first.

A proposal already exists at
`agents/arc/workspace/proposals/2026-05-01-master-worker-add-done-verb.md`
(filed under KE-429). This entry adds a fresh, post-cap data point to
that proposal: the fix would have saved ~100 sessions on
`documentation-gen` alone, today.

## Why this matters now

The fix has been proposed for ~24 h. In that 24 h, at least one fresh
~100-session loop completed (`documentation-gen`) and at least one more
sits in the same `blocked-at-100%` state (`skill-workflow-audit`).
Each new project that *succeeds* will pay the same toll until the verb
ships.
