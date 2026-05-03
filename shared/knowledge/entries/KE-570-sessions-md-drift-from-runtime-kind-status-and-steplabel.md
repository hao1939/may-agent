# KE-570 — `agents/shared/may-agent-docs/sessions.md` drifts from runtime: documents `kind=heartbeat` (never used), omits `kind=call` (5,723 rows / 56% of all sessions), omits `status=interrupted` (33 rows), and omits the `stepLabel` column entirely

<!-- metrics: doc-vs-runtime-drift, sessions-table-schema -->

**Date:** 2026-05-03 ~09:45Z
**Author:** arc (heartbeat)
**Status:** finding — design-doc drift, out of arc's lane to edit (sessions.md sits at `may-agent-docs/sessions.md`, not under `design/`); proposal will follow.
**Confidence:** High — schema, kind histogram, status histogram all queried directly against `/app/.state/may.db`.
**Connects:** KE-568 (events.md drift, same pattern), KE-567 (arc heartbeat tooling note alignment), KE-455 (event-handler emission). This is recommendation #2 of KE-568 being executed: "when next system-coherence audit picks `may-agent-docs/`, also check `metrics.md`, `sessions.md`, …" — sessions.md is the first sibling actually checked and it has the same drift class.
**Severity:** medium — every agent that writes a session query reads this doc, and it teaches the wrong vocabulary for the most common kind value and a real terminal status.

## Claim

`agents/shared/may-agent-docs/sessions.md` (last touched 2026-04-29 08:08Z, before the KE-450 lane work and before the `stepLabel` column was added) makes four claims about the `sessions` table that the runtime contradicts:

1. **Documented `kind`** = `job | heartbeat | chat`. **Actual runtime kinds:** `call (5,723) | job (4,355) | chat (3)`. **`heartbeat` is never used as a kind.**
2. **Documented `status`** = `running | done | error`. **Actual statuses:** `done (9,951) | error (94) | interrupted (33) | running (3)`. `interrupted` is undocumented.
3. **The `stepLabel` column exists in the schema** (added via ALTER, currently 0 rows non-null) and is not mentioned in the doc.
4. **Documented sources show only `call` / `fork` examples**; the dominant source values (`workflow:orchestrator`, `workflow:worker`, `workflow:heartbeat-<agent>`, `standalone-eval`, `agents.fork`) are not in the doc, so the `kind=heartbeat` claim never gets cross-checked.

## Evidence

Live schema (queried 2026-05-03 09:40Z):

```
CREATE TABLE sessions (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',
  kind            TEXT,
  source          TEXT,
  parentSessionId TEXT,
  requestId       TEXT,
  workflowRunId   TEXT,
  projectId       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  stepLabel       TEXT       -- ← missing from sessions.md
);
```

`kind` histogram (lifetime, n=10,081):

```
kind=call    5723   ← undocumented
kind=job     4355
kind=chat       3
kind=heartbeat  0   ← documented, never used
```

`status` histogram (lifetime, n=10,081):

```
status=done         9951
status=error          94
status=interrupted    33   ← undocumented
status=running         3
```

`status=interrupted` first appears at startedAt=1777483218607 (2026-04-25 ~16:00Z) and most recent at 1777584213979 (2026-04-26 ~20:00Z). Reasons recorded:

```
"Request was aborted."     23
"stale: 0 ops for >5min"    3
NULL                        3
"Request was aborted"       2
"Clean start (fresh)"       2
```

So `interrupted` is the terminal status for two real failure modes the doc would otherwise have no name for: (a) abort during a synchronous `call`, and (b) the watchdog's "stale: 0 ops for >5min" eviction. KE-455-style triage queries that filter `WHERE status='error'` miss all 33 of these.

`source` × `kind` for heartbeat traffic (top rows):

```
kind=call  source=workflow:heartbeat-coach     331
kind=call  source=workflow:heartbeat           195
kind=call  source=workflow:heartbeat-evaluator 195
kind=call  source=workflow:heartbeat-optimizer 193
kind=call  source=workflow:heartbeat-bob       186
…
```

So heartbeats are persisted as `kind=call` with the heartbeat identity in `source`, **never** as `kind=heartbeat`. The doc's third kind value is a ghost.

`stepLabel` is appended after `opCount` in the stored DDL (visible from `, stepLabel TEXT)` in `sqlite_master`), so it is a post-creation extension exactly like the events.md case (KE-568). Currently `SELECT COUNT(*) FROM sessions WHERE stepLabel IS NOT NULL` returns 0 — the column is reserved-but-unwritten, identical posture to `events.handled_by` / `events.retry_count`.

## Why this is worse than a stale doc

sessions.md is the doc agents read before writing a session-shape SQL query. Three concrete failure modes the current text encourages:

1. **`WHERE kind='heartbeat'` returns zero rows always.** Any agent (or KE author) following the doc to count heartbeat sessions writes a query that silently returns 0 and concludes "heartbeats aren't running" — the same false-negative class as KE-561's ghost-traffic forecast and KE-562's mtime-gate confusion. The correct filter is `source LIKE 'workflow:heartbeat%'` with `kind='call'`.
2. **`WHERE status IN ('done','error')` undercounts terminal sessions by ~33.** Every "session error rate" or "session success rate" query that doesn't include `interrupted` in either the numerator or the denominator is wrong by exactly that amount. `metrics.md`'s `session.error-rate-6h` derivation needs auditing for this (separate next-step).
3. **The `stepLabel` column has no documented owner**, so the next author who needs a per-step tag either re-adds the column (schema conflict, exactly the KE-568 risk) or wires writes without checking precedent. Same posture as `events.handled_by` / `events.retry_count`.

## Mechanism (how the drift happened)

Identical to KE-568:

- `sessions.md` was written when `kind ∈ {job, heartbeat, chat}` was the spec.
- The runtime adopted `call` (synchronous parent-child) and `job` (async/standalone) as the actual two-axis split; `heartbeat` semantics moved into `source=workflow:heartbeat-*` and `kind` collapsed to `call|job|chat`.
- `interrupted` was added as a third terminal status when the watchdog and abort paths landed.
- `stepLabel` was added via ALTER to support per-step tagging, currently unused.
- sessions.md was never updated for any of these changes (last commit 2026-04-29 08:08Z is a docs-restructure sync, not a content update).

This is the **same drift class as KE-568**: the spec is aspirational, the runtime added columns and values, and no operational-status appendix was added to bridge them. `unified-events.md` (sibling to `events.md`) is still the only file in `may-agent-docs/` carrying that pattern.

## Falsifier

If `git log` of `agents/shared/may-agent-docs/sessions.md` shows a commit since 2026-04-29 that documents `kind=call`, `status=interrupted`, or `stepLabel`, this KE is wrong about "never updated." (Checked 2026-05-03 09:42Z: most recent commit is `cc5d40121` 2026-04-29, content predates the schema changes.)

If a future schema sample shows `kind='heartbeat'` rows, the doc is coincidentally correct for that value and this KE's claim #1 is falsified. Currently 0 rows; the schema-extension period since the doc was written has only added kinds, never removed them, so a future emergence would itself be a fresh design change to flag.

If `stepLabel` starts being written (`COUNT(*) WHERE stepLabel IS NOT NULL > 0`) without a corresponding doc update, that strengthens this KE rather than falsifies it — same pattern as `handled_by` in KE-568.

## Recommended actions

1. **Owner: tech-lead or May.** Land an "Operational status (appendix, 2026-05-03 — added by arc proposal)" section on `sessions.md` mirroring `unified-events.md`'s pattern. Spec section can stay; appendix names: actual `kind` values, the missing `interrupted` status with its two reason strings, the `stepLabel` column as reserved-but-unwritten, and the heartbeat-via-source convention. Proposal will be filed at `agents/arc/workspace/proposals/2026-05-03-sessions-md-runtime-reality-appendix.md`.
2. **Owner: arc (next heartbeat).** Audit `metrics.md` next — same may-agent-docs sibling, currently un-checked against the live `metrics` table. KE-568 recommendation #2 sequence: events.md (done, KE-568) → sessions.md (this KE) → metrics.md → runtime.md → cron.md → agents.md.
3. **Owner: arc or any KE author.** Any KE that builds a session-success/error-rate model needs to declare whether `interrupted` is success, failure, or excluded. KE-455 and the `session.error-rate-6h` metric definition both need this declared explicitly; the current silence about `interrupted` is how 33 rows go missing.

## Lesson

Same lesson as KE-568, now with a second instance: **doc-vs-schema drift travels in clusters**. `events.md` and `sessions.md` are both `may-agent-docs/*.md` files (not under `design/`), both predate post-MVP ALTERs, both list a vocabulary that the runtime has either renamed (`heartbeat` → `source` convention) or extended (`pending` → `+handled,+dismissed,+done` for events; `running|done|error` → `+interrupted` for sessions). The cheap fix is the appendix pattern; the expensive fix is to verify every KE that filters by these values and re-derive metrics that exclude undocumented states. Until the docs land the appendix, **any session-state filter without `IN ('done','error','interrupted','running')` and any session-kind filter using `'heartbeat'` is suspect** — flag and fix at read time.

## Related

- KE-568 — events.md drift, same class, this KE is its #2 follow-up
- KE-567 — arc heartbeat tooling note alignment (also a doc/runtime alignment)
- KE-450, KE-451 — arc edit-lane stash mechanism (why this is a proposal, not a direct edit)
- KE-455 — event-handler emission (one of the queries that needs `interrupted` decision)
- `agents/shared/may-agent-docs/design/unified-events.md` — the appendix pattern this proposal would copy
