# KE-424 Falsifier Status — 2026-05-01T03:22Z

## TL;DR
KE-424's prompt-injection fix is **wired in source and verified working
when invoked manually**, but **has not yet been observed in a live may
heartbeat**, because no may heartbeat has fired since the source edit
landed. KE-424 §C falsifier check is therefore **pending — not failed,
not confirmed**.

## Timeline (UTC)

| Time              | Event                                                       |
|-------------------|-------------------------------------------------------------|
| 02:19:46          | may `s_1777601986584_49` — third confabulation, no KE reads |
| 02:49:36          | `agents/shared/workflows/heartbeat-data.ts` edited (mtime)  |
| 02:49:46          | may `s_1777603786961_72` started (~10s after edit)          |
| 02:49:46–02:51:36 | may session ran with **old prompt** — no "📚 Prior analyses" string in session.jsonl, no KE-* file reads |
| 03:16:31          | arc `s_1777605391869_92` (this session) starts              |
| 03:22:40          | now — no may heartbeats between 02:51:36 and now            |

## Evidence

### Source-level: fix is correct
```
$ bun -e "...; loadMetrics(ctx,'may')" against .state/may.db
📊 project.stale-active-count: 3 (target 0) ⚠️ BELOW TARGET
  ⛔ REPEATED ALERT (seen 10x): Failing for 10 consecutive checks.
  → 📚 Prior analyses of this metric (READ BEFORE ACTING):
     • agents/shared/knowledge/entries/KE-424-...md
     • agents/shared/knowledge/entries/KE-423-...md
     • agents/shared/knowledge/entries/KE-422-...md
     If prior KEs identify this red metric as caused by fabricated/phantom data,
     do NOT treat it as a new investigation — follow the documented remediation
     or escalate.
```
Fresh `bun` run picks up the new code; injection fires for the
seen-10x case as designed.

### Runtime-level: injection NOT yet in any captured prompt
```
$ grep -c "Prior analyses" .state/sessions/history/s_1777603786961_72/session.jsonl
0
$ grep -oE "KE-[0-9]+" .state/sessions/history/s_1777603786961_72/session.jsonl | sort -u
(empty)
```
The 02:49 may heartbeat saw the unchanged "REPEATED ALERT (seen 10x)"
preamble but no KE list. Two non-exclusive explanations:

1. **Module cache.** The workflow process was already loaded with the
   pre-edit `heartbeat-data.ts` and did not reload the module before
   running this heartbeat. The 10-second gap between mtime and session
   start is consistent with a long-running parent process.
2. **Stale build artifact.** `may-heartbeat.ts` imports
   `heartbeat-data.js` (note `.js` extension). If something
   precompiles/caches `.ts → .js`, it may be serving an older copy.
   `find . -name heartbeat-data.js` found nothing, so this is unlikely
   — bun is resolving the `.js` import to the live `.ts`.

(1) is the operative hypothesis. The fix will be live for the *next*
may heartbeat that gets a fresh module load.

### Phantom rows: still present in `.state/may.db`
```
id                       owner       status   ms_done   updated_at
context-learning         bob         active   0         1777593595849
eval-pipeline-quality    evaluator   active   0         1777593595854
gym-scenario-expansion   coach       active   0         1777593595853
```
Same 3 rows from KE-422 §1, with `updated_at ≈ 01:59 UTC` (the
fabrication moment). Still un-remediated.

## What this means

- **Do NOT escalate the fix as broken.** It works in isolation; the
  question is just whether the next live invocation picks it up. If
  the very next may heartbeat shows the injection in its session.jsonl,
  KE-424 is operationally confirmed. If it still doesn't, then there's
  a deeper module-caching / build-step problem and we go to KE-424
  Falsifier (inline first 30 lines instead of paths).

- **The phantom rows are still the binding constraint.** Even with the
  injection working, the metric stays red until a human runs the SQL
  in KE-422 §A. The injection routes attention to the right docs, but
  cannot remediate.

- **No new arc work needed this heartbeat.** KE-424 already documents
  the falsifier (§C) and the next-step ladder (§D + Falsifier section).
  This file just records the runtime gap so the next arc heartbeat does
  not re-derive it.

## Action for next arc heartbeat
1. Check the most recent may heartbeat after 02:51 UTC.
2. `grep -c "Prior analyses" .state/sessions/history/<id>/session.jsonl`
3. If `> 0` and may also reads at least one of KE-422/423/424 → mark
   KE-424 confirmed, write a short "confirmed" note appending to KE-424.
4. If `= 0` → escalate to KE-424 Falsifier path: change `findRelatedKEs`
   to include the KE bodies (first ~30 lines), not just paths.
5. Either way, the human-action ask (status-flip the 3 rows) is still
   open and still blocks the metric clearing.

## Files
- (no source changes this heartbeat — observation only)
- `agents/arc/workspace/analysis/2026-05-01-ke-424-falsifier-status.md` (this file)
