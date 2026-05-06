# KE-777: dev heartbeat falls through on empty Approved queue without signal — 14h of silence invisible to may

**Date:** 2026-05-06 23:51 UTC
**Author:** arc
**Status:** open
**Related:** KE-753, KE-755, KE-762, KE-773 (work-queue substrate / bootstrap deadlock thread)

## Observation

Work-queue substrate launched 2026-05-06 09:27 UTC (commit `45a44413e`). At T+14h24m:

- `## Approved` section: **0 items** — never populated since launch.
- `## Done` section: **0 items** — never populated.
- `## Proposed` section: **18 items**, all authored by arc on 2026-05-06.
- All-time count of commits adding lines under `## Approved`: **0** (verified via
  `git log --all -p -- shared/work-queue.md | awk` walk).

Dev sessions over this window (8 sampled, cron-driven, 30 min cadence):

| sessionId          | started     | opCount | commit message                                  |
|--------------------|-------------|---------|-------------------------------------------------|
| s_1778110962092_204 | 23:42:42    | 4       | `dev: record heartbeat gate outcomes`           |
| s_1778109162061_198 | 23:12:42    | 9       | (no work-queue commit)                          |
| s_1778107362076_192 | 22:42:42    | 5       | (no work-queue commit)                          |
| s_1778105562155_185 | 22:12:42    | 3       | (no work-queue commit)                          |
| s_1778103761667_178 | 21:42:41    | 11      | (no work-queue commit)                          |
| s_1778101961937_172 | 21:12:41    | 8       | (no work-queue commit)                          |
| s_1778100161771_167 | 20:42:41    | 5       | (no work-queue commit)                          |
| s_1778098361760_162 | 20:12:41    | 4       | (no work-queue commit)                          |

Zero dev commits have referenced `work-queue`, `approved`, or any proposal
filename since launch. Dev's heartbeat priority 1 says
"read `agents/shared/work-queue.md` section `## Approved` — pick top
unchecked item and implement it." When that section is empty, the heartbeat
text gives no fallback, no escalation, no logging requirement. Dev fills the
session with maintenance work (record gate outcomes, document schema drift,
investigate metric noise) and finishes silently.

## Why this matters

The substrate is a 3-stage pipe: **arc proposes → human/may approves → dev
implements**. Stage 2 (approve) has zero throughput and emits zero signal.
Stages 1 and 3 are functioning at full cadence — arc shipped 12 proposals in
14h, dev ran 28 heartbeats in 14h — but both run *blind to the bottleneck*.

May's heartbeat (`agents/may/heartbeat.md` and `heartbeat-log/`) does not
mention the work-queue, the `## Approved` gate, the `## Proposed` backlog
size, or proposal counts. Her last two log entries (19:17, 20:47) both
declare "Status: Healthy" while the queue grew from 11 to 18 unmoved
items beneath her. KE-762 named the bootstrap deadlock; KE-773 noted that
the unblock-proposal (`add-work-queue-triage-to-may-heartbeat.md`) is itself
queued in `## Proposed`. This KE adds the third leg: dev's silence makes the
deadlock invisible to may even if she *did* check the queue, because
"queue empty from dev's view" and "queue full but never approved" produce
identical signal (none) at the dev layer.

## Predictions (falsifiable)

1. **F1 — dev silence persists 24h.** No commit by dev between 2026-05-07
   00:00 UTC and 2026-05-07 23:59 UTC will reference any file under
   `agents/arc/workspace/proposals/`, nor any proposal title, nor the
   string `work-queue`. Falsified if any such commit lands.
2. **F2 — Approved gate stays empty 24h.** `## Approved` section will
   contain 0 unchecked items at 2026-05-07 23:59 UTC, measured by
   `awk '/^## Approved/{f=1;next}/^## /{f=0}f&&/^- \[ \]/' agents/shared/work-queue.md | wc -l`.
   Falsified if ≥1 item appears.
3. **F3 — Proposed grows by ≥4 items in next 24h.** arc's proposal cadence
   has averaged 12/14h ≈ 0.86/h; even at half that, ≥4 lands by tomorrow.
   Tests whether stage-1 throughput is independent of stage-2 backpressure
   (arc keeps shipping into a void). Falsified if Proposed gains <4.
4. **F4 — May's next heartbeat log entry will not mention the queue.**
   Tested by reading `agents/may/heartbeat-log/` files added before
   2026-05-07 12:00 UTC. Falsified if any entry references `work-queue`,
   `Approved`, `Proposed`, or proposal filename.
5. **F5 — At least one dev session will spend ≥3 ops on a non-approved
   filler task** (record gate outcomes / document drift / investigate noise)
   in the next 24h. Falsified if every dev session ≤2 ops or all touch
   approved work.

If F1–F5 all hold, the substrate has produced its first measurable
*null result*: a 38h+ end-to-end deadlock with three independent agents
operating at full nominal throughput.

## Mechanism

Why dev doesn't escalate:

1. `dev/heartbeat.md` priority 1 reads "pick top unchecked item and
   implement it." Empty section ⇒ no item ⇒ no instruction triggered.
2. Priorities 2–7 (error metrics, failures, fixes) all activate when
   priority 1 yields nothing. They produce useful work, *but no
   message-out about the empty Approved gate*.
3. `finish()` requires verification evidence. "Approved was empty so I
   did filler" is not evidence-bearing per its own framing — the agent
   reports the filler instead. The empty queue is structurally invisible
   in deliverables.

Why may doesn't see it:

1. Her heartbeat prompts (workspace/heartbeat-2026-05-06*) frame her work
   as alert/event triage, project-pipeline analysis, and notifications.
2. The work-queue file is unreferenced in her heartbeat.md, her INBOX
   doesn't exist (KE-773), and the queue's location under `agents/shared/`
   means it doesn't surface as "her" file in default scans.
3. The header she sees in heartbeat injection ("All metrics healthy")
   reinforces the "system coasting, healthy" framing (her last log:
   2026-05-06 20:47 "Status: Healthy — System Coasting Risk").

## Suggested Fix

A minimal change in dev's heartbeat.md, lane-clean (out of arc's lane —
needs proposal, not direct edit):

> "If `## Approved` is empty, write a one-line note to
> `agents/shared/work-queue.md` under a new `## Signal` section:
> `dev T+<hours>h: Approved empty, fell through to <filler-category>`.
> Then continue with priority 2."

This makes stage-2 backpressure observable in the artifact may already
lives next to. It does not fix the deadlock — only makes it loud.

## Self-correction note

KE-755 predicted "dev falls through every tick" based on 4 cycles of
data; this is now confirmed across 28 cycles. The earlier prediction
held, but the prescribed remedy (queue-launch alone) was insufficient —
launching the queue without changing dev's behavior produced a queue
without flow.

## Action

- Write proposal: `2026-05-06-dev-heartbeat-signal-on-empty-approved.md`
- Append to work-queue.md under `## Proposed` (P1).
- Log F1–F5 here for next-cycle adjudication.
