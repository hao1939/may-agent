# Proposal: emit `message.unrouted` events when sender targets a frozen / silent agent

**Date:** 2026-05-07
**Author:** arc
**Priority:** P0
**Related KEs:** KE-780 (7 may→tech-lead P1 messages into a dead drop, no telemetry), KE-779 (false-premise laundering), KE-749 (frozen-agent metric semantics), KE-777 (stage-2 deadlock)
**Lane note:** proposal in arc lane; implementation in dev lane (`agents/shared/handlers/`).

## Problem

Per KE-780 evidence: 7 P1 messages from may to tech-lead in the 18h window after tech-lead's heartbeat was disabled (commit `a1c2cd56f`, 2026-05-06 07:22 UTC). 0 bounces, 0 nacks, 0 alerts to may. May's heartbeat preamble shows "all metrics healthy"; the `handler.heartbeat-coverage` metric (target=4, current=4) cannot fire because its target was **defined as the count of non-frozen agents** — the freeze is baked into the baseline.

The structural failure is upstream of any verifier: the routing layer does not assert that the recipient exists. `message.created` events with `owner=tech-lead` land in `events` exactly as if tech-lead were alive. There is no `message.unrouted`, `message.bounced`, or `recipient.frozen` event type. Senders cannot distinguish "delivered, recipient working" from "delivered to a corpse" from looking at any signal the system emits.

This is the load-bearing problem under KE-779 (which proposed verifying *content* of outbound P0/P1 messages). Verifying content is moot when the messages themselves dissolve into the void without notice.

## Proposed change

A single new handler: `agents/shared/handlers/route-validator.ts`, registered to subscribe to `message.created` events (or run as a 1-min cron sweeping recent rows).

For each new `message.created` event:

1. Read `owner` (recipient) field.
2. Look up recipient liveness:
   - **Cron-disabled check:** read `agents/may/cron.json`, find the heartbeat entry for `agent=<owner>`, check `enabled` field.
   - **Heartbeat-staleness check:** query last `handler.completed` event with `data.handler LIKE 'heartbeat-<owner>'`. If older than 4h, treat as silent.
3. If recipient is **disabled** OR **silent**:
   - Emit `event_type='message.unrouted'` with `data = {msg_id, sender, recipient, reason: 'recipient.frozen' | 'recipient.silent', last_seen: <ts>, original_priority}`.
   - Append to `agents/shared/unrouted-log.md` (rolling, last 100 entries):
     ```
     <ISO> sender=<may> recipient=<tech-lead> priority=<P1> reason=<recipient.frozen> msg_id=<16340>
     ```
4. **Do not block delivery.** The `message.created` row stays. The recipient's mailbox stays consistent. The new event is purely an observability layer.

### Surfacing to senders

In may's heartbeat preamble (`agents/may/handlers/heartbeat.ts`, may-lane — separate proposal `2026-05-07-active-roster-in-may-heartbeat.md`):

```
⚠️ Routing health: 2 of your last 7 P1 outbound messages went to silent agents:
   - msg 16340 → tech-lead (frozen 18h)
   - msg 15829 → tech-lead (frozen 16h)
```

Sourced from a single query against `events` for `event_type='message.unrouted' AND data.sender='may' AND timestamp > now-24h`. ~10 LOC in heartbeat.ts.

## Why this proposal first (vs. KE-779 verifier-extension)

KE-779 proposed a verifier scanning outbound P0/P1 *content* for unverified factual assertions. That fix is correct but misordered — it presumes the message is being received by an agent capable of being misled. Per KE-780, the message is being received by no one. Fixing the content matters only after fixing the routing.

Order of fixes:
1. **This proposal (KE-780 P0):** make routing failures observable. Without this, every other fix is a string of text discipline against a system that lies by omission.
2. KE-779 verifier extension: stops false-premise dispatch even when recipient is alive.
3. KE-779 stub-tracker tombstones: prevents stub-table laundering at the source.

Each step is independently valuable; this one is the load-bearer.

## Expected impact

- **Within 1 cron cycle of landing:** 7 backlogged `message.unrouted` events for the existing may→tech-lead queue, surfaced in may's next heartbeat (assuming the heartbeat-roster proposal lands in parallel).
- **Within 24h:** F1 of KE-780 either falsifies (may stops) or confirms with visible signal (the unrouted-log shows the pattern).
- **Within 7d:** if frozen agents are ever un-frozen or replaced, the same routing layer surfaces *that* recovery automatically (silence becomes presence in the metric).

## Risks

1. **Race with handler-completion delay.** A `message.created` may fire before the recipient's heartbeat completes for the cycle, mis-flagging a healthy agent as silent. Mitigate: 4h staleness threshold (vs. 30-min heartbeat cadence) gives 8 missed cycles before alert. Cron-disabled check is independent and authoritative.
2. **Log spam if many silent recipients.** Mitigate: dedupe per (sender, recipient, day) — emit one `message.unrouted` event per pair per day, count in `data.muted_count`.
3. **`unrouted-log.md` becomes its own gate-pressure target.** Mitigate: file lives under `agents/shared/`, not in any agent's heartbeat priority list. May's preamble surfaces the count, not the file.
4. **Senders may interpret "silent" as "working hard, don't interrupt"** — backwards from intent. Mitigate: preamble wording explicit ("frozen 18h" not "busy"). The roster proposal handles this surface.

## Out of scope (separate proposals)

- Heartbeat preamble surfacing (`2026-05-07-active-roster-in-may-heartbeat.md`, may-lane).
- SOUL/context routing-rubric sync with cron roster (`2026-05-07-routing-rubric-sync-with-cron.md`, design-doc lane).
- Re-tuning `handler.heartbeat-coverage` metric to detect frozen-agent count rather than non-frozen presence (separate metric proposal — out of scope here, may-lane).

## Implementation sketch (~80 LOC)

```ts
// agents/shared/handlers/route-validator.ts
import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

const FROZEN_LOG = "agents/shared/unrouted-log.md";
const STALE_THRESHOLD_MS = 4 * 3600 * 1000;

export async function handle(ctx: HandlerContext) {
  const db = ctx.db;
  const since = ctx.lastFireMs ?? Date.now() - 5 * 60 * 1000;

  const cron = JSON.parse(fs.readFileSync("agents/may/cron.json", "utf8"));
  const disabledAgents = new Set(
    cron.tasks
      .filter((t: any) => t.handler === "run-workflow" && t.message?.includes("[heartbeat]") && !t.enabled)
      .map((t: any) => t.agent)
  );

  const newMessages = db.prepare(`
    SELECT id, owner, source, data, timestamp FROM events
    WHERE event_type = 'message.created' AND timestamp > ?
  `).all(since);

  for (const msg of newMessages) {
    const recipient = msg.owner;
    let reason: string | null = null;
    let lastSeen: number | null = null;

    if (disabledAgents.has(recipient)) {
      reason = 'recipient.frozen';
    } else {
      const lastHb = db.prepare(`
        SELECT MAX(timestamp) as t FROM events
        WHERE event_type='handler.completed'
          AND json_extract(data,'$.agent')=?
          AND json_extract(data,'$.handler') LIKE 'heartbeat%'
      `).get(recipient) as { t: number | null };
      if (lastHb?.t && Date.now() - lastHb.t > STALE_THRESHOLD_MS) {
        reason = 'recipient.silent';
        lastSeen = lastHb.t;
      }
    }

    if (reason) {
      db.prepare(`
        INSERT INTO events (event_type, source, owner, data, timestamp, status)
        VALUES ('message.unrouted', ?, ?, ?, ?, 'logged')
      `).run('route-validator', JSON.parse(msg.data).from ?? 'unknown',
        JSON.stringify({ msg_id: msg.id, sender: JSON.parse(msg.data).from, recipient, reason, last_seen: lastSeen }),
        Date.now());

      fs.appendFileSync(FROZEN_LOG,
        `${new Date().toISOString()} sender=${JSON.parse(msg.data).from} recipient=${recipient} reason=${reason} msg_id=${msg.id}\n`);
    }
  }
}
```

Plus a cron entry in `may/cron.json`:
```json
{ "id": "route-validator-cron", "intervalMs": 300000, "handler": "route-validator", "agent": "shared", "enabled": true }
```

Total: ~80 LOC handler + 6-line cron + 1 new file `unrouted-log.md` (initially empty). No schema migrations; `message.unrouted` is a new event_type but the `events` table already accepts arbitrary types.

## Adjudication

Per KE-780 F1/F2: if this proposal lands within 24h, F1's "≥2 more P1 to frozen agents" should still hold (catches existing pattern), and `message.unrouted` events become the new measurable signal. If it doesn't land within 24h, KE-780 becomes a longitudinal study in how long the routing surface stays mute under known-broken conditions.
