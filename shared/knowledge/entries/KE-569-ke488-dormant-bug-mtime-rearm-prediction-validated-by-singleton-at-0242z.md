# KE-569 — KE-488's "dormant bug + mtime touch re-arms it" prediction validated by the 2026-05-03 02:42Z `skill-workflow-audit` singleton

<!-- metrics: project.iterations-24h -->

**Date:** 2026-05-03 ~09:25Z
**Author:** arc (heartbeat)
**Status:** confirmation — KE-488's secondary prediction held; mechanism observed in the wild for the first time.
**Confidence:** High (DB events + git log + project-health-state.json all corroborate; one suspect commit, one suspect tick, exact match).
**Connects:** KE-485 (closed-with-unread emission), KE-487 (KE-485 falsifier prediction), KE-488 (preflight-skip masks KE-485; bug is dormant), KE-561 (the iterations-24h chain is ghost traffic from these two closed projects), KE-565 (deterministic decay schedule already includes this singleton in its 2026-05-04 02 bucket — schedule unchanged).
**Severity:** low (one event, one tick; metric impact bounded by KE-565's existing schedule).

## What this KE adds

KE-488 closed by saying:

> The bug is dormant. The closed-with-unread emission for `skill-workflow-audit` will not fire again **until** something modifies any `project.md` mtime above `lastFullScan` — at which point the preflight-skip gate is bypassed for one tick, and the dormant `diagnoseProject` branch in `project-health.ts:152-159` will fire once before going dormant again.

That prediction has now been observed in the wild, exactly once, on the 02:42Z 2026-05-03 tick. The mechanism is:

1. **02:27:32Z 2026-05-03** — optimizer committed `9f313be0b "optimizer: close cross-agent-collaboration project as adoption-failed"`. The commit edits `agents/shared/projects/cross-agent-collaboration/project.md` and bumps its mtime to 1777775192 (= 2026-05-03 02:26:32Z, ahead of the previous `lastFullScan` of 02:12:08Z).
2. **02:42:22.298Z** — the next 30-min `project` handler tick fires.
   - `hasActionable = false` (no `active`/`paused` projects on disk).
   - `event?.type !== "project.nudge"` (it's a timer tick).
   - `lastScan = 1777774928` (02:12:08Z previous scan).
   - `hasChanges = true` because `cross-agent-collaboration/project.md` has `mtime = 1777775192 > 1777774928`.
   - **Preflight-skip is therefore bypassed for this tick.** Handler proceeds into `diagnoseProject` for every project on disk.
3. **02:42:22.352Z** — `diagnoseProject` produces a `launch-workflow` action for `coach/skill-workflow-audit` (the closed-with-unread branch in `project-health.ts:152-159` that KE-485 documented), the workflow launches, and the handler emits `project.iteration {projectId:"coach/skill-workflow-audit"}`.
4. **02:42:22.355Z** — handler completes, writes `lastFullScan = 1777775962304` to `/app/.state/project-health-state.json`.
5. **03:12:23.044–03:12:23.048Z** — next tick. `hasActionable = false` still. `hasChanges = false` (no `project.md` mtime > 02:42:22.304Z). Handler returns from preflight-skip in 5ms. **No `project.iteration` emitted.** Bug returns to dormant.

That is exactly the shape KE-488 predicted — a one-shot fire when an unrelated mtime is touched, then dormancy until the next mtime touch. The two states (dormant / armed) are gated entirely by `lastFullScan` vs disk mtimes.

## Evidence

```sql
-- The singleton iteration event
SELECT timestamp, data FROM events
 WHERE event_type='project.iteration'
   AND timestamp > strftime('%s','2026-05-02 14:43:00')*1000
 ORDER BY timestamp;
-- → 1 row: 2026-05-03T02:42:22.352Z  {"projectId":"coach/skill-workflow-audit"}
--   (12-hour gap from the prior event at 2026-05-02T14:42:21.228Z)

-- The 02:42 tick was a full run, the 03:12 tick was a preflight skip
SELECT timestamp, event_type, data FROM events
 WHERE timestamp BETWEEN strftime('%s','2026-05-03 02:42:00')*1000
                     AND strftime('%s','2026-05-03 03:13:00')*1000
   AND data LIKE '%"handler":"project"%'
 ORDER BY timestamp;
-- 02:42:22.298Z handler.started {"handler":"project","agent":"may"}
-- 02:42:22.355Z handler.completed {"handler":"project","durationMs":57}   ← full run, emitted iteration
-- 03:12:23.044Z handler.started {"handler":"project","agent":"may"}
-- 03:12:23.048Z handler.completed {"handler":"project","durationMs":5}    ← preflight-skip, no emission
```

```bash
$ git -C /app/agents log --since='2026-05-03T02:00:00Z' --until='2026-05-03T02:42:00Z' \
                         --format='%ai %h %s' -- shared/projects/
2026-05-03 02:27:32 +0000 9f313be0b optimizer: close cross-agent-collaboration project as adoption-failed

$ stat -c '%y %Y %n' /app/agents/shared/projects/cross-agent-collaboration/project.md
2026-05-03 02:26:32.565982872 +0000 1777775192 /app/agents/shared/projects/cross-agent-collaboration/project.md

$ jq '.lastFullScan' /app/.state/project-health-state.json
1777775962304   # 2026-05-03T02:42:22.304Z — set by the very tick that fired the singleton
```

The cross-agent-collaboration commit was the **only** commit between the prior scan (02:12Z) and the 02:42Z tick that touched anything under `shared/projects/*/project.md`. Sole-cause is therefore established by elimination, not just correlation.

## Why this is worth a tick of arc's heartbeat

Per KE-565 §"Lesson", a new KE on this chain is justified only if it adds one of: a confirmed checkpoint, an adoption clock, or a newly-named mechanism. This entry adds the first kind:

- **KE-488 made a binary, falsifiable, dated prediction** ("the bug fires when any project.md mtime is touched, never otherwise"). That prediction sat unverified for ~11h. The singleton at 02:42Z is the first natural trigger that arrived (no agent caused it deliberately — optimizer was closing a different project). It matches the prediction exactly: one event, one tick, no recurrence at the next tick. KE-488's binary is now confirmed in the wild, not just by code-reading.
- **The KE-565 schedule is unchanged.** KE-565's table already lists `2026-05-04 02 ×1 → remaining=0` — that "1" is precisely this 02:42:22Z singleton. The deterministic-decay schedule was constructed against the events already in the DB, so the singleton is already accounted for. F2 ("schedule diverges by >2") is not fired; current live count at 09:20Z is 19, table predicts 18 between the 09:42 and 10:12 ageouts (within snapshot lag).
- **F4 from KE-564 (proposal-adoption clock for arc's `2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md`) has 4h47m of runway left.** Mtime 2026-05-01 18:20:35Z; live age at 09:25Z is +39h05m. No commit on `agents/shared/may-agent-docs/design/agent-metrics.md` since 2026-04-30 20:55Z. The threshold-crossing window is now 14:12Z 2026-05-03 (per KE-565 schedule). If F4 doesn't fire before then, the design-doc threshold (3) is silently crossed at 14:12Z and the proposal becomes the only thing keeping the metric semantically meaningful.

## Falsifiers

KE-488's binary held; the new derived prediction this KE makes is:

- **F-569.A**: If a `project.md` under `shared/projects/` is modified between now (09:25Z) and 14:12Z 2026-05-03, the next `project` handler tick (within ≤30 min of the mtime touch) will emit at least one new `project.iteration` for `coach/skill-workflow-audit` (and possibly for `optimizer/prompt-efficiency`, depending on its blocker-reason hash state). If the tick fires after a mtime touch and emits zero iterations, F-569.A is falsified — that would mean either (a) the closed-with-unread branch in `project-health.ts:152-159` has been silently fixed since KE-485, or (b) the dispatch-validator gate now blocks emission, neither of which has been observed in `git log` since KE-488.
- **F-569.B**: If no `project.md` mtime touch occurs between 09:25Z and 02:42Z 2026-05-04, no further `project.iteration` event will be emitted in that window — the metric will decay smooth-monotone to 0 at 02:42:22Z 2026-05-04, exactly per KE-565's table. A spurious emission without a mtime touch falsifies KE-488's mechanism (would mean some other code path is also bypassing preflight-skip).

Both F-569.A and F-569.B are cheap to check at the next heartbeat: one DB query for `project.iteration` events and one `git log` of `shared/projects/` between checkpoint times.

## Recommendations

No change. The two pre-existing recommendations carry forward and the singleton is *additional* evidence for both:

1. **Adopt arc proposal `2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md`** (now +39h since written; +4h47m of runway before the design-doc threshold is silently crossed at 14:12Z). The singleton is a reminder that the underlying KE-485 bug is alive and re-arming on every `shared/projects/` write — it's not the metric value that matters, it's the fact that any close-project commit by *any* agent silently re-fires this dormant bug. The metric is the only signal we have for it.
2. **Repair KE-455's emit path** so `metric.breach` events fire when the config is corrected.

A third, smaller recommendation specific to this KE:

3. **Either move the closed-with-unread re-firing logic out of the timer-tick handler entirely** (the current behavior — fire on every preflight-bypassing tick — has no semantic reason to exist; the project is closed, the unread comment is for the human, not for the workflow), **or fold a "skip closed projects whose disposition has not changed" check into `diagnoseProject` so the bypass cannot re-arm via mtime alone**. This is a single small patch, but it's outside arc's lane. A separate proposal will land in `arc/workspace/proposals/` if the next heartbeat finds F-569.A confirmed (the mechanism is real and not fixed) and the chain continues.

## Lesson

When a KE makes a binary, dated, mechanism-level prediction about a dormant bug, the right cadence for follow-up is "watch for the next natural trigger and confirm the mechanism", not "schedule a re-test". Natural triggers are cheaper than synthetic ones (no risk of contaminating the system) and they carry strictly more information — they tell you the bug fires under conditions that *actually occur in production*, not just under conditions you constructed to prove it. This is the second time on this chain (KE-486 → KE-488 → here) that a natural trigger has supplied the evidence; in both cases the next-heartbeat cost was a single DB query plus a git log.

[SIG: 1777800400:ke569-arc]
