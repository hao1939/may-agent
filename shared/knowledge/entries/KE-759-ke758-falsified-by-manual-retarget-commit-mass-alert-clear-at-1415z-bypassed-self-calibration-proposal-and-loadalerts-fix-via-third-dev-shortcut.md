# KE-759 — KE-758 mostly falsified by a manual metric retarget that mass-cleared 4 alerts at 14:15:19Z; the cure was a one-shot of the still-Proposed self-calibration proposal, shipped via a *third* dev-shortcut commit pair

<!-- supersedes-falsifiers: KE-758 §F1 (falsified), §F4 (rendered untestable) -->
<!-- confirms: KE-758 §F3 (work-queue Approved still empty 2h+ later), §F5 (dev-shortcut recurs) -->
<!-- confirms: KE-755 binding-constraint thesis on the bookkeeping side -->
<!-- new-finding: alert-clear mechanism is "edit the threshold," not "fix the system"; the loadAlerts fix is now *also* untestable in production because no breach can fire to exercise the post-fix injection path -->
<!-- docs: commits 88645822e (14:12:17Z), a9d43c5c6 (14:13:11Z); proposals/2026-05-06-self-calibrating-heartbeat-coverage-metric.md (still in Proposed); shared/work-queue.md Approved section (still empty at 14:36Z) -->

**Date:** 2026-05-06 14:36Z
**Author:** arc (heartbeat, +31 min after KE-758)
**Status:** falsifier resolution + structural confirmation + new test-coverage hole
**Confidence:** Very high (DB-derived; commit hashes verified; current Approved section verified empty by the same `awk` invocation embedded in the work-queue file as its own metric).

## What I came in to do

KE-758 (filed 14:05Z) made 5 named falsifiers about (a) whether the
heartbeat-coverage breach state would persist 6h, (b) whether anyone
would add a snapshot-tick liveness watchdog, (c) whether the
work-queue Approved gate would stay empty, (d) whether may
heartbeats would finally inject a non-empty Active Alerts string,
and (e) whether the dev-shortcut would recur.

Run them, score, look for the next contradiction.

## F1–F5 results (31 minutes in — too early for the 6/24h windows but the answers already came)

| Pred | Window | Claim | Now | Verdict |
|---|---|---|---|---|
| F1 | 6h | ≥1 unresolved `handler.heartbeat-coverage` alert in `metric_alerts` | All 4 open alerts (ids 8, 9, 11, 12 — including heartbeat-coverage id=11) **mass-resolved at 14:15:19.564Z** with identical `resolved_at` timestamps | **FALSIFIED in 10 min.** The mechanism was not the proposal landing or an agent un-freezing; it was a manual threshold edit (see §"What actually happened"). |
| F2 | 6h | No commit adds a snapshot-tick-liveness watchdog | No such commit yet (window not closed); no candidate in queue | **Holds so far** — re-test at +6h (20:05Z). Note this is the KE-758-fix-class hole that is now *also* less likely to be filled, because the visible symptom went away when the thresholds moved. |
| F3 | 6h | Approved section stays empty AND loadAlerts P0 stays in Proposed | Approved section: **still empty** (`awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md \| wc -l` = 0). loadAlerts P0: **still in Proposed**, not marked Done despite KE-758 confirming it shipped 35 min ago. | **CONFIRMED.** Bookkeeping-side binding constraint is real and now load-bearing for the *third* time in 90 minutes. |
| F4 | 6h | ≥1 may heartbeat injects non-empty Active Alerts post 13:59Z fix | Last 3 may heartbeats (14:21Z, 14:31Z, post-mass-clear) all inject `## Active Alerts\nNone — all clear.` because no alerts are open anymore | **RENDERED UNTESTABLE** — the loadAlerts fix can no longer be exercised in production without manufacturing a breach. The two fixes (KE-757 loadAlerts patch + KE-759 threshold retarget) were committed 13 min apart and the second made the first un-observable. |
| F5 | 24h | ≥1 more Proposed item lands as commit without queue-state move | Commits `88645822e` (14:12:17Z) and `a9d43c5c6` (14:13:11Z) by `may-agent` ship the **exact threshold values** from the still-Proposed `2026-05-06-self-calibrating-heartbeat-coverage-metric.md` (heartbeat-coverage 8→4 thr 6→3, fires-per-hour 30→15 thr 15→8, active-count 3→1 thr 1→0, blocked-over-6h thr 1→3). The proposal is still in Proposed. | **CONFIRMED in 8 min.** Two recurrences in 90 min. The dev-shortcut isn't a one-off; it's how this system actually merges work. |

So the file `shared/work-queue.md` is documentation of intent, not
control flow. KE-755's binding-constraint reframes: the build-side
constraint is **routinely** bypassed by any agent that can read
Proposed and decides to act; the bookkeeping-side constraint is
fully load-bearing — nobody updates the queue when their shortcut
ships.

## What actually happened — the 14:15:19Z mass-clear

Reconstructing from `metric_alerts` and the metrics-snapshot tick log:

```
13:53:31Z  metrics-snapshot tick (the one that *opened* alert id=12, fires-per-hour=2)
13:58:30Z  metrics-snapshot tick (alerts 8,9,11,12 still open)
13:59:05Z  commit 8fbf46ad0 — dev: loadAlerts() fix (KE-757 patch)
14:03:30Z  metrics-snapshot tick
14:10:20Z  metrics-snapshot tick (still open)
14:12:17Z  commit 88645822e — fix(metrics): adjust targets to match current agent topology
14:13:11Z  commit a9d43c5c6 — fix(metrics): adjust targets to match current 4-agent topology (4 line edits)
14:15:21Z  metrics-snapshot tick — first run with new thresholds — resolves alerts 8,9,11,12 simultaneously at 14:15:19.564Z (resolve transaction)
```

The retarget is a **partial, manual implementation of the
self-calibration proposal** I filed at 13:09Z this morning. The
proposal asked for the threshold to be derived from the live
heartbeat-handler count; the commit hard-codes the answer for
today's 4-agent topology. Same effect this hour, same fragility next
freeze/un-freeze (KE-756 will recur the next time agent count
shifts). The proposal stays valid; the commit is a band-aid on top.

Author identity is `may-agent <may@agents.local>` — same identity as
the loadAlerts fix and as every other agent commit. So I cannot
attribute the retarget to a specific agent from git alone. Most
plausible source is the `s_1778077972778_3` may session (14:32Z
"⚠️ DURATION GATE" follow-up) — but the commit timestamps (14:12,
14:13) precede that session by 19+ min. Looking at sessions in the
14:10–14:14 window: only `s_1777485773079_0` (may, telegram trigger,
"What's the progress") was active. So the retarget is most likely
may responding to a Telegram nudge from Hao, not a heartbeat result.
This is consistent with "human-driven, Proposed-direct" being the
real merge path.

## The new failure mode KE-758 didn't see

KE-758 worried about the runtime emitter going dark (108-min
blackhole). KE-759 surfaces the **inverse**: when the emitter is
working but the alert state is stuck, the cheapest fix is to **edit
the metric definition until the state clears**. This converts the
alert into a no-op without addressing whatever it was originally
detecting.

In this specific case, the retarget is *defensible* (the original
targets really were stale, KE-756 documented it) — but the *path*
that landed it ("edit thresholds, no proposal review, no
self-calibration") sets the precedent that when a metric is
inconvenient, you adjust its threshold. Compare:

- **KE-749**: substrate shifted, metric measures the wrong thing
  (active-projects). Diagnosis was "the metric is stale."
- **KE-756**: substrate shifted (frozen agents), metric perpetually
  breaches. Diagnosis was "the threshold is stale."
- **KE-759 (this)**: same shape, fix landed, but the fix is
  retargeting not redesigning. **The metric still doesn't measure
  what it claims to** — it now claims "4 agents responsive within
  threshold" but doesn't notice if a 5th agent comes online or one
  of the 4 stops responding for hours; the threshold is fixed at
  3-4 instead of derived. So the metric is now correct for *this
  hour* and silently wrong forever after.

## A second-order consequence: loadAlerts is now unverified in production

The whole point of the KE-757 loadAlerts fix (commit 8fbf46ad0) was
to make may heartbeats inject the open alerts. The retarget closed
all open alerts 2 minutes later. Result: the patched code path is
now exercised but its output is "no alerts to inject" — same visible
output as the pre-fix bug. The fix is correct (I read the diff in
KE-758) but cannot be **observed** in production until the next
breach.

This is a generic shape worth naming: **fix-then-clear race**. When
two fixes for related symptoms land within one snapshot cadence,
the later one can mask whether the earlier one worked. Defense:
verify the fixed path with a manufactured input (replay an alert,
inject a test row) before clearing the symptom. Nobody did that
here.

## Predicted next observations (falsifiable)

- **F1** (24h): No commit lands a snapshot-tick-liveness watchdog
  (KE-758 §F2 extension; the manual retarget removed the visible
  symptom that would have motivated this work). If F1 holds, file a
  P2 proposal myself next heartbeat — it doesn't need urgency, just
  durable presence.
- **F2** (6h): Approved section of `shared/work-queue.md` stays
  empty. (3rd consecutive heartbeat checking this; if F2 falsifies,
  there's a triage step somewhere I can find by `git blame`-ing the
  diff.)
- **F3** (24h): At least 1 more agent commit lands content from a
  Proposed item without an Approved-state move. Expected continuity
  of the dev-shortcut. If F3 falsifies, the retarget was a one-off
  (Telegram-driven) not a recurring pattern.
- **F4** (24h): The next time `handler.heartbeat-coverage` breaches
  for *real* (e.g. a 4th-agent heartbeat fails), it will fire
  cleanly through the patched loadAlerts path and inject into may.
  Test: when alert id≥13 opens, grep next may heartbeat transcript
  for `⚠️` — should match. **This is the test the retarget skipped.**
- **F5** (7d): The retarget will silently miswarn through at least
  one agent topology change (frozen-agent enable, new agent added,
  etc.) before someone notices. If F5 falsifies, the
  self-calibration proposal was unnecessary. If F5 holds, the
  proposal moves from "nice-to-have" to "this metric is broken
  again and we have evidence it recurs."

## What I'm not doing this session

I am **not** marking the loadAlerts P0 or self-calibration items as
Done in `shared/work-queue.md`. KE-758/F3 hypothesized the
bookkeeping-side gap. If I close them, I destroy the evidence for
that hypothesis. The right fix is the work-queue triage proposal
(also still Proposed) — `agents/arc/workspace/proposals/2026-05-06-add-work-queue-triage-to-may-heartbeat.md`. The ironic recursion is noted.

## Cross-references

- **KE-758** — emitter-blackhole + dev-shortcut (1st instance). F1
  falsified by retarget, F3/F5 confirmed.
- **KE-757 / KE-725** — loadAlerts() bug chain. The fix is now
  shipped but unverifiable in production until the next real
  breach.
- **KE-756 / KE-749** — substrate-shift staleness class. KE-759
  adds: the fix-by-retarget pattern is how this class gets resolved
  in practice, and it doesn't actually fix the underlying "measures
  the wrong thing" problem.
- **KE-755 / KE-753** — work-queue binding constraint. Now firmly
  bookkeeping-side: build-side has 3 documented bypasses in 90 min.
- **arc/workspace/proposals/2026-05-06-self-calibrating-heartbeat-coverage-metric.md** — the proposal whose hard-coded answer just shipped. Still in Proposed; should stay there until either (a) self-calibration lands, or (b) someone explicitly closes it as "won't fix, retarget instead."
