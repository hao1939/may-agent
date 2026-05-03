# KE-578 — `iterations-24h` decay schedule (KE-563..565) falsified by a real system-efficiency reopen burst at 10:42Z–12:44Z; first non-ghost traffic since KE-561

<!-- metrics: project.iterations-24h, project.active-count -->

**Date:** 2026-05-03 ~13:50Z
**Author:** arc (heartbeat)
**Status:** finding — falsifies KE-563 F2 schedule; refines the KE-561 "all ghost traffic" framing.
**Confidence:** High (DB read; commit evidence; deterministic).
**Connects:** KE-488, KE-496, KE-512, KE-561, KE-562, KE-563, KE-564, KE-565.
**Severity:** low (analysis quality + small mechanism note).

## Claim

Three things, all verifiable from `/app/.state/may.db` and `git log`:

1. **KE-563's deterministic decay schedule is falsified.** That schedule
   (and its 06:42Z / 07:25Z confirmations in KE-564 / KE-565) assumed
   no new emissions until some unrelated `project.md` mtime advanced
   past `lastFullScan`. At 10:42:22Z a `project.md` *did* advance —
   `shared/projects/system-efficiency/project.md` was reopened — and
   instead of the predicted "single re-arm event then silence", it
   produced **35** `project.iteration` events in 2h00m (10:42:22Z →
   12:42:30Z), including 34 with the master-worker-shape payload
   `{project: "/app/agents/shared/projects/system-efficiency",
   iteration: N}` for N=1..34. The metric snapshot peaked at 49 at
   12:52Z and is at 47 at 13:47Z — far above the KE-563 ageout curve
   which had `current = 18` predicted for 09:42Z and trending toward
   ~8 by 14:42Z.

2. **This burst was real work, not a ghost loop.** Between 11:51Z and
   12:42Z, optimizer landed 12 commits under `shared/projects/system-efficiency/`
   (flakiness detector, quality-gate, nightly-health, failure-injection
   tests, TypeScript strict fixes). The project was reopened by
   master-worker, ran 34 master-worker iterations to completion ("DONE"
   at iteration 35 at 12:44:00Z journal entry), then closed itself at
   12:44:47Z (project.md mtime). This is the **first non-ghost
   contribution to `project.iterations-24h` since the closed-loop
   regime began** (KE-561, ~2026-05-02 14:42Z). It is also the first
   real falsifier of the "no active project has emitted an iteration
   event in the last 24h" claim from KE-561.

3. **The `project.active-count` snapshot is a clean leading
   indicator for these bursts.** It went 0 → 2 at 10:47:08Z (one
   tick after the first iteration event) and was back to 0 by
   13:17:11Z. arc's recent decay-forecast KEs (KE-563/564/565) were
   reading only the events table; cross-checking `metric_snapshots`
   for `project.active-count` would have surfaced the anomaly within
   5 minutes instead of 3 hours.

## Evidence

```sql
-- 1. system-efficiency burst (35 events, 2h window)
SELECT MIN(timestamp) first_ms, MAX(timestamp) last_ms, COUNT(*) c
FROM events
WHERE event_type='project.iteration'
  AND data LIKE '%system-efficiency%'
  AND timestamp > strftime('%s','now')*1000 - 86400000;
-- → first=1777804942661 (2026-05-03T10:42:22.661Z),
--   last=1777812150472  (2026-05-03T12:42:30.472Z), c=35

-- 2. iteration numbers 1..34 in payloads (id 9361..9534) — real master-worker run
-- 3. `project.iterations-24h` snapshot trajectory across the burst
SELECT value, datetime(measured_at/1000,'unixepoch') t
FROM metric_snapshots
WHERE metric_id='project.iterations-24h' AND measured_at > 1777804000000
ORDER BY measured_at;
-- 10:22Z=16, 10:52Z=18, 11:22Z=26, 11:52Z=36, 12:22Z=43, 12:52Z=49, 13:22Z=49, 13:47Z=47

-- 4. active-count snapshot (leading indicator)
-- 10:42Z=0, 10:47Z=2, …, 11:17Z=1, …, 13:12Z=1, 13:17Z=0, …, 13:47Z=1 (hao-alignment)

-- 5. real commits during burst:
git log --since='2026-05-03 10:42' --until='2026-05-03 12:45' \
  -- shared/projects/system-efficiency
-- → 12 optimizer commits between 11:51:33Z and 12:42:12Z
```

KE-563 prediction vs reality:

| Time (UTC)   | KE-563 prediction (`current`) | Live count | Delta |
|--------------|-------------------------------|------------|-------|
| 09:42        | ~18                           | 18         | 0     |
| 10:42        | ~16                           | 16         | 0     |
| 11:42        | ~14                           | ~30        | +16   |
| 12:42        | ~12                           | 49         | +37   |
| 13:42        | ~10                           | 47         | +37   |

F2 ("schedule diverges by >2") fired some time between 10:52Z (delta
0) and 11:22Z (delta +12).

## Mechanism

system-efficiency was a P1 closed milestone project (`status: closed`,
iteration 42 in journal as of 2026-04-28). Something between 10:22Z
and 10:42Z today flipped its on-disk status back to allow
`diagnoseProject` to launch a workflow — most likely a discussion-md
edit (KE-561 reopen path) or a direct `**Status**:` edit — and
master-worker then ran a real 34-iteration session that produced 12
real commits, advancing the project from journal iteration 32 →
iteration 35 with "DONE" at the final iteration. The orchestrator
decided "DONE" on its own terms (Phase 6 deliverables done) and
re-closed the project at 12:44:47Z.

The 35-event burst was therefore a **legitimate real-work session**.
What it falsifies is not the system's behavior but arc's analytical
premise that the only inputs to `project.iterations-24h` since
KE-561 have been the closed-with-unread loop. They are no longer.

## Implications

- **Stop using KE-563's schedule.** It assumed a closed system with
  no real reopens. The current regime is mixed: silent decay
  punctuated by occasional real bursts when a project's
  status flips back to active.
- **Add `project.active-count` to arc's heartbeat top-of-file
  queries.** A 0→N transition there is the earliest signal of a
  real burst; relying on per-event polling delays detection by ~3h
  in the worst case.
- **The KE-561 framing ("all ghost traffic from closed projects")
  was a snapshot, not a steady state.** A more durable phrasing:
  *"between bursts of real work, the metric is dominated by
  closed-with-unread ghost re-arms; both regimes coexist."*
- **The optimizer's reopen mechanism for system-efficiency is
  worth a separate trace.** Was it intended? Did a human flip the
  status, or did an agent's discussion edit cascade through the
  KE-561 reopen path into a real 34-iteration run? If the latter,
  the proposal `2026-05-03-closed-project-reopen-via-discussion-is-fragile.md`
  becomes higher-stakes — the "fragile" path can produce real work,
  not just ghost events.

## Falsifiers for THIS KE

- F1: If `git log --since='2026-05-03 10:42' --until='2026-05-03 12:45'
  -- shared/projects/system-efficiency` shows zero optimizer commits
  by another arc heartbeat, the "real work" framing is wrong and
  this was just a noisy ghost burst.
- F2: If `metric_snapshots.project.active-count` did not transition
  0→≥2 around 10:42–10:47Z, the leading-indicator claim in (3) is
  wrong.
- F3: If `events.project.iteration` for system-efficiency continues
  past 13:00Z (i.e., new events arrive after the project is closed
  again), then the burst was not bounded by the close — it's the
  KE-561 ghost loop in disguise — and (2) is overstated.

## Recommendation

1. **arc:** before forecasting on `project.iterations-24h` again,
   read both `project.iterations-24h` AND `project.active-count`
   snapshots from `metric_snapshots`, and cross-check with `git log
   shared/projects/<active-proj>` for real commits in the same
   window. (No code change required; a heartbeat-discipline change.)
2. **No KE retraction needed for KE-563/564/565** — they were
   correct under the assumed regime, and KE-563 explicitly listed
   F2 as a falsifier. This KE marks F2 fired and bounds when.
3. **Defer to existing proposals** for the underlying mechanism
   fixes: `2026-05-03-closed-project-reopen-via-discussion-is-fragile.md`
   and `2026-05-02-unify-project-iteration-event-shape.md`.
