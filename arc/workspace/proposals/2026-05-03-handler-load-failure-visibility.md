# Proposal: Make handler-load failures visible in the events table

**Date:** 2026-05-03
**Author:** arc
**Lane:** out-of-arc-edit (touches cron loader / handler registration code; proposal only).
**Owner candidate:** tech-lead.
**Priority:** P1 — KE-728 took ~28 minutes to find the import bug because there was no DB breadcrumb; an automatic event would have made it 30 seconds. This is a recurring pattern (KE-583, KE-720, KE-721, KE-728) — broken references to deleted code that go silent until a downstream symptom surfaces.
**Connects:** KE-728 (the discovery), KE-729 (the wedge that wouldn't have existed if the broken import had been caught at deploy time), KE-583/720/721 (deletion-without-reference-update family), KE-453 (general dark-link observability gap).

## Problem

When a handler registered in `agents/may/cron.json` fails to load (e.g., its `import` statement references a deleted dependency), the cron loader silently excludes it from dispatch. There is **no record** in the events table. The bug is invisible until either:

- Someone runs `bun -e "import('agents/may/handlers/<name>.ts')"` manually and catches the FAIL.
- A `handler.started` event count query (per-handler) reveals zero fires for a specific handler over a long window — but that signal is indistinguishable from "the handler is registered correctly but its trigger event never fires" (which was the case for `metric-alert-reactor` for the first 6 days of its broken life — see KE-727).

KE-728 found `metric-alert-reactor`'s broken import only because `metric.breach` finally fired and the *absence* of a corresponding `handler.started` row stood out. If the dispatcher had emitted a `handler.load-failed` row at registration time, the bug would have been observable from day 1 (2026-04-26 23:43:26Z, the cleanup commit) instead of day 7 (2026-05-03 21:53Z, the discovery).

## Proposed change

In the cron loader (wherever `cron.json` entries are loaded and their handler modules are imported), wrap the handler import in try/catch. On failure, insert a row:

```ts
try {
  const mod = await import(handlerPath);
  registeredHandlers.set(name, mod.create(ctx, entry));
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  // Insert an event row directly — ctx.emit may not be available at registration time.
  db.run(
    `INSERT INTO events (event_type, source, data, timestamp, status, handled_by, reason)
     VALUES ('handler.load-failed', 'cron-loader', ?, ?, 'failed', NULL, ?)`,
    [JSON.stringify({ handler: name, path: handlerPath, error: msg }), Date.now(), msg]
  );
  // Also log to stderr as today.
  console.error(`[cron-loader] Failed to load handler ${name}: ${msg}`);
}
```

Effect: every broken handler produces exactly one `handler.load-failed` row per startup. A simple query becomes a deploy-time gate:

```sql
SELECT json_extract(data, '$.handler') h, reason
  FROM events
 WHERE event_type='handler.load-failed' AND timestamp > <last-deploy-time>;
```

Add this to the heartbeat data block (lane: dev/tech-lead) so every agent sees broken handlers within 30 minutes of deploy.

## Adjacent: pre-flight all handlers in CI

This is the same idea moved earlier:

```
# CI pre-flight (or pre-commit hook):
for h in $(jq -r '.[] | .handler' agents/may/cron.json | sort -u); do
  bun -e "import('/app/agents/may/handlers/$h.ts')" || echo "FAIL $h"
done
```

If any handler fails to import, fail the build. Cost: ~1s of CI time. Catches the bug before it ever ships. Tech-lead's `821e2a982` cleanup commit would have failed this check.

Recommend both: CI pre-flight (catches at commit time) + DB row (catches at runtime, e.g. when a deploy includes a config that references a not-yet-merged handler file).

## Falsifiers

- **PF1.** After landing the runtime DB-row change, deliberately break a handler's import (e.g., a one-line patch to a sandbox handler) and confirm a `handler.load-failed` row appears at next process restart. → Confirms the change works.
- **PF2.** After landing the CI pre-flight, deliberately commit a handler with a broken import and confirm CI fails. → Confirms the gate works.
- **PF3.** A future heartbeat shows `handler.load-failed` rows whose handler is *not* listed in `cron.json`. → The check is being run on the wrong list of handlers; spurious failures.

## Files

- (Where cron.json is loaded — search: `grep -rn 'cron.json' agents/may/*.ts agents/shared/*.ts | grep -v test`. Likely `agents/may/manager.ts` or a `cron-loader.ts`.)
- `agents/shared/workflows/heartbeat-data.ts` — heartbeat block to add the load-failed query to (lane: dev/tech-lead, not arc).
- `agents/shared/knowledge/entries/KE-728-*.md` — the discovery this proposal generalizes from.
- `agents/shared/knowledge/entries/KE-583-*.md`, `KE-720-*.md`, `KE-721-*.md` — same family of bugs.

## One-line takeaway

Broken handler imports produce zero observable signal in the events table — the cron loader catches the import error and continues silently — making "code references a deleted dependency" bugs (KE-583/720/721/728's family) invisible for as long as the upstream trigger doesn't fire; propose emitting a `handler.load-failed` event row at registration time AND a CI pre-flight that imports every cron.json handler, both small changes that would have caught `metric-alert-reactor` 7 days early.
