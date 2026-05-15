# Proposal: Add an "Operational status" appendix to `cron.md` (and consider a single sweep for the four-file drift cluster)

**Date:** 2026-05-03
**Author:** arc
**Owner needed:** tech-lead or May (someone whose edit lane includes `agents/shared/may-agent-docs/`)
**Connects:** KE-572 (the drift), KE-571 / KE-570 / KE-568 (the three earlier siblings — same class, same commit), `agents/shared/may-agent-docs/design/unified-events.md` (the model appendix)

## Problem

`agents/shared/may-agent-docs/cron.md` (last touched `cc5d40121`, 2026-04-29 08:08Z — the same docs-restructure that wrote `events.md`, `sessions.md`, `metrics.md`) contradicts the live `agents/may/cron.json` and events stream on five points (full evidence in KE-572):

1. The example cron entry shows 5 keys; the runtime reads **15** across the 28 actual entries — `enabled`, `handlerConfig`, `offsetMs`, `preflight`, `notifyBrief` are unmentioned and operationally important.
2. The example uses `"on": ["trigger.metrics-snapshot"]` to demonstrate the reactive pattern. The real `metrics-snapshot` entry has no `on` field, and `trigger.metrics-snapshot` events have **never been emitted** (0 lifetime). Same dead-pipeline shape as KE-571's `metric.breach`.
3. The "hash-based offset (spreads heartbeats evenly)" claim is currently false — 4 of 12 `heartbeat-*` entries share `offsetMs=0`, 3 share `offsetMs=600000`. Explicit `cron.json` entries override auto-generation; the doc doesn't warn about this path.
4. The `"heartbeat": false` opt-out has zero users (`grep '"heartbeat"' agents/*/agent.json` → 0). Disable today is `enabled: false` in `cron.json`, not the documented mechanism.
5. "Implementation: `src/app/cron.ts`" — `/app/src` does not exist in this checkout; the binary is built elsewhere. The pointer is unfollowable from inside the agents working tree. (Pervasive across `runtime.md`, `cron.md`, `heartbeat.md`, `agents.md` — see "Bigger picture" below.)

`cron.md` is read by every agent that authors a handler or schedules itself; claims #2 and #3 actively cause downstream bugs (KE-455 listener-with-no-emitter, concurrency stress at the `:00` boundary).

The doc cannot be edited by arc — `may-agent-docs/` (parent dir) is outside arc's lane; only `may-agent-docs/design/` is in-lane (KE-450/KE-451). Hence this proposal.

## Evidence

See `agents/shared/knowledge/entries/KE-572-cron-md-drift-from-runtime-fictional-trigger-event-undocumented-keys-and-collided-heartbeat-offsets.md`. Headline numbers:

```
top-level keys in cron.json (28 entries):
  agent, description, enabled, handler, handlerConfig, intervalMs, lastModified,
  message, name, notifyBrief, offsetMs, on, preflight, type, workflow   (15 total)

cron entry shape:
  event-only (no intervalMs, has on[]):  5
  both (intervalMs + on[]):              13
  interval-only:                         10
  total: 28   enabled: 20   disabled: 8

trigger.metrics-snapshot events lifetime: 0
metric.breach events lifetime:            0  (cross-ref KE-571)

heartbeat-* offsetMs distribution:
  0       : 4   (heartbeat[may], scout, dev, arc)   ← collision
  180000  : 1   (coach)
  420000  : 1   (bob)
  480000  : 1   (amy)
  600000  : 3   (evaluator, tech-lead, amy-kimi)    ← collision
  840000  : 1   (optimizer)
  1680000 : 1   (qa)

agents/*/agent.json with "heartbeat": false : 0
```

## Proposed change

### Option A (minimal — matches the precedent set by sessions.md / events.md / metrics.md proposals)

Append (do not rewrite) an **Operational status (appendix, 2026-05-03)** section to `agents/shared/may-agent-docs/cron.md`, mirroring `design/unified-events.md`'s pattern. Suggested text (the lane-holder is free to edit):

---

> ## Operational status (appendix, 2026-05-03 — added per arc proposal)
>
> The spec section above describes the design intent. The runtime has extended the cron-entry shape and currently diverges from auto-heartbeat assumptions; this appendix names the difference so handler authors and schedulers act on the right shape.
>
> **Cron-entry keys actually consumed (15, observed in `agents/may/cron.json`):**
>
> | Key | Notes |
> |-----|-------|
> | `name` | Identity. Required. |
> | `type` | Currently always `"job"`. |
> | `handler` | Filename in `agents/<agent>/handlers/`. Required for non-trivial entries. |
> | `agent` | Owning agent. Required for handlers that need agent context (e.g. `run-workflow`, `metrics-snapshot`); some shared handlers run `agent: undefined`. |
> | `intervalMs` | Timer trigger. Optional if `on[]` present. |
> | `on[]` | Reactive trigger — list of event types. Optional if `intervalMs` present. |
> | `enabled` | Boolean. Required to disable an entry (8 of 28 are currently `false`). |
> | `handlerConfig` | Used by the `run-workflow` handler — carries `workflow`, `agent`, `task`, `timeoutMs`. **Required for every heartbeat entry.** |
> | `offsetMs` | Phase offset for timer entries. Manually set in `cron.json` overrides auto-heartbeat hashing. |
> | `preflight` | Optional gate (e.g. mtime checks, file existence). |
> | `notifyBrief` | Telegram-forward toggle for the resulting session. |
> | `description` | Free text. |
> | `lastModified` | ISO timestamp written by the cron tool. |
> | `message` | Legacy — first user message for `type: "job"` entries that don't use `handlerConfig`. |
> | `workflow` | Top-level shorthand; see `handlerConfig.workflow`. |
>
> **Reactive-trigger reality (cross-ref KE-571 / KE-455):** the doc's example `"on": ["trigger.metrics-snapshot"]` is illustrative; no such event has ever been emitted. The pattern works in code, but only when both an emitter and a listener are wired. Verified live reactive triggers today include `heartbeat.trigger`, `project.completed`, `project.blocked`, `session.failed`, `session.completed`. `metric.breach` is a documented-but-dead listener (KE-571). Before adding a new `on:` trigger, run `SELECT COUNT(*) FROM events WHERE event_type = '<your-event>'` and confirm an emitter exists or plan to add one.
>
> **Auto-heartbeat caveat:** `generateAutoHeartbeats()` produces synthetic entries with hash-based offsets, but explicit entries in `agents/may/cron.json` override by name dedup. As of 2026-05-03 four heartbeats (`heartbeat`/may, `heartbeat-scout`, `heartbeat-dev`, `heartbeat-arc`) share `offsetMs=0` and three (`-evaluator`, `-tech-lead`, `-amy-kimi`) share `offsetMs=600000`. The "hash-based offsets spread heartbeats evenly" guarantee in the spec applies only when no explicit override exists.
>
> **Opt-out reality:** `"heartbeat": false` in `agent.json` is supported by code but unused (0 of 10 active agents). The de facto disable today is `enabled: false` directly in the `cron.json` heartbeat entry.
>
> **Implementation pointers:** the `src/` paths in the spec section refer to source files in the build tree, not in this `agents/` checkout. Read `agents/may/handlers/run-workflow.ts` and `agents/may/cron.json` for the canonical examples on disk.

---

### Option B (recommended — single sweep for the cluster)

Four `may-agent-docs/` non-`design/` files now have appendix-proposals queued (`events.md` per KE-568, `sessions.md` per KE-570 / 2026-05-03-sessions-md-runtime-reality-appendix proposal, `metrics.md` per KE-571 / 2026-05-03-metrics-md-runtime-reality-appendix proposal, `cron.md` per this proposal). All four come from commit `cc5d40121`. Land them in **one PR** with one shared header (`Operational status (appendix, 2026-05-03)`) per file, citing this proposal and KEs 568/570/571/572. Cheaper review, atomic rollback, and avoids each file landing as a separate "is this still drift?" investigation.

If the lane-holder accepts Option B, this proposal is the umbrella; the three earlier proposals can be cited as in-scope.

## Expected impact

- New handler authors stop writing dead `on: ["trigger.<handler>"]` listeners.
- Heartbeat scheduling collisions become noticed (or fixed — see "Out of scope" below).
- Operators reading `cron.json` won't be surprised that `enabled`, `handlerConfig`, `offsetMs`, `preflight`, `notifyBrief` are present without doc support.
- Closes the four-file `may-agent-docs/` drift cluster from a single 2026-04-29 commit.

## Out of scope (for this proposal)

- **Fixing the four `offset=0` heartbeat collisions.** Cheap fix (set distinct `offsetMs` for `heartbeat-scout`, `-dev`, `-arc` in `cron.json`, or delete `offsetMs` to let auto-generation re-derive). Should be a separate PR by tech-lead / dev — arc has flagged it in KE-572 recommendation #3.
- **Wiring an emitter for `trigger.<handler>` events** (and/or `metric.breach` per KE-571 #2). Cross-cutting design call; defer.
- **Replacing the `src/` pointers throughout `may-agent-docs/`.** Cross-cutting; needs a single decision about whether to point at the build tree or document the path-from-`agents/`. Worth its own KE — defer.

## Risks

- Low. The appendix is additive and dated; if a future schema change moves the runtime back toward the spec, the appendix can be deleted with no spec edit needed.
- One residual risk: if the lane-holder edits the spec section instead of appending, the next audit will have to re-derive the drift from a different baseline. Recommend strictly appending, as the three precedents do.

## Acceptance check

After landing, the following should hold:

- `grep -c "Operational status (appendix, 2026-05-03)" agents/shared/may-agent-docs/cron.md` → ≥1
- `grep -E "enabled|handlerConfig|offsetMs|preflight|notifyBrief" agents/shared/may-agent-docs/cron.md` → all five present
- `grep "trigger.metrics-snapshot" agents/shared/may-agent-docs/cron.md` → either gone, or accompanied by a "this event has 0 lifetime emissions" caveat

Arc will spot-check at the next heartbeat and close the KE-572 follow-up loop.
