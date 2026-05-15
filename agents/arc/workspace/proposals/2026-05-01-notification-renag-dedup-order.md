# Proposal: Sender-side notification de-dup ORDER + notification-rate metric

**Date:** 2026-05-01
**Author:** arc
**Status:** open; for may / Hao decision
**Connects:** KE-460 (notification re-nag floods), KE-459 (notifications wake heartbeats out-of-band), KE-456/457 (stampede), KE-441 (KEs don't change behavior on their own).

## Problem

Per KE-460, optimizer sent **14** SOUL-trim notifications to tech-lead in a 3-hour window (19:01–22:02Z on 2026-05-01), all asking for the same task; **6** of them within a 26-min span; **4** marked P0; one explicitly labelled `4th attempt`. Per KE-459, each such notification wakes tech-lead's heartbeat out-of-band, costing an extra opus session. Net effect: ~3 extra tech-lead sessions / ~70 extra opus ops in that window, on top of the documented heartbeat budget.

The cause is structural, not a bug in any one agent:
- Optimizer's heartbeat re-evaluates a lagging metric every 30 min.
- If the metric is still red, ORDER-002 ("actions over words") rewards visible artifacts — sending the notification *is* the artifact.
- Optimizer has no observability into tech-lead's in-progress git work, so "still red" looks identical to "ignored."
- The system has no de-dup or rate limit on `agent.notification`.

Result: a deterministic loop that fires once per heartbeat per still-red metric per recipient, until the metric flips. The flood is redundant 9 times out of 10 (the work is in flight) but bills as compute every time.

## Evidence

- `.state/may.db` `events` table, `event_type='agent.notification' AND source='optimizer' AND owner='tech-lead'`, 19:01–22:02Z 2026-05-01: 14 rows. 11/14 contain "SOUL.md" + "trim"; 10/14 name the same three target files.
- `.state/may.db` `sessions` table, `agent='tech-lead'`, same window: 9 sessions, 156 opCount, 5 at non-cron minutes (xx:20–25, xx:50–55).
- `git log --since='4 hours ago'` in `/app/agents`: optimizer committed `3b763def2 ... close prompt-efficiency project` at 22:48Z — the work was done; the flood at 21:21–21:47 was redundant, not unanswered.
- KE-459 confirms wake-on-notification path is in the `may-agent` runtime (not in `cron.json`).
- KE-460 §3: time-from-edit-to-metric-flip is ≥5–10 min, dwarfed by optimizer's 30-min heartbeat — so re-nagging is the dominant strategy under the current architecture.

## Proposed change

**A. Add ORDER-NEW to `agents/shared/standing-orders.md`:**

> **[ORDER-NEW] Notification de-dup before re-asking (2026-05-XX)**
> Before sending `agent.notification` to the same `owner` about the same task, check the last 60 min of your own emitted notifications (query `events` table, `event_type='agent.notification' AND source=<you>`). If you have already sent the same `(owner, taskHash)` pair in that window, **skip and wait one heartbeat**. Use `taskHash` = first 200 chars of `task` after stripping leading `[P0]/[P1]/[P2]` priority tags.
>
> Rationale: every `agent.notification` whose `data.owner` matches an agent's name wakes that agent's heartbeat out-of-band (KE-459). Re-asks within 60 min are almost always redundant — the recipient is either working on it, has finished and is waiting for the metric to flip, or has explicitly declined. None of those benefits from a repeat. If you genuinely need to escalate, change the priority tier or the owner — both will produce a different `taskHash` and pass the check.
> - **Applies to:** all
> - **Reason:** KE-460 — optimizer sent 14 same-task notifications to tech-lead in 3h, each waking an extra heartbeat. The cost is real and the fix is cheap.

**B. Add a notification-rate metric (owner: may, source: `metrics-snapshot.ts`):**

```
id:        agent.notification-renag-rate
name:      Top (source, owner, taskHash) repeat count (1h)
type:      health
owner:     may
source:    SELECT MAX(c) FROM (SELECT source, owner, substr(json_extract(data,'$.task'),1,200) th, COUNT(*) c FROM events WHERE event_type='agent.notification' AND timestamp > strftime('%s','now')*1000-3600000 GROUP BY source, owner, th)
target:    1
threshold: 3
alert_op:  ">
direction: lower-is-better
```

Anything above 3 of the same (sender, recipient, task) in 1 h is a re-nag flood and should alert. Once (A) lands, this metric becomes the falsifier — if it stays ≤3, agents are following the order; if it spikes, the order is being ignored.

## Expected impact

- **Direct:** in the next prompt-efficiency-style endgame, optimizer (or any other repeat-sender) sends 1 notification per 60-min window per task, not 6. Tech-lead's xx:20–25 / xx:50–55 extras drop from ~3/3h to ~0–1/3h. Stampede pressure at xx:26 / xx:56 reduced (KE-456/457 partially mitigated from the source side).
- **Indirect:** the new metric makes the pathology visible the next time it happens, in any direction — including senders we haven't observed yet. Plus a measurable falsifier for whether the ORDER actually changed behavior (KE-441 risk).
- **Cost:** zero runtime change, one ORDER, one metric definition. Agents already query `events` routinely; the de-dup check is ~3 lines of SQL.

## Risks

- **Genuine urgency suppressed.** If something *is* P0 and *was* sent 30 min ago and nothing happened, the new ORDER blocks the re-ping. Mitigation: the ORDER lets you escalate by raising the priority tag — `[P0]` → `[P0-CRITICAL]` produces a different taskHash. So genuine escalations still get through; only verbatim repeats are blocked.
- **TaskHash brittleness.** If agents include timestamps or counters in the task body ("4th attempt", "as of 21:26Z"), every re-send produces a different hash and the de-dup is bypassed. Mitigation: ORDER text says "first 200 chars after stripping priority tags" — keep boilerplate at the front, dynamic counters at the end. Document this in the ORDER.
- **Race with heartbeat-completion.** An agent that just sent a notification 60 min ago and observes the metric is *still* red after 60 min has a legitimate reason to re-ask. The 60-min window matches the typical metric-flip latency; if 60 min is too short, raise to 120. Either way the cap should be > 1× the recipient's heartbeat interval (30 min) so at least one work-cycle has passed.
- **Doesn't fix the runtime.** KE-459's wake-on-notification path is still hot; even with (A) the *first* notification still wakes the recipient. Receiver-side coalescing (the proposal's not-included Part B) is the proper fix and lives in `may-agent` source. Out of arc's lane; flagged in KE-460 for whoever owns that code.

## Decision needed

Hao or may to choose:
1. Adopt (A) + (B). Recommended.
2. Adopt (A) only. Acceptable if metric tooling is constrained; we lose the falsifier.
3. Adopt (B) only. Not recommended — measures the problem without preventing it; KE-441 risk dominates.
4. Reject and instead push for the runtime fix (KE-459 §receiver-side). Strictly better in theory but lives outside arc's lane and has been pending for two heartbeats.

The cheapest path is (A) — one heading addition to `standing-orders.md`. Even without (B) it should cut the flood roughly 6× based on the 14-vs-3 ratio in the evidence window.
