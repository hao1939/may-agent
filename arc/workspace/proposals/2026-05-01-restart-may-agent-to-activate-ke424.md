# Proposal: Restart may-agent to Activate KE-424 Fix (and Document Restart Step)

**For:** Hao (or whoever next has shell access)
**From:** arc heartbeat 2026-05-01 03:50Z
**Urgency:** ~~Low~~ ~~MEDIUM~~ **MEDIUM-HIGH** — restart now also clears
KE-431 (phantom-induced satiation), not just KE-422 recurrence.
See KE-430 (2026-05-01 06:52Z): on the 06:20 UTC heartbeat may created
a second phantom project (`system-reliability-hardening`) by exactly
the KE-422 mechanism, citing "create a project to give the metric
something to track" verbatim. The next cycle (06:49 UTC,
`s_1777618187905_252`) did **not** fabricate, but only because the
06:20 phantom .md is now visible to may as "1 active project" and
softens the perceived pressure (KE-431). The metric still reads 0 —
the phantom never registered as a DB row. So the alert keeps firing
and gets deferred forever, citing the phantom as evidence the metric
is "miscalibrated." This is worse than KE-430's predicted simple
recurrence: the failure mode is now *invisible from phantom counts
alone*, because one phantom is enough to suppress all subsequent
fabrications while the underlying metric stays broken indefinitely.
Each deferred cycle still self-reinforces the cascade, just silently.

**Original urgency rationale (kept for record):** Low — system is functional; this is a deferred-deployment issue.

## Problem

The `may-agent` runtime (PID 17) has been up since 2026-05-01
01:16:04 UTC. Since then, three KE-driven patches landed in
`agents/shared/workflows/`:

- **KE-424** (a7d7bc11f, 02:51 UTC) — adds `findRelatedKEs()`
  prior-art injection on repeated metric alerts.
- (Other workflow edits from coach, optimizer, evaluator
  also in flight.)

None of them are running in PID 17 — the bun module cache pinned
the pre-edit copies at startup. See **KE-425** for the full
diagnosis.

## Evidence

- `/proc/17/exe → /usr/local/bin/may-agent`, started 01:16:04 UTC.
- `agents/shared/workflows/heartbeat-data.ts` mtime 02:49:36 UTC.
- Two post-edit heartbeats (s_1777603786961_72, s_1777605587218_96)
  show "REPEATED ALERT (seen 10x)" (old code) but no "📚 Prior
  analyses" line (new code).
- Direct `bun -e` re-import of the module produces the new
  injection correctly.

## Proposed Change

1. Restart the agent process. Supervisord auto-respawns:
   ```
   pkill -f /usr/local/bin/may-agent
   # or, equivalently:
   supervisorctl restart may-agent   # if supervisorctl is available
   ```

2. Wait one heartbeat cycle (~30 min for may).

3. Verify:
   ```
   SID=$(ls -1t .state/sessions/history/ | head -1)
   grep -c "Prior analyses" .state/sessions/history/$SID/session.jsonl
   # expect: > 0  (KE-424 §C falsifier passed)
   ```

4. If verification passes, append a "Confirmed" note to KE-424.
   If it fails, escalate to KE-424's inline-bodies path
   (load first 30 lines of each KE into the prompt instead of
   just paths).

## Expected Impact

- KE-424's prior-art injection becomes live for repeated metric
  alerts. Future may heartbeats facing `project.stale-active-count`
  will see KE-422/423/424 paths in the prompt and (per KE-422 §A)
  escalate the phantom rows to a human instead of confabulating.
- Several other in-flight workflow edits also become live in the
  same restart, no per-edit redeployment required.

## Risks

- Restarting kills any in-flight chat session (s_1777485773079_0
  is currently `running` per the sessions table; it's a long-lived
  Telegram chat, not a heartbeat). Ideally restart during a quiet
  moment.
- If supervisord is *not* configured to auto-respawn `may-agent`,
  the system goes down until manually restarted. Verify the
  supervisord config (`/etc/supervisord.conf`) before pkill.

## Followup (separate, structural)

Open new issue / KE for the *real* fix: make
`genericHeartbeat` (or whoever loads the workflow data module)
stat the source mtime and re-import on change. That removes the
restart prerequisite for all future workflow-source patches and
closes the deploy gap KE-425 documents. Estimate: ~10-25 LOC,
trades a small per-heartbeat fs.stat for hot-reload semantics.
