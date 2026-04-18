# Notification Filtering & Urgency System

**Author:** Bob  
**Date:** 2026-04-15  
**Status:** DRAFT — section for unified Output Channel Redesign

---

## The Problem in Numbers

Current state: 7 agents × heartbeat every 30min = 14 heartbeat notifications/hour. Each coder session streams 50+ messages. A normal workday generates 200-400 notifications. No human reads this. The useful signal — a research breakthrough, a blocked task, a system error — drowns in routine completions.

The fix: May becomes the notification filter. Every outbound notification passes through May's classification before reaching the human. She decides what's worth interrupting for, what to batch, and what to silently log.

---

## 1. Urgency Classification

Three levels. May classifies every notification before routing.

### URGENT — Interrupt now (telegram push + highlight)

**Criteria:** Something is broken, stuck, or needs a human decision to unblock.

| Signal | Example |
|--------|---------|
| System error | Process crash, DB corruption, SSH freeze |
| Agent stuck | Same task retried 3+ times, circuit breaker tripped |
| Blocked on human | Agent explicitly requests approval or decision |
| Gatekeeper hold | REVIEW_REQUEST from may-gatekeeper needing Hao's sign-off |
| Budget/cost alert | Session cost exceeds $2, or daily spend trending >2× normal |
| Data loss risk | Git conflict on shared files, checkpoint write failure |

**Delivery:** Immediate telegram message. No batching. Include enough context to act: what happened, what's needed, suggested action.

### ALERT — Worth knowing soon (telegram, batched in digest)

**Criteria:** Something noteworthy happened that changes the human's mental model of system state, but doesn't need action in the next hour.

| Signal | Example |
|--------|---------|
| Task completed with unexpected result | Coder session failed, experiment disconfirmed hypothesis |
| Research finding | New knowledge entry with cross-agent implications |
| Experiment result | Gym baseline completed, score delta >10pp from expected |
| Scenario change | Agent behavior pattern shifted (e.g., new failure mode) |
| Recovery event | Auto-resumed session after crash — worked, but worth noting |
| Deliverable ready | Design doc, brief, or synthesis completed and awaiting review |

**Delivery:** Batched into periodic digest (see §2). Not pushed individually unless May judges it time-sensitive enough to upgrade.

### INFO — Routine (feed only, never telegram)

**Criteria:** System operating normally. Only interesting if you go looking.

| Signal | Example |
|--------|---------|
| Normal heartbeat completion | "Bob: processed 2 tasks, wrote 1 knowledge entry" |
| Workspace file updates | Knowledge base additions, context.md edits |
| Routine task completions | Coder finished a normal session successfully |
| Session lifecycle | Agent forked/completed child sessions, normal flow |
| Metrics within range | Daily stats, token usage, session counts — all normal |

**Delivery:** Written to the feed (web console log). Never pushed to telegram. Available on demand via `/status` or console.

### Classification Rules for May

May doesn't need a scoring algorithm. She has context: she dispatched most of these tasks, she knows what's normal. The classification question is: **"If Hao saw this 2 hours from now instead of now, would anything be worse?"**

- Yes → URGENT
- Maybe, but he'd want to know → ALERT  
- No → INFO

---

## 2. Periodic Digest

### Cadence

- **Alert digest:** Every 2 hours (or when 5+ alerts accumulate, whichever first)
- **Daily summary:** Once per day, covering all activity including INFO
- **Silence:** After a digest, if nothing changes next window, send nothing — one silence confirmation, then true silence

### Format

Bullet list, agent-grouped, one line per item. Example digest covers a busy 2h window in ~12 lines:

```
📋 2h Digest (11:00–13:00)
ALERTS: Bob: E-041 disconfirmed H-097 (p=0.73) • Coder: failed "refactor guards" (auto-retry queued) • Optimizer: stale-reference-cleanup baselined at 42% (<70% target)
DONE: Tech-lead: 2 PRs approved • Bob: notification-design doc + 3 hypotheses • Coder: 3/4 tasks
SYSTEM: Healthy. 12 sessions, $1.47. Next digest: 15:00.
```

### Trigger

May's 30-min heartbeat checks a notification buffer. Send when: (1) ≥2h since last digest with alerts buffered, (2) ≥5 alerts regardless of time, or (3) daily summary time reached.

---

## 3. Child Session Summarization

When a forked session completes, the current behavior is to stream or forward raw output. Instead:

**Rule:** One summary message per completed child session, derived from the `finish()` call.

Format: `[agent] completed "<task>": <status>. <summary>. Files: <deliverables>.`

Example: `coder completed "refactor guard-workflow.ts": success. Extracted 3 guard functions into separate modules, added tests. Files: src/guards/budget.ts, src/guards/scope.ts, src/guards/quality.ts.`

**Classification of child completions:**
- `status: success` → INFO (routine, goes to feed)
- `status: partial` → ALERT (something incomplete, digest-worthy)
- `status: failure` or `status: blocked` → ALERT, upgraded to URGENT if the blocked task is on the critical path or if 2+ failures occur on the same task

The `finish()` call already provides summary, status, deliverables, and blockers. No new data collection needed — just route it through the urgency classifier instead of forwarding raw.

---

## 4. Never-Filter List

Some notifications bypass classification entirely and always reach the human immediately:

1. **May's direct replies to human messages.** If Hao asks a question, the answer goes straight through. This is conversation, not notification.
2. **Human-initiated commands.** `/status`, `/approve`, `/pause` — responses are immediate and unfiltered.
3. **System crashes and stuck loops.** Process-level failures, OOM kills, agent infinite retry detection. These are always URGENT regardless of May's judgment.
4. **REVIEW_REQUEST items from the gatekeeper.** These exist specifically because a human needs to decide. Always URGENT.
5. **Explicit escalations.** Any agent that calls `escalate()` or marks a task as human-blocked.

---

## 5. Anti-Fatigue Patterns

Volume reduction isn't enough. The deeper problem is **repetition** — the same "system healthy" message 14 times a day teaches the human to ignore everything.

### Deduplication

If three consecutive digests would contain substantively the same content ("all agents healthy, normal completions"), collapse to: `"System stable — no changes since last digest. Next check: [time]."` Then go silent until something changes.

Implementation: May compares the current digest draft against the last sent digest. If the delta is only routine completions with no alerts, suppress.

### Delta-Only Reporting

Digests report what CHANGED, not current state. Don't say "Bob is researching" every 2 hours. Say "Bob started new experiment E-042" once, then nothing until it completes.

State that hasn't changed since the last digest is omitted. If everything is the same, the digest is suppressed entirely (see deduplication above).

### Silence as Signal

After 2 consecutive suppressions, send one confirmation: `"All quiet — agents working normally. I'll notify you when something changes."` Then true radio silence until a genuine alert or the daily summary.

The human should learn: if telegram is silent, things are fine. A notification means something actually happened.

---

## 6. Edge Cases and Failure Modes

### What if May misclassifies URGENT as INFO?

Real risk. May's judgment isn't perfect. Mitigations:
- **The never-filter list (§4) is hardcoded, not judgment-based.** System crashes and gatekeeper holds can't be suppressed regardless of classification.
- **Agents can self-escalate.** If an agent marks `status: blocked` with a blocker reason containing "human" or "approval," it auto-upgrades to URGENT regardless of May's classification.
- **Daily summary catches misses.** Even if something was wrongly classified as INFO, it appears in the daily summary. Maximum delay for a misclassified alert: one day.
- **Retrospective review.** Periodically (weekly), review what was classified as INFO — did anything matter? Tune criteria.

### What if May over-classifies and everything is URGENT?

Less dangerous but still annoying — defeats the purpose. Mitigation:
- **Rate limiting.** If May sends >5 URGENT notifications in an hour (outside of a genuine system crisis), auto-downgrade subsequent ones to ALERT with a note: "Multiple urgents — see digest for full list."
- **Human feedback.** Hao can reply "too noisy" and May adjusts thresholds for the session.

### What about timezone / availability?

Out of scope for this design. Future: May could learn Hao's active hours and batch even URGENT items during sleep, unless they're system-critical. For now, all URGENT = immediate.

---

## Summary

| Current | Proposed |
|---------|----------|
| 200-400 raw notifications/day | 2-5 URGENT (immediate) + 4-6 digests + 1 daily summary |
| Every heartbeat → telegram | Only alerts and urgents reach telegram |
| 50+ messages per coder session | 1 summary message per session |
| Same "healthy" message 14×/day | Silence = healthy, notification = something changed |
| Human ignores everything | Human reads everything that arrives |
