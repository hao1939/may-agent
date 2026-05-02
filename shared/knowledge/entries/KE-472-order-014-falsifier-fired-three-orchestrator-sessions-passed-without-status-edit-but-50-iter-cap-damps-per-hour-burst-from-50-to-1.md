# KE-472: ORDER-014 falsifier fired — three orchestrator sessions passed without writing `**Status**: closed`, exactly as KE-469 predicted; severity collapsed because the inner 50-iter safety cap holds and the hourly tick now fires only once per hour
<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-02 ~05:20Z
**Author:** arc (heartbeat session, ~2h22m after ORDER-014 land, ~1h45m after KE-469)
**Confidence:** Very high — direct git/DB evidence, three independent orchestrator sessions tested.
**Connects:** KE-469 (parent — predicted this), KE-461, KE-462, KE-465, KE-441, ORDER-014.

## TL;DR

KE-469's falsifier predicted: *"if `prompt-efficiency` is dispatched at any further hourly tick after 2026-05-02 03:17Z (no code or status-field edit in the interim), KE-469's claim that ORDER-014 alone is insufficient is reconfirmed."*

Falsifier resolution as of 2026-05-02 05:20Z:

| Tick | Session | Agent | Status | Edited `**Status**:` field? | Edited DELIVERABLES_CHECKLIST.md? |
|---|---|---|---|---|---|
| 03:17:01Z | `s_1777691821528_3616` | optimizer (orchestrator) | done | **No** | Yes |
| 04:17:01Z | (orchestrator iter, no commit) | optimizer | done | **No** | No |
| 05:17:01Z | `s_1777699021297_3756` | optimizer (orchestrator) | done | **No** | Yes (commit `2165d56c4`, identical message to KE-469's `c758bf7fe`) |

Three for three. ORDER-014 has had three independent opportunities to fire on its named motivating example and has produced zero `**Status**: closed` edits. KE-469's prediction is reconfirmed with N=3 (was N=1 at filing).

But there is a second, surprising signal: **the per-hour iteration count collapsed from ~50/hr to 1/hr.**

```
2026-05-01 21:00     3
2026-05-01 22:00     9
2026-05-01 23:00    67   ← runaway begins (KE-461 close commit window)
2026-05-02 00:00    44
2026-05-02 01:00    59
2026-05-02 02:00    26   ← 50-iter master-worker cap hits, exits
2026-05-02 03:00     1   ← only the hourly tick re-dispatches
2026-05-02 04:00     1
2026-05-02 05:00     1
```

The master-worker safety cap (`MAX_ITERATIONS=50`) is doing exactly the job its docstring claims: stopping the inner loop. It does **not** stop the hourly project tick from re-arming, but it stops the per-tick burst at iteration 50. So the system is no longer hemorrhaging 50 wasted iterations per hour; it is now leaking 1 per hour. ~50× damping, with the same root cause unfixed.

## Evidence

- Git: `2165d56c4 optimizer: prompt-efficiency project complete, all metrics at target` (2026-05-02 05:17:17Z), 1 file +1/-1, *only* `DELIVERABLES_CHECKLIST.md`. Identical message and shape to `c758bf7fe` (the KE-469 motivating commit) — the orchestrator wrote the same text twice in two hours, neither time touching `project.md`.
- DB: `SELECT * FROM events WHERE event_type='project.iteration' AND data LIKE '%prompt-efficiency%' AND timestamp > 1777697866000` returns 3 rows at 03:17, 04:17, 05:17 (UTC). No iterations at any other minute.
- DB: `SELECT * FROM sessions WHERE sessionId='s_1777699021297_3756'` shows `agent=optimizer, source=workflow:orchestrator, opCount=2, dur_s=17.9, status=done`. The orchestrator session did 2 ops, lasted 18 seconds, and committed an unrelated file. This is the cheapest possible "complete-but-don't-close" cycle and it costs about 18 seconds + 1 commit per hour.
- `agents/shared/projects/prompt-efficiency/project.md:6` — still `## Status: Complete` (heading form), unchanged across 9 hourly ticks since KE-461 was filed at 22:48Z 2026-05-01.

## Implication

1. **ORDER-014 is empirically null on its named example.** Three sessions, three failures to comply, identical commit pattern. The order is paper-only as KE-469 predicted (mechanism: standing-orders.md is not loaded into the orchestrator prompt; the prompt enumerates `active|waiting|blocked` and not `closed`). No textual remedy applied at the standing-orders layer can change this.
2. **Severity ≠ frequency. The 50-iter cap is masking the regression.** Anyone reading `project.iterations-24h` from a snapshot taken after 03:00Z will see the metric well within target and will not detect that prompt-efficiency is still dispatching every hour. The cap is doing structural protection that the orchestrator-prompt-fix would otherwise need to do; without the cap, the system would currently be at ~1200+ wasted prompt-efficiency iterations/day. With the cap, it is at ~24 wasted dispatches/day. **Both are wrong; only one is loud.**
3. **The relevant metric is "redundant orchestrator dispatches", not "iterations".** A project that has been `Complete` for 5 hours and gets re-dispatched hourly for 18 seconds of work is a per-hour 0-information event. The `project.iterations-24h` metric, even read as activity, cannot distinguish productive vs. zombie iterations (KE-469 noted this; this entry confirms it operationally). Any "redundant dispatch" metric would need to count: (orchestrator session whose only commit is to a non-status file on a project whose plan items are all `[x]`).
4. **The cap is acting as an unintentional patch for the orchestrator-prompt defect.** This is fragile: if `MAX_ITERATIONS` is ever raised, removed, or per-project overridden, the runaway behaviour returns. The fix targets in KE-461/462/469 (master-worker accept `Complete`, or orchestrator prompt enumerate `closed`) remain the correct durable remediations; the cap should not be relied on as the silent stopgap.

## Recommendation

No new action items beyond KE-469's. Specifically:

- Still arc-lane: this entry, plus continued observation. A second falsifier window (does the loop persist *another* 12 hours unchanged?) is worth recording, but does not require a new KE — just an update to this one if behaviour changes.
- Still may/tech-lead-lane: implement KE-461/462's parser fix **or** master-worker.ts orchestrator prompt enumerate `closed`. Either suffices. The proposal is `2026-05-02-standing-order-orchestrator-edit-status-directly.md` (which the order operationalised but does not enforce); implementing the prompt change is a one-paragraph diff to `master-worker.ts`.
- Still hao-lane: a manual `**Status**: closed` edit on `prompt-efficiency/project.md` will stop the loop today at the cost of one keystroke. The arc lane forbids arc making this edit (project files are outside arc's allowed paths per KE-450/451).

## Falsifier (this entry)

If by 2026-05-03 05:00Z, with no code change to master-worker.ts and no manual status-field edit, **either**:
- (a) `prompt-efficiency` has stopped dispatching (no `project.iteration` events with `prompt-efficiency` payload after 05:17Z), then the system has terminated the loop through some channel arc has not identified — KE-472 is wrong, open follow-up. **Or**
- (b) the per-hour iteration count for `prompt-efficiency` has climbed back above 5/hr without an `MAX_ITERATIONS` config change, then the cap is not the dampener arc claimed — KE-472's mechanism is wrong and warrants reinvestigation.

Otherwise (24h of continued ~1/hr dispatch with `## Status: Complete` unchanged): KE-472 is reconfirmed.

## Connects

- **KE-469** (this entry's parent) — same prediction, smaller N, narrower window. KE-472 increases N from 1 to 3 and adds the cap-damping observation that KE-469 did not yet have evidence for.
- **KE-441 / KE-443** — text knowledge does not change behaviour; standing-orders.md is not an injection channel for orchestrator prompts. KE-472 is more evidence in the same family.
- **KE-461 / KE-462** — heading-form revert and completion-artifact substitution. KE-472 catches the substitution happening *twice more* in the same project after KE-462's filing.
- **KE-465** — `extractDecision` first-word-wins. The 05:17Z orchestrator presumably wrote `CONTINUE\n\nProject is COMPLETE. Stop dispatching.` again (consistent with KE-462's pattern); the dispatcher read `CONTINUE`. Same defect, third firing.
- **KE-452** — "raise targets / measure impact, not activity": `project.iterations-24h` is currently green-and-misleading because the cap absorbs the runaway burst. The metric does not signal what it appears to signal.

## Evidence pointers

- `git -C /app/agents show 2165d56c4` — 05:17:17Z optimizer commit, +1/-1 in DELIVERABLES_CHECKLIST.md only.
- `git -C /app/agents show c758bf7fe` — 03:17:20Z optimizer commit (KE-469's), identical shape and message.
- DB: `SELECT timestamp, data FROM events WHERE event_type='project.iteration' AND data LIKE '%prompt-efficiency%' AND timestamp > 1777697866000` (3 rows, hourly).
- DB: `SELECT sessionId, source, opCount, status FROM sessions WHERE startedAt > 1777697866000 AND task LIKE '%prompt-efficiency%' AND source='workflow:orchestrator'` (multiple orchestrator sessions, all `done` with low opCount, all 17–80s).
- `agents/shared/projects/prompt-efficiency/project.md:6` — `## Status: Complete` (heading form, unchanged since 22:48Z 2026-05-01).
