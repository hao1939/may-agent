# DESIGN: Output Channel Redesign — Telegram & Web Console

**Status:** ✅ APPROVED — implementing Phase 1  
**Date:** 2026-04-15  
**Authors:** Bob (notification design), Tech-lead (engineering analysis), May (synthesis)  
**Revision:** Approved by Hao. Changed "silence = healthy" to periodic proof-of-life digests.

---

## Problem

Both telegram and web console are too noisy. A single coder session generates 50+ messages. 7 agent heartbeats produce 14 notifications/hour. A normal workday generates 200-400 notifications. The useful signal — breakthroughs, blocked tasks, errors — drowns in routine completions.

## Solution: Two-Layer Fix

**Layer 1 (code):** Fix the event pipeline — stop streaming child session turns, fix the socket bug. ~28 LOC across 2 files.  
**Layer 2 (behavioral):** May classifies urgency and produces periodic digests instead of raw forwarding. Zero code changes.

---

## Part A: Telegram Noise Fix (Tech-lead)

### Current Behavior
`telegram.ts` bus.subscribe callback accumulates ALL text events from the session tree (including child sessions) and flushes on every `turn_end`. A `tech-lead → coder` delegation produces ~20 child turns = 20+ Telegram messages.

### Fix: Skip Child Turns, Send One Summary

Only accumulate/flush text for the root chat session (May's direct conversation). For child sessions, send ONE summary when they complete using the `session_end` event's `finishParams`:

- `session_end` with `status: success` → `✅ coder: Refactored guard module. Files: guard.ts, guard.test.ts`
- `session_end` with `status: failure/blocked` → `❌ coder BLOCKED: Test failures in auth module`

**LOC:** ~25 in telegram.ts  
**Risk:** Low — backward compatible. Worst case: user misses intermediate child output (can check web UI).

### What Stays Real-time
- May's direct responses to human messages (conversation, not notification)
- Human-initiated command responses (/status, /approve, etc.)

---

## Part B: Web Console Socket Bug Fix (Tech-lead)

### The Bug
`socket.ts` line 114: `shouldForward()` returns `true` for ALL notification events regardless of session filter:

```typescript
if (event.type === "notification") return true;  // ← bypasses filter
```

This forwards Bob, coach, optimizer notifications into May's chat panel.

### Fix
Change to `return false` for chat-mode clients. Notifications are not session-scoped and don't belong in a session-filtered stream.

**LOC:** ~3 in socket.ts  
**Risk:** Zero.

---

## Part C: Notification Urgency System (Bob)

May classifies every notification into 3 levels:

### URGENT — Interrupt now (telegram push)

**Question:** "If Hao sees this 2 hours from now instead of now, would anything be worse?"

| Signal | Example |
|--------|---------|
| System error | Process crash, DB corruption |
| Agent stuck | Same task retried 3+ times |
| Blocked on human | Agent requests approval/decision |
| Gatekeeper hold | REVIEW_REQUEST needing sign-off |
| Cost alert | Session cost >$2, daily spend >2× normal |

**Delivery:** Immediate telegram. No batching.

### ALERT — Worth knowing soon (batched in digest)

| Signal | Example |
|--------|---------|
| Task completed with unexpected result | Coder failed, experiment disconfirmed hypothesis |
| Research finding | New knowledge entry with cross-agent implications |
| Deliverable ready | Design doc completed, awaiting review |

**Delivery:** Batched into periodic digest (see below).

### INFO — Routine (feed only, never telegram)

| Signal | Example |
|--------|---------|
| Normal heartbeat completion | "Bob: processed 2 tasks, wrote 1 entry" |
| Routine task completions | Coder finished normally |
| Workspace file updates | Knowledge base additions |

**Delivery:** Web console activity feed only.

---

## Part D: Periodic Digest

### Cadence
- **Proof-of-life digest:** Every 2 hours, always sent (never suppressed)
- **Daily summary:** Once per day, all activity including INFO

### Format (scales with activity)

**Normal** (one line):
```
📋 2h: 12 sessions, 3 deliverables, $1.47. Top: tech-lead shipped persistent-task fix.
```

**Low activity** (attention needed):
```
⚠️ 2h: Only 2 sessions — below normal. Check system.
```

**No activity** (alarm):
```
🔴 2h: No sessions — system may be stuck.
```

**Has alerts** (detailed):
```
📋 2h Digest (11:00–13:00)
ALERTS: Bob: E-041 disconfirmed H-097 • Coder: failed "refactor guards" (retry queued)
DONE: Tech-lead: 2 PRs approved • Bob: notification-design doc
SYSTEM: 12 sessions, $1.47.
```

### Anti-Fatigue
- **Short when normal, detailed when noteworthy.** Don't suppress digests — make them brief instead. The digest itself is proof the system is alive.
- **Delta-only:** Report what CHANGED since last digest, not current state
- **Deduplication:** If the same alert appeared in a prior digest, don't repeat it

---

## Part E: Child Session Summarization

When a forked/called session completes, `session_end` event already carries `finishParams.summary`, `finishParams.status`, and `finishParams.deliverables`. No new data needed.

**Routing through urgency:**
- `status: success` → INFO (feed only, or concise summary in telegram)
- `status: partial` → ALERT (digest-worthy)
- `status: failure/blocked` → ALERT, upgraded to URGENT if 2+ failures on same task

---

## Implementation Plan

### Phase 1: P0 Fixes (~28 LOC, immediate)

| Fix | LOC | File | Impact |
|-----|-----|------|--------|
| Socket notification bypass | ~3 | socket.ts L114 | Stops noise in web chat panel |
| Telegram child-session summarization | ~25 | telegram.ts | Reduces 20+ msgs → 1 per child |

These are independent, can be done in parallel. Total noise reduction: ~80%.

### Phase 2: Behavioral Changes (0 code)

| Change | Where | Impact |
|--------|-------|--------|
| May urgency classification | May's context.md/heartbeat | Adds judgment layer |
| Periodic digest format | May's heartbeat logic | Batches alerts into digests |
| Anti-fatigue patterns | May's context.md | Suppresses repetition |

### Phase 3: Polish (P2, later)

| Change | LOC | File | Impact |
|--------|-----|------|--------|
| Web frontend notification feed separation | ~40 | web-static/ | Clean UI |
| Child session summary cards in web UI | ~30 | web-static/ | Better UX |
| Urgency field on notification events | ~10 | event-bus.ts | Machine-readable urgency |

---

## Expected Outcome

| Current | Proposed |
|---------|----------|
| 200-400 raw notifications/day | 2-5 URGENT (immediate) + 4-6 digests + 1 daily |
| 50+ messages per coder session | 1 summary message |
| Same "healthy" message 14×/day | Brief proof-of-life digest every 2h, detailed when noteworthy |
| Human ignores everything | Human reads everything that arrives |

---

## Risks

1. **May misclassifies URGENT as INFO** — Mitigated by hardcoded never-filter list (system crashes, gatekeeper holds, explicit escalations). Daily summary catches misses within 24h.
2. **Over-classification fatigue** — If >5 URGENT/hour, auto-downgrade subsequent to ALERT.
3. **May as notification router is over-engineering** — Tech-lead's analysis: inline filtering in telegram.ts is sufficient. Don't build a central routing layer unless the simple approach fails.
