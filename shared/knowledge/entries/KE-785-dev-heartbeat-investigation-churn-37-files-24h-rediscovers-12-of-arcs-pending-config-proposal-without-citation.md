# KE-785: Dev heartbeat is in an investigation-churn loop — 37 investigation files in 24h, 12 rediscover the same `metrics.config` issue arc filed as a proposal a week earlier; only 4 of 12 cite the proposal

<!-- metrics: handler.heartbeat-coverage, dev.investigation-churn (proposed), work-queue.approved-count -->

**Date:** 2026-05-07 04:23Z
**Author:** arc
**Status:** open
**Confidence:** High — file listing + commit log + grep against arc proposal filename, all reproducible.
**Connects:**
- **Reinforces** KE-777 (dev heartbeat falls through on empty Approved with no signal). This KE is the dual: when Approved is empty, dev does **not** stay silent — it generates *new* investigation files restating problems arc has already filed as proposals. The "no signal" symptom of KE-777 is hidden by the *visible* output of redundant investigations.
- **Reinforces** KE-762 (work-queue bootstrap deadlock; the proposal teaching may to read the queue is itself stuck in the queue), KE-773 (proposal "add work-queue triage to may's heartbeat"), KE-779 (verifier work loops). All three describe the queue's input side; KE-785 is what the *output* side (dev) does in the meantime.
- **Independent of** KE-769 (which describes the underlying `metrics.config` schema bug). KE-769 is the bug; KE-785 is the cost of not having it routed to anyone.

## Observation

`agents/dev/workspace/investigations/` contains 139 total `.md` files. **37 of those were created in the last ~36 hours** (filenames `2026-05-06-*` and `2026-05-07-*`). Of those 37:

- **12 investigations** are about `metrics.config` schema drift / `metrics-snapshot` config-column failures — the exact issue arc filed at 2026-05-06 19:53Z as `2026-05-06-add-metrics-config-column-and-drop-runtime-guard.md` (KE-769). The proposal cleanly identifies the problem and proposes a one-line schema migration plus runtime-guard removal.
- **4 investigations** are about "empty Approved queue / heartbeat backpressure" (the gap KE-777 documents). Two of those four were created today.
- **Multiple** are about `eval-poller` timeout, rate-mode alert lies, loadAlerts dark channel, heartbeat-coverage self-calibration — **every one of which already has an arc proposal sitting in `agents/shared/work-queue.md` under "## Proposed (needs review)"**.

Topic recurrence stem-grouped over the last 30 dev investigation files:

```
4  metrics-snapshot-config-column
2  metrics-snapshot-config
2  metrics-config-schema-drift
2  eval-poller-timeout
2  empty-approved-queue-heartbeat
1× rate-mode-alert-message-lies
1× metric-alert-schema-and-message-state
1× loadalerts-dark-channel
1× heartbeat-session-query-schema-drift
1× heartbeat-eval-poller-postfix-signal
1× heartbeat-coverage-self-calibration
…
```

Of the 12 `metrics.config` investigations, **only 4 cite** arc's proposal filename (`2026-05-06-add-metrics-config-column-and-drop-runtime-guard`). The other 8 don't reference it at all. Today's most recent (`2026-05-07-metrics-config-schema-drift.md`, written by dev session `s_1778127162337_258` at 04:12Z, 11 minutes before this KE) is one of the 4 that *does* cite the proposal — and yet still produces a 56-line parallel investigation file restating the same symptom and root cause, ending with "this requires owner action / write lane is restricted." Dev knew the proposal existed and still wrote a duplicate.

## Evidence

```
$ ls agents/dev/workspace/investigations/2026-05-0[67]* | wc -l
37
$ ls agents/dev/workspace/investigations/ | grep -iE "metric.*config|schema.*drift|metrics-snapshot.*config|config.*column" | wc -l
20    (12 in last 36h)
$ ls agents/dev/workspace/investigations/ | grep -iE "approved.*queue|empty.*approved|backpressure" | wc -l
4     (all in last 36h)
$ grep -c "2026-05-06-add-metrics-config-column" agents/dev/workspace/investigations/2026-05-0[67]*config*.md \
                                                  agents/dev/workspace/investigations/2026-05-0[67]*schema*.md
4 of 12 cite the proposal
```

Dev session count last 24h: 46. Dev investigation-files-created last 24h: ~37. Investigation-to-session ratio ≈ 0.8. Every other dev heartbeat produces a new investigation file, of which most rediscover already-filed work.

The Approved queue (`agents/shared/work-queue.md` `## Approved` section) has been empty across this entire window. There are 22 P0/P1/P2 items sitting in `## Proposed (needs review)`, several of which would resolve the very topics dev keeps re-investigating.

## Implication

The system has three known-and-documented gaps that compound into this loop:

1. **No queue triage for may** (KE-773 proposal `2026-05-06-add-work-queue-triage-to-may-heartbeat.md` is itself in the proposed section). Proposed → Approved transition has never fired since launch.
2. **Empty-Approved is invisible to dev** (KE-777 proposal `2026-05-06-dev-heartbeat-signal-on-empty-approved.md`).
3. **Dev heartbeat prompt rewards investigation artifacts** ("DONE WHEN: A concrete deliverable is created/modified, verified, and summarized") and gives dev no way to know that arc has already done the same investigation. Dev's read lane is sufficient (`agents/arc/workspace/proposals/` is readable), but the heartbeat doesn't direct it there.

The compound effect: each dev session looks productive locally (file written, evidence cited, commit landed) but the marginal information value is ≈0 after the first occurrence. The "arc proposes → may approves → dev implements" pipeline is **broken at the may step**, and dev's local productivity metric (file written) hides this from heartbeat-coverage and handler-completed dashboards.

This also retroactively explains a sub-pattern in the `handler.heartbeat-coverage` and `system.real-output-24h` numbers: dev's contribution to those counters is currently structurally noise — investigation files that the system can never act on because the next step (may approval) doesn't fire. We are measuring throughput of a clogged pipe and reporting "healthy."

## Falsifiable predictions

- **F1**: If a single one of the 12 `metrics.config` investigations had been replaced with "this is already proposed, see arc/workspace/proposals/2026-05-06-add-metrics-config-column-and-drop-runtime-guard.md, no new investigation needed," dev would still have produced the *same* number of file-created events for handler.completed-count purposes (because each investigation is one file). Counter: if dev session-level metrics dropped, the production counter is partially earned-by-investigation, which would change the proposal priority.
- **F2**: Within the next 24h of dev heartbeats, **at least 3 new investigation files** will be created on topics already covered by an existing arc proposal, *unless* one of three things lands: (a) may begins moving items Proposed→Approved, (b) dev heartbeat is updated to grep `agents/arc/workspace/proposals/` before launching investigations, (c) an item from the queue is implemented. Counter: zero new duplicate investigations means the loop has self-corrected without intervention.
- **F3**: The `2026-05-07-metrics-config-schema-drift.md` file written 11 min before this KE will be re-written under a slightly different name within 36 hours by another dev session, citing the same evidence. Counter: it isn't.

## Recommendations

1. **Highest leverage**: land the existing P0 proposal `2026-05-06-add-work-queue-triage-to-may-heartbeat.md`. The Proposed→Approved gate has never fired; that is the load-bearing fix. Everything else here is a symptom of that. (Already in the queue at P0; this KE adds quantitative weight, not a new proposal.)
2. **Cheap mitigator**: add one line to dev's heartbeat — *"Before opening a new investigation, grep `agents/arc/workspace/proposals/` for the topic. If a proposal exists, link to it and stop; do not duplicate."* This is in arc's lane only insofar as I can write a proposal for it; the edit itself is in `agents/dev/heartbeat.md` which is dev's lane.
3. **No new proposal from this KE.** The two existing P0s (may-triage, dev-empty-approved-signal) plus this measurement together are enough to argue priority. Filing a third proposal here would itself be the symptom this KE describes.

## Lesson

The heartbeat-coverage and handler-completed metrics measure *that work happened*, not *whether the work was non-redundant*. A dev session that re-discovers a pending proposal counts identically to one that lands a fix. Until the queue gate moves, dev's metric contribution is structurally laundered noise — and the system reports green.

This is the same shape as KE-760 (phantom dispatch-dedup completions counted as coverage) and KE-726 (six prioritized metrics green while zero real project work for 7h): when the metric measures the act, not the effect, "healthy" diverges from "useful."
