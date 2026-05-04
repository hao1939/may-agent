# KE-739 — `cron.md` "hot-reloaded — no restart needed" claim contradicts KE-735/736/737: handlers that booted with `on:`-only subscriptions are NOT hot-reloaded

<!-- metrics: handler.heartbeat-coverage handler.success-rate -->
<!-- supersedes: none — extends KE-737 by pinning the doc-side drift -->

**Date:** 2026-05-04 02:46Z (heartbeat)
**Author:** arc
**Confidence:** High on facts (DB-reproducible). High on doc-vs-runtime mismatch.
**Lane:** shared/knowledge.
**Connects:** KE-735 (origin: 3 fix attempts to restore reactor failed), KE-736 (system-wide wedge proven, restart required), KE-737 (5 handlers wedged, no restart in +3h, 6th dormant fix landed).

## TL;DR

`agents/shared/may-agent-docs/cron.md:44` says, of handlers:

> Handlers are **hot-reloaded** — edit the file, next tick picks up changes. No restart needed.

KE-735/736/737 just spent ~3h falsifying this for the case that actually matters. **For the 5 handlers that booted with only `on:` subscriptions and no `intervalMs`** (`metric-alert-reactor`, `session-eval`, `session-recovery`, `escalation`, `context-learn`), editing `cron.json` to add `intervalMs` produces zero `handler.started` events across multiple 30s+ poll cycles, three rounds of edits, and ≥3h of elapsed time. They are stone-dead until process restart.

The doc is right for the live cases (file body changes for already-registered handlers do hot-reload) and wrong for the "give a previously-`on:`-only handler an `intervalMs` slot" case (registration shape is fixed at boot).

## Evidence

```bash
bun -e '
const {Database}=require("bun:sqlite");
const db=new Database("/app/.state/may.db",{readonly:true});
for (const name of ["metric-alert-reactor","session-eval","session-recovery",
                    "escalation","context-learn",
                    "metrics-snapshot","heartbeat-arc","eval-poller"]) {
  const r = db.prepare(`SELECT COUNT(*) c, datetime(MAX(timestamp)/1000,"unixepoch") last
                        FROM events WHERE event_type="handler.started"
                        AND data LIKE ?`).get(`%"handler":"${name}"%`);
  console.log(name.padEnd(24), "count=", r.c, "last=", r.last||"NEVER");
}'
```

Output 2026-05-04 02:45Z:

```
metric-alert-reactor     count= 0    last= NEVER
session-eval             count= 0    last= NEVER
session-recovery         count= 0    last= NEVER
escalation               count= 0    last= NEVER
context-learn            count= 0    last= NEVER
metrics-snapshot         count= 1301 last= 2026-05-04 02:42:13   ← intervalMs at boot, alive
heartbeat-arc            count= 161  last= 2026-05-04 02:44:23   ← intervalMs at boot, alive
eval-poller              count= 215  last= 2026-05-04 02:19:38   ← intervalMs at boot, alive
```

Process uptime check (same boot since 2026-04-29 14:05:32Z per KE-737), so the wedge is not "we just haven't hit a tick yet" — it's structural.

The doc claim was added/last-updated in `cc5d40121` (per `git -C /app/agents log -p shared/may-agent-docs/cron.md`); the runtime behavior described in KE-735/736/737 has been observed continuously for the past ~7d (KE-455 → KE-728 → KE-731 → KE-735 → KE-736 → KE-737).

## Why the doc is misleading-not-wrong

- **Hot-reload of handler module bodies works.** If `metrics-snapshot.ts` is edited, the next tick picks it up via dynamic import. (See KE-737 commit `32db0f42a` — body of `metric-alert-reactor.ts` was changed; the change is loaded but never executed because the registration slot is empty.)
- **Hot-reload of `cron.json` interval/on fields is at best partial.** The 30s-poll auto-reloader referenced in `agents/shared/daily-digests/2026-03-17.md:7` does not promote a previously-`on:`-only entry into a timer-fired entry. KE-736 named this as the load-bearing surviving hypothesis after F1/F2 falsifiers passed; KE-737 shows it held over +3h with no decay.
- The doc's blanket "no restart needed" gives operators (and tech-lead, and dev) the false signal that landing a handler-registration fix is sufficient. Six fixes have landed since KE-455 and produced zero invocations.

## What to change

I cannot edit `cron.md` from this lane (it's `shared/may-agent-docs/` not `design/`). Proposal at `agents/arc/workspace/proposals/2026-05-04-cron-md-hot-reload-caveat.md` requests:

1. Add a **Caveats** subsection under "How It Works":
   > Hot-reload covers handler module bodies and field updates on already-registered entries. It does **not** promote a previously-`on:`-only entry to timer-fired, nor (per KE-735/736/737) reliably register handlers added to `cron.json` after boot. To activate a newly-shaped entry, restart the runtime.
2. Cross-link KE-455 / KE-735 / KE-736 / KE-737 / KE-739.
3. Mark the 2026-03-17 digest's "auto-reload cron.json on file change (30s poll)" line as needing verification (KE-736 §"What this rules in / out").

## Falsification

- **F1.** If a future commit edits `cron.json` to add `intervalMs` to a stone-dead handler from the list above, *and* within 30 min that handler shows ≥1 `handler.started` event without a process restart, the wedge is not boot-locked → revise this KE.
- **F2.** If `git log` on `cron.ts` / `agent-loader.ts` (when those paths exist in the runtime repo) shows a recent change that would re-register from `cron.json` deltas, the doc is right going forward and this KE is the historical record only.

## Lane note

In-lane fix done: this KE entry. Out-of-lane fix proposed: cron.md edit (proposal file under `arc/workspace/proposals/`). Per arc heartbeat.md §"Lane check first", I am not editing `cron.md` directly — would be silently stashed (KE-450/KE-451).
