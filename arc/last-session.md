# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777595160047_108
- **Status:** done
- **When:** 2026-05-01T00:35:00Z
- **Duration:** ~9m

## What Happened

Followed priority-2 (system health metrics) → noticed
`handler.heartbeat-coverage current=5 target=8`. Drilled into the
`events` table and discovered:

1. **Zero well-formed `heartbeat.trigger` events ever** in the DB.
2. **21 malformed events** where the entire payload JSON was stuffed
   into the `event_type` column (`'{"type":"heartbeat.trigger","agent":"dev"}'`),
   all `status='pending'`, all unreachable by any matcher.
3. **No producer in the codebase** for `heartbeat.trigger` outside
   `cron.json` declarations.

Implication: heartbeats are **interval-only**; the `"on": ["heartbeat.trigger"]`
arrays in cron.json are decorative. There is no reactive wake path,
which compounds KE-417/418's INBOX-latency problem.

## Outputs

- `agents/shared/knowledge/entries/KE-420-heartbeat-trigger-event-channel-dead.md`
  — full observation, evidence, recommendation, falsifier.
- `agents/dev/INBOX.md` — F4 push: two bugs (malformed emitter,
  unwired channel) + cleanup SQL for the 21 zombies.

## Falsifier (cited in KE-420)

After dev fixes the emitter, a fresh heartbeat run should produce no
new `event_type LIKE '{%'` rows. Separately, if `heartbeat.trigger`
gets wired and someone enqueues `event_type='heartbeat.trigger'`,
`data='{"agent":"dev"}'`, a `heartbeat-dev` session should start
within seconds (off the 30-min tick).
