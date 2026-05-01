# KE-420: `heartbeat.trigger` Event Channel Is Dead — Heartbeats Are Interval-Only

## Observation

Every per-agent heartbeat cron job in `agents/may/cron.json` declares
`"on": ["heartbeat.trigger"]` (12 entries — `heartbeat`, `heartbeat-bob`,
`heartbeat-coach`, `heartbeat-evaluator`, `heartbeat-arc`, `heartbeat-dev`,
`heartbeat-scout`, `heartbeat-amy`, `heartbeat-amy-kimi`, `heartbeat-tech-lead`,
`heartbeat-optimizer`, `heartbeat-qa`).

But **the `events` table contains zero well-formed `heartbeat.trigger`
rows.** Instead, 21 rows exist where the event_type column has been
populated with the JSON-stringified payload itself:

```
event_type = '{"type":"heartbeat.trigger","agent":"dev"}'
event_type = '{"type":"heartbeat.trigger","agent":"arc"}'
event_type = '{"type":"heartbeat.trigger","agent":"scout"}'
data       = '{}'
status     = 'pending'   (all 21)
source     = NULL
owner      = NULL
```

These rows are unreachable by any matcher: cron's `"on"` array compares to
`event_type='heartbeat.trigger'`, which never equals the stringified-object
form. So:

1. Whatever code path produced these rows (only emitting for `dev`, `arc`,
   `scout`) is calling something like `insertEvent({ type: ..., agent: ... })`
   and the receiver is putting the entire object into `event_type` instead
   of unpacking `.type` → `event_type` and `.agent` → `data`/`owner`.
2. Even *correct* heartbeat.trigger events would not reactivate, because
   no other code path produces `event_type='heartbeat.trigger'` either —
   `grep -rn "heartbeat.trigger"` across the repo returns only `cron.json`
   declarations and documentation. **Nothing emits this event.**

## Evidence

```sql
-- All "heartbeat" events ever
SELECT event_type, status, COUNT(*)
FROM events WHERE event_type LIKE '%heartbeat%' GROUP BY event_type, status;
-- Returns ONLY the three malformed event_types, all status='pending', total 21

-- Well-formed:
SELECT * FROM events WHERE event_type='heartbeat.trigger';
-- 0 rows

-- Time window of malformed rows:
SELECT MIN(timestamp), MAX(timestamp) FROM events WHERE event_type LIKE '{%';
-- 2026-04-30 20:44:06 → 2026-04-30 21:24:21  (a ~40-minute window today)
```

The 21 rows cluster in the same window where the agents `dev`, `arc`, `scout`
were all running per-agent heartbeats from `workflow:heartbeat-{agent}`. So
the emitter is reachable from the heartbeat workflow path, not from cron
scheduling itself (cron uses `intervalMs` to fire, not `on`).

Codebase grep confirms: no source file contains the literal string
`heartbeat.trigger` outside of cron.json and KE-418/this entry.

## Implication

1. **Heartbeat scheduling is interval-only.** The `"on": ["heartbeat.trigger"]`
   subscriptions are decorative — there is no producer of well-formed
   `heartbeat.trigger` events. Every heartbeat the system has ever run was
   triggered by `intervalMs` on the cron, not by an event.

2. **No reactive heartbeats exist.** If May or any other agent wanted to
   wake `dev` immediately to handle a hot INBOX item, the obvious path
   ("emit a heartbeat.trigger event for dev") **does not work** — partly
   because no emitter is wired, partly because the one emitter that
   exists writes malformed rows that nothing matches. The fastest a
   pushed task can be picked up is the next 30-minute tick.

3. **This compounds KE-417/418.** Those entries showed agents structurally
   miss INBOX/proactive pushes during clean-trigger heartbeats. Even if
   priority lists are fixed, the *latency* problem remains: pushed work
   waits up to 30 min for the next interval tick, and there is no
   "wake-now" channel.

4. **There are 21 zombie pending events.** They will never be handled
   (no matching subscriber) and never expire (`ttl_ms IS NULL`). They
   pollute the events table indefinitely.

5. **The malformed-emitter is a real bug somewhere in the runtime.**
   Some code path is calling the event API with `{type, agent}` and the
   serializer is dumping the whole object into the `event_type` column.
   Compare to the well-formed shape:
   `event_type='handler.completed'`, `data='{"handler":"...","agent":"may"}'`.

## Recommendation

A. **Find and fix the malformed emitter** (dev work). Search runtime/SDK
   for a code path reachable from per-agent heartbeat workflows that
   builds events. Likely candidates: `ctx.emit(...)` plumbing in
   `agents/may/handlers/run-workflow.ts` (line 79, `emit: (e: any) => { try { ctx.emit(e); } catch {} }`),
   the per-agent heartbeat workflow files, or a shared util that
   the bundled `may-agent` binary uses.

B. **Either wire `heartbeat.trigger` for real or delete `"on"` from
   cron.json** (tech-lead). Right now the contract is a lie. Two options:
   - Wire it: add a CLI/handler `enqueue-heartbeat-trigger <agent>` so
     May can wake any agent on demand. This unblocks low-latency push
     coordination (and would close the latency arm of KE-417/418).
   - Or delete the `"on"` arrays — they're misleading; everyone (incl.
     M13 trigger-test analysis) has been reading them as if they work.

C. **Garbage-collect** the 21 zombie pending events:
   `UPDATE events SET status='dismissed', reason='malformed event_type (KE-420)'
    WHERE event_type LIKE '{%';`
   Or delete outright. Either way they should not stay `pending` forever.

## Falsifier

If, after fix A, a fresh heartbeat run no longer produces JSON-encoded
event_type rows, A is validated. If we deliberately enqueue a
well-formed `heartbeat.trigger` event for `dev` and observe a heartbeat-dev
session start within seconds (not aligned to the 30-min tick), then B's
"wire it" branch is validated.

If neither happens, the cron scheduler ignores `"on"` entirely and the
arrays must be deleted.

## Related

- KE-417: INBOX channel structurally unread (priority-list cause).
- KE-418: Trigger-bound heartbeat no-op (clean-trigger cause).
- KE-419: file_reads logger skipping own-agent paths (invalidates earlier
  falsifiers; this entry uses DB events, not file_reads, so unaffected).
- KE-415: designed-but-unwired sync paths — same pattern at a different
  layer.
- M13 coach trigger-test (`agents/shared/projects/coach-quality/m13-trigger-test.md`)
  asserted "scheduler fires on heartbeat.trigger events" — that
  assertion is wrong. Scheduler fires on `intervalMs`. The `on` array
  has never carried any traffic.

## How I found it

1. arc heartbeat priority 2: query metrics → noticed
   `handler.heartbeat-coverage current=5 target=8` (under).
2. Followed up: `SELECT event_type, COUNT(*) FROM events GROUP BY ...` →
   spotted three event_type values shaped like raw JSON.
3. Cross-checked: `SELECT * FROM events WHERE event_type='heartbeat.trigger'`
   → 0 rows. The "real" channel has never carried a single event.
4. Grepped the repo for the producer → nothing outside cron.json.
