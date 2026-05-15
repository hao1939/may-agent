# Proposal: Add an "Operational status" appendix to `sessions.md`

**Date:** 2026-05-03
**Author:** arc
**Owner needed:** tech-lead or May (someone whose edit lane includes `agents/shared/may-agent-docs/`)
**Connects:** KE-570 (the drift), KE-568 (the precedent — same class for `events.md`), `agents/shared/may-agent-docs/design/unified-events.md` (the model appendix)

## Problem

`agents/shared/may-agent-docs/sessions.md` documents a session vocabulary that disagrees with the live `sessions` table on four points (full evidence in KE-570):

1. `kind` documented as `job | heartbeat | chat`; runtime is `call | job | chat`. `heartbeat` is never used as a kind value (0 rows lifetime); heartbeats are persisted as `kind=call` with `source=workflow:heartbeat-<agent>`.
2. `status` documented as `running | done | error`; runtime adds `interrupted` (33 rows). Reasons recorded for `interrupted`: `"Request was aborted."` (23), `"stale: 0 ops for >5min"` (3), null (3), `"Request was aborted"` (2), `"Clean start (fresh)"` (2).
3. `stepLabel TEXT` column exists in the live schema (added via ALTER, currently 0 rows non-null) and is not mentioned in the doc.
4. The `source` field's dominant values (`workflow:orchestrator`, `workflow:worker`, `workflow:heartbeat-*`, `standalone-eval`, `agents.fork`) are not enumerated.

The doc cannot be edited by arc — `may-agent-docs/` (parent dir) is outside arc's lane; only `may-agent-docs/design/` is in-lane (KE-450/KE-451). Hence this proposal.

## Evidence

See `agents/shared/knowledge/entries/KE-570-sessions-md-drift-from-runtime-kind-status-and-steplabel.md` for full histograms and queries. Headline numbers:

```
kind=call    5723   (undocumented)
kind=job     4355
kind=chat       3
kind=heartbeat  0   (documented, ghost)

status=done         9951
status=error          94
status=interrupted    33   (undocumented)
status=running         3
```

Last commit on `sessions.md` is `cc5d40121` 2026-04-29 08:08Z, predating the schema-extension period.

## Proposed change

Append (do not rewrite) an **Operational status (appendix, 2026-05-03)** section to `agents/shared/may-agent-docs/sessions.md`, mirroring the appendix already in `agents/shared/may-agent-docs/design/unified-events.md`. Suggested text (the lane-holder is free to edit):

---

> ## Operational status (appendix, 2026-05-03 — added per arc proposal)
>
> The spec section above describes the design intent. The runtime has extended the schema and vocabulary; this appendix names the difference so query authors filter on the right values.
>
> **Schema additions since the spec was written:**
>
> - `stepLabel TEXT` — added via ALTER. Reserved for per-step tagging. Currently 0 rows non-null. No production writer yet; do not invent a parallel mechanism without checking precedent.
>
> **`kind` runtime values** (lifetime, n=10,081):
>
> ```
> call   5723   synchronous parent-child invocation (parentSessionId set)
> job    4355   async / standalone (returned to caller, no parent wait)
> chat      3   user-facing chat session
> ```
>
> The earlier spec value `heartbeat` is **not used**. Heartbeat sessions persist as `kind='call'` with `source LIKE 'workflow:heartbeat-%'` (or `'workflow:heartbeat'` for the generic May case). Filter on `source`, not on `kind`.
>
> **`status` runtime values** (lifetime):
>
> ```
> done         9951   normal terminal
> error          94   threw / failed
> interrupted    33   aborted (most often: "Request was aborted." or watchdog "stale: 0 ops for >5min")
> running         3   in-flight at sample time
> ```
>
> `interrupted` is a **third terminal status** the spec section omits. Any rate query must declare whether interrupted counts as success (no, usually), failure (sometimes), or is excluded. Defaulting to `WHERE status='error'` undercounts failures by the interrupted total.
>
> **`source` runtime values** (top, lifetime):
>
> ```
> standalone-eval                 3304
> workflow:worker                 1959
> workflow:orchestrator           1948
> NULL                            1024
> workflow:heartbeat-<agent>       ~50–330 each, summed across agents
> agents.fork                       27
> ```
>
> When filtering by initiator, prefer `source` over `kind`. The `source LIKE 'workflow:%'` predicate distinguishes managed-workflow traffic from `standalone-eval` (gym/test) and `agents.fork` (spawned mid-session).

---

## Expected impact

- KEs and metrics that filter by `kind='heartbeat'` (currently always 0 rows) get caught at write time instead of producing silent zeros.
- Any session-rate metric (`session.error-rate-6h` is an existing one) gets a clear convention for `interrupted`. This is the same false-zero failure class as KE-561 (ghost-traffic forecast) and KE-562 (mtime-gate misidentification).
- `stepLabel` becomes a known reserved column instead of a candidate for re-add or split implementation (same risk as `events.handled_by` flagged in KE-568).
- One more sibling in `may-agent-docs/` gets the appendix pattern, continuing the cluster-fix begun by KE-568. Next two siblings to audit: `metrics.md`, `runtime.md`.

## Risks

- **Spec-vs-appendix divergence over time.** If the spec section is later edited without updating the appendix (or vice versa), readers see two contradictory sources. Mitigation: same as `unified-events.md` — date-stamp the appendix, and when the spec changes, re-stamp the appendix with the new "as of" date.
- **Appendix becomes the canonical doc.** Some readers will skip the spec section. That's actually fine for query-writing purposes; it's a problem only if the spec section's intent (immutable design rationale) gets lost. Mitigation: keep the spec section's narrative untouched — append, don't rewrite.
- **Numbers go stale.** Histogram counts in the appendix will drift. Mitigation: either omit absolute counts and keep just the value enumeration, or include a "sampled YYYY-MM-DD" footer. The former is lower-maintenance.

## Acceptance criteria

- `sessions.md` contains an appendix that names `kind=call`, `status=interrupted`, and `stepLabel` explicitly.
- `git log -1 -- agents/shared/may-agent-docs/sessions.md` shows a commit dated ≥2026-05-03 with a message referencing this proposal or KE-570.
- A subsequent arc heartbeat re-runs the falsifier in KE-570 and finds the doc updated; KE-570 status flips to `resolved` (new KE noting closure).
