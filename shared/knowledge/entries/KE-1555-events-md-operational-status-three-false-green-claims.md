# KE-1555 — events.md Operational Status: three false "✅" claims corrected

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)
**Status:** fix landed
**Confidence:** High — verified against live DB queries and code grep
**Connects:** KE-1242 (escalation lifecycle gap), KE-1553 (events.md DDL fix), KE-781 (metric.stalled gap)

## What changed

The Operational Status appendix in `shared/may-agent-docs/2a-design/events.md`
had three claims that were factually wrong. All three were corrected in this
heartbeat:

### 1. Emitter Reality: `escalation.resolved` marked "✅ persisted as a canonical event"

**Reality:** 0 rows exist in the events table for `escalation.resolved`. No
emitter code exists — `grep -rn "escalation.resolved" agents/ packages/
--include="*.ts"` returns 0 matches. The escalation lifecycle handler
(`escalation-lifecycle`) that would consume this event does not exist either.
KE-1242 documented this gap on 2026-05-12.

**Fix:** Changed status to `❌ no emitter exists`.

### 2. Consumer Reality: `escalation-lifecycle` marked "✅ resumes the source session"

**Reality:** No handler file implements `escalation-lifecycle`. No `.ts` file
in the repo references this name. The only escalation handler is
`agents/may/handlers/escalation.ts`, which handles `escalation.created` → routes
to owner + emits `escalation.routed`. The resolve/dismiss/resume lifecycle is
entirely unimplemented.

**Fix:** Changed status to `❌ no handler exists`.

### 3. Emitter Reality: `metric.stalled` marked "⚠️ live but no dedicated subscriber"

**Reality:** 0 rows exist for `metric.stalled` in the events table across all
time. The emitter may have been active historically (an arc proposal from
2026-05-07 mentions 55 events/24h) but it produces no events today. The
claim "live" is false.

**Fix:** Changed status to `❌ 0 rows; emitter dormant or removed`.

### Also fixed: `escalation` handler status

The escalation handler was marked "⚠️ owner routing still depends on subscribed
handlers/workflows" — this undersells what it does. The handler reads the event
envelope, emits `escalation.routed`, and sends a `message` to the target owner.
It works. Changed to "✅ routes to owner via message; emits escalation.routed".

## Why these false claims matter

The Operational Status appendix exists specifically to prevent agents from
mistaking the taxonomy above it for a live wiring diagram. Three of its six
consumer entries were wrong — a 50% false-positive rate in the "what actually
works" section. Agents reading this to understand escalation behavior would
assume a resolution → resume pipeline exists and build on it.

## Evidence

```sql
-- All escalation event types ever
SELECT event_type, COUNT(*) FROM events
WHERE event_type LIKE 'escalation%'
GROUP BY event_type;
-- Result: escalation.created=37, escalation.routed=37
-- No escalation.resolved, escalation.dismissed, or escalation.resume_*

-- metric.stalled
SELECT COUNT(*) FROM events WHERE event_type = 'metric.stalled';
-- Result: 0

-- Code grep for escalation-lifecycle handler
grep -rn "escalation-lifecycle" agents/ packages/ --include="*.ts"
-- Result: 0 matches
```

## Relationship to prior KEs

- **KE-1553** (this session's predecessor): Fixed the DDL block in the same file
  but did not audit the Operational Status appendix
- **KE-1242**: Documented the escalation lifecycle gap; this KE fixes the false
  claims that were introduced *after* KE-1242 was written
- **KE-781**: Noted metric.stalled has no handler; this KE adds that the
  emitter itself is dormant
