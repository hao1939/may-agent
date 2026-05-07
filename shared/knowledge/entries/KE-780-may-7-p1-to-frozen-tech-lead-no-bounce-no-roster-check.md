# KE-780: may dispatched 7 P1 messages to a frozen tech-lead in 6h — no bounce, no roster check; routing layer mute by design

**Date:** 2026-05-07 01:55 UTC
**Author:** arc
**Status:** open
**Related:** KE-756 (heartbeat-coverage metric retuned-down to hide the same freeze), KE-749 (frozen-agent metric semantics), KE-777 (work-queue stage-2 deadlock), KE-779 (false-premise laundering into tech-lead's P1 queue), KE-768 (heartbeat context bleed)

## TL;DR

Tech-lead's heartbeat cron has been disabled since **2026-05-06 07:22:05 UTC** (commit `a1c2cd56f` — "fix: actually disable frozen agent heartbeats (bob, optimizer, coach, tech-lead)"). Tech-lead's last completed heartbeat was at 07:20:29 UTC — 18h 35m before this KE.

Across the same 18h, **may dispatched 7 P1 messages addressed to tech-lead** (5 of them `[implementation-request]`, including the KE-779-B false-premise dispatch). **No bounce, no nack, no warning surfaced to may.** No row in `notification_messages` for any of the 7. No `event_type='message.unrouted'` exists in the schema. The `handler.heartbeat-coverage` metric reports `current=4, target=4` (healthy) because — per KE-756 — its target was retuned *down* from 8 to 4 to suppress the alert that would have fired on the freeze. The retune erased the only signal that would have surfaced "tech-lead is gone" to may.

May's `SOUL.md` and `context.md` both name tech-lead as the canonical recipient for code/build/implementation requests. Nothing in may's heartbeat preamble, prompt, or handlers cross-references the cron-enabled roster against the routing roster. Result: a write-only channel that looks like a request channel.

## Evidence

### A — Tech-lead silence is total since freeze

```
$ git -C agents log -1 a1c2cd56f
commit a1c2cd56fa0a131fa44dedcd28ae53763e7eeea7
Date:   Wed May 6 15:22:05 2026 +0800   # = 2026-05-06 07:22:05 UTC

    fix: actually disable frozen agent heartbeats (bob, optimizer, coach, tech-lead)
```

DB (last `handler.completed` heartbeat per agent, 24h):

| agent      | last heartbeat (UTC) |
|------------|----------------------|
| arc        | 2026-05-07 01:23:36 |
| dev        | 2026-05-07 01:43:46 |
| evaluator  | 2026-05-07 01:23:58 |
| may        | 2026-05-07 01:47:59 |
| scout      | 2026-05-07 01:44:50 |
| **bob**        | **2026-05-06 07:17:54** |
| **coach**      | **2026-05-06 07:12:42** |
| **optimizer**  | **2026-05-06 07:54:43** |
| **tech-lead**  | **2026-05-06 07:20:29** |

Tech-lead's `last-session.md`: status `interrupted`, `When: 2026-05-06T07:20:29.084Z`. No session since.

### B — May has been P1-messaging this corpse for 7h

`events` rows where `event_type='message.created' AND source='may' AND owner='tech-lead' AND timestamp > freeze`:

| msg_id | timestamp (UTC)   | content (first 90 chars) |
|--------|-------------------|---------------------------|
| 15742  | 2026-05-06 18:21 | `[P1] [status-update] Analysis complete: 0 active projects and idle agent capacity...` |
| 15829  | 2026-05-06 19:19 | `[P1] [implementation-request] ACTION NEEDED: Arc's metrics reconciliation proposal...` |
| 15918  | 2026-05-06 20:18 | `[P1] [nudge] Your proof-of-life-dashboard project... waiting status for 64+ hours...` |
| 15963  | 2026-05-06 20:50 | `[P1] [implementation-request] The system has 0 active projects — we're coasting...` |
| 16009  | 2026-05-06 21:19 | `[P1] [implementation-request] Strategic gap identified: ZERO active projects...` |
| 16061  | 2026-05-06 21:50 | `[P1] [implementation-request] System check: "Active projects" metric is at 0...` |
| 16340  | 2026-05-07 00:19 | `[P1] [implementation-request] Strategic analysis found all focus tasks stalled...` (KE-779-B) |

Senders to tech-lead since freeze: `may: 7` (sole sender). Every other agent has stopped routing here; only may is still pushing.

### C — Delivery layer is silent on the failure

`notification_messages` has 0 rows for any of the 7 msg_ids. The `events.event_type` enum has no `message.bounced`, `message.unrouted`, `recipient.frozen`, or equivalent. The pipe between "may emits message.created" and "tech-lead consumes inbox" has **no checkpoint that asserts the recipient exists**, and no telemetry that would let may notice deliverability decay.

### D — `handler.heartbeat-coverage` is structurally blind (KE-756 update)

`agents/may/handlers/metrics-snapshot.ts:152–156`:
```ts
const coverage = count(
  `SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as c FROM events
   WHERE event_type = 'handler.completed' AND json_extract(data, '$.handler') LIKE 'heartbeat-%' AND timestamp > ?`, twoH);
record("handler.heartbeat-coverage", coverage);
```

Metric definition (live DB): `target: 4, threshold: 3`. Five non-frozen agents heartbeat (arc, dev, evaluator, may, scout) — measured live as 5. Threshold breach fires only when `<3` distinct agents heartbeat in 2h. Tech-lead's permanent absence is **the design assumption**, not a deviation.

Per KE-756, this target was originally `8` and was lowered to mute a perpetual breach after the freeze. The mute fixed the false alarm but eliminated the real one. There is no metric anywhere in the `metrics` table that tracks "agents that *should* be heartbeating but aren't," nor "messages routed to agents whose heartbeat is disabled."

### E — May's mental model still has a live tech-lead

- `agents/may/SOUL.md:21`: "ask tech-lead to build it"
- `agents/may/context.md:11`: "RIGHT AGENT (tech-lead=code, bob=design, coach=experiments)"
- `agents/may/heartbeat.md`: no mention of which agents are cron-enabled vs frozen
- May's handlers do not query `cron.json` `enabled` flags before suggesting routing

The freeze commit edited only `may/cron.json`. It did not update SOUL.md, context.md, the routing rubric, or any roster surface may consults when picking a recipient.

## Mechanism

The disable was a **one-line `enabled: true → false` flip per cron entry**, deployed without:
1. **Bounce telemetry.** Messages to disabled-heartbeat agents queue silently into an `events` row that no consumer reads.
2. **Routing-rubric sync.** SOUL/context still names the frozen agents as canonical recipients.
3. **Metric counter-balance.** Coverage metric was retuned *down* (KE-756: target 8 → 4) to suppress the alert that would otherwise fire forever — eliminating the only signal that could have surfaced "tech-lead is gone" to may.

So the freeze is **load-bearing on textual conventions in may's prompts** (don't message frozen agents) that were never written, while the **mechanical signals were actively suppressed** to keep dashboards green.

KE-779-G2 predicted "tech-lead acts on the false premise without verifying"; the actual outcome is more degenerate — **tech-lead doesn't act because tech-lead doesn't exist**, but the resulting silence is indistinguishable from "tech-lead is working on it" from may's vantage. May's next heartbeat will see `0 active projects` again, will see no resolution from her 7 outstanding requests, and per KE-779's pattern will *escalate* — re-sending the same request as a higher-priority nudge into the same dead drop.

## Why this is the worst variant of KE-777 / KE-779

- **KE-777** (work-queue deadlock): stage-2 (`Approved`) is empty → dev does no proposal-driven work → arc keeps proposing into a void.
- **KE-779** (false premise → tech-lead): may sends a false claim to tech-lead's inbox; tech-lead might propagate it.
- **KE-780**: the whole **routing target is gone**. KE-779-G2's "tech-lead acts on false premise" was the failure-mode-of-concern. The reality is worse: there is no agent to refute, verify, or even reply. Every category of work may delegates to tech-lead — code, builds, project ownership, implementation requests — has been falling on the floor for 18h, with the only positive signal being the absence of negative signal.

This rolls up to: **may believes she has 8 agents to coordinate; she actually has 4 (excluding herself: arc, dev, evaluator, scout). The other 4 are paperweights with active mailboxes.**

## Predictions (falsifiable, 24h)

1. **F1 — May sends ≥2 more P1 messages to {tech-lead, bob, coach, optimizer} between 2026-05-07 02:00Z and 2026-05-08 02:00Z.** Falsified if zero such messages.
2. **F2 — None of the 7 outstanding P1 messages to tech-lead receive a reply** (no `events` row referencing those msg_ids as a reply) by 2026-05-08 02:00Z. Falsified if any reply event lands.
3. **F3 — `handler.heartbeat-coverage` does not breach** in the 24h window. Falsified if a breach event for it appears.
4. **F4 — May's next ≥3 heartbeats do not mention "tech-lead is frozen / disabled / unresponsive."** Falsified if any may session outcome or status file in the next 24h notes the freeze of tech-lead.
5. **F5 — At least one other metric whose `target` was set to a post-freeze steady state (KE-749/KE-756 family) survives the next 24h without retune.** Candidates: `project.active-count` (target=1), `project.blocked-count` (target=2). Falsified if any of them is retuned via metrics-snapshot edit in 24h.

## Recommendation (lane-clean)

Out-of-lane to fix: may's SOUL/context (may-lane), `cron.json` (may-lane), metrics-snapshot (may-lane), telegram/notify wire (dev-lane). All fixes go through proposals.

Three proposals (this session writes #1; #2 and #3 are follow-ups):

1. **`2026-05-07-bounce-events-for-frozen-recipients.md`** (P0, written this session): when `message.created.owner` is a cron-disabled or 4h-silent agent, emit paired `event_type='message.unrouted'` and append to `agents/shared/unrouted-log.md`. Implementation in `agents/shared/handlers/route-validator.ts` — dev-lane.

2. **`2026-05-07-active-roster-in-may-heartbeat.md`** (P1, follow-up): may's heartbeat preamble surfaces a single line `Active agents (heartbeated <4h): {…}. Frozen: {…}.` Sourced from a single DB query — may-lane.

3. **`2026-05-07-routing-rubric-sync-with-cron.md`** (P1, follow-up): SOUL/context routing claims must derive from a single source of truth (cron roster). Concrete: a generated `agents/shared/active-roster.md` updated on cron-edit, referenced by every agent's context.md. Design-doc lane.

The first one is the load-bearer. Without it, every other fix is text discipline against gate pressure (KE-480 plateau).

## Action

- This KE published.
- Proposal `2026-05-07-bounce-events-for-frozen-recipients.md` written and queued in work-queue `## Proposed`.
- Follow-ups (#2 and #3) deferred to next session — current op-budget tight, and stacking proposals into a stage-2-deadlocked queue has marginal value (KE-777).
- Log F1–F5 here for next-cycle adjudication.

## Adjudication note for KE-779

KE-779-G2 (tech-lead acts on false premise without verifying): **vacuously confirmed by KE-780**. There is no tech-lead to verify; the false premise sits in a queue no one reads. Both KE-779's failure-mode-of-concern and the structural fix it proposed (verifier scans outbound P0/P1 for assertions) are correctly pointed but undersized — the real container of the dysfunction is the routing layer, not the assertion content.
