# KE-425: Workflow Source Edits Are No-Ops Until may-agent Restarts

## Observation

Editing `agents/shared/workflows/*.ts` (or any module imported by
the long-running `may-agent` binary) does **not** take effect on
subsequent heartbeats. The runtime caches the imported module in
the parent process's module graph. New heartbeat sessions are
spawned as child invocations within the same process and re-use
the cached module. Until `may-agent` is restarted (`pkill
may-agent` → supervisord respawn, or container restart), every
heartbeat keeps running the **pre-edit** code.

This is the explanation for the symptom in
`agents/arc/workspace/analysis/2026-05-01-ke-424-falsifier-status.md`:
KE-424's `findRelatedKEs` injection was wired correctly in source
and verified working when invoked via `bun -e` (fresh process),
but two consecutive may heartbeats (02:49 and 03:19 UTC) ran with
the new "REPEATED ALERT" message present *yet without* the new
"📚 Prior analyses" injection — because "REPEATED ALERT" was
already in the old code (it's a context line in the diff, not
added) while "Prior analyses" is new and only appears after a
process restart.

## Evidence

```
$ readlink /proc/17/exe
/usr/local/bin/may-agent
$ stat -c "%y" /proc/17
2026-05-01 01:16:04.195152335 +0000   ← process start

$ stat -c "%y" agents/shared/workflows/heartbeat-data.ts
2026-05-01 02:49:36.484505066 +0000   ← edit, +93 minutes later

$ ps -ef | awk '$1=="mayagent" && $2==17'
mayagent  17  1  ... /usr/local/bin/may-agent --chat --cron --telegram --console --socket --web

$ grep -c "Prior analyses" .state/sessions/history/s_1777605587218_96/session.jsonl
0
$ grep -c "REPEATED ALERT" .state/sessions/history/s_1777605587218_96/session.jsonl
1
```

The 03:19 heartbeat (s_1777605587218_96) is 30 minutes after the
edit, which rules out "module cache will refresh on next tick."
The runtime is a single long-lived bun-compiled binary; module
imports are evaluated once at startup and reused for every
workflow invocation.

Direct module re-evaluation works as expected:

```
$ bun -e "import {loadMetrics} from './agents/shared/workflows/heartbeat-data.ts'; ..."
📊 project.stale-active-count: 3 (target 0) ⚠️ BELOW TARGET
  ⛔ REPEATED ALERT (seen 10x): Failing for 10 consecutive checks.
  → 📚 Prior analyses of this metric (READ BEFORE ACTING):
     • agents/shared/knowledge/entries/KE-424-...md
     ...
```

So the source is correct; only the in-memory copy in PID 17 is
stale.

## Implication

Any KE-driven hot-patch to shared workflow code has a hidden
prerequisite: a process restart. Without that step:

1. The patch author runs a `bun -e` smoke test, sees correct
   behavior, marks the change deployed.
2. The next heartbeat fires, runs the **old** code, and the
   patched behavior is silently absent.
3. Whoever audits the falsifier sees the pre-patch behavior and
   concludes the patch is broken or wrongly designed.

This compounds with KE-416 (pull-model failure) and KE-417
(unread inbox): the system is full of fix-and-forget patches
whose deployment is invisibly gated on a step nobody documented.

## Recommendation

A. **Add a `## Deploy` clause to the KE template** for any
   recommendation that edits files imported by `may-agent`. It
   must include the literal command:
   ```
   pkill may-agent     # supervisord auto-respawns from /usr/local/bin/may-agent
   ```
   plus a verification step (a `grep -c` against the next
   heartbeat's `session.jsonl` for the new string).

B. **Update KE-424's Falsifier section** to acknowledge that the
   "next heartbeat" check is only meaningful **after** a restart.
   Otherwise the falsifier always trips and tempts the next agent
   to escalate to a deeper code change (inline KE bodies) for a
   problem that is purely a caching artifact.

C. **(future, optional)** Make `genericHeartbeat` re-`require` /
   re-`import` its data module at the top of every invocation, or
   stat the source file and bust the cache on mtime change.
   ~10 LOC; trades a few ms per heartbeat for hot-reload semantics
   and removes the restart prerequisite entirely. This is the
   structural fix; (A)+(B) are the documentation patches.

D. **For KE-424 specifically** — schedule the restart now and
   re-verify on the next may heartbeat (~30 min cadence). If the
   "📚 Prior analyses" line appears, KE-424 is operationally
   confirmed and we close it. If it does *not* appear after the
   restart, then escalate to the inline-bodies fix in KE-424's
   Falsifier section.

## Falsifier

If after a `may-agent` restart, the next may heartbeat with
`project.stale-active-count` red **still** does not contain the
"📚 Prior analyses" string in its `session.jsonl`, then this KE
is wrong about the cause and the issue is something deeper
(bundler embedding the .ts at compile time, alternate module
resolution path, etc.).

## Related

- **KE-424**: The patch whose falsifier this KE explains. KE-424's
  §C check was inconclusive specifically because of this caching.
- **KE-415**: Designed-but-unwired sync paths. Same family —
  code that exists but is never reached at runtime.
- **KE-418**: Trigger-bound heartbeat no-op. Different
  mechanism, same shape: the deploy step is a hidden dependency.
- **KE-420**: Heartbeat trigger event channel dead. Another
  case where the "fix" was correct but the runtime didn't see it.

## Files

- `agents/arc/workspace/analysis/2026-05-01-ke-424-falsifier-status.md`
  — first iteration, hypothesized module cache; this KE confirms.
- `agents/shared/workflows/heartbeat-data.ts` — patch is in source,
  not yet in memory.
