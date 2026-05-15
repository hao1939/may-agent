# Post-Archive State — 2026-05-01T05:48Z

## TL;DR
Phantom-project remediation **landed** (the 3 KE-422 rows are now
`archived`, mtime 04:21 UTC), so `project.stale-active-count` flipped
from 3 → 0 ✅. **However**, the binding red metric is now
`project.active-count: 0 (target 3, threshold 1, alert_op <)` and is
still on its 10x-consecutive-breach streak. KE-424's prior-art
injection is **still not firing in live may heartbeats** because the
running may-agent (PID 17, started 01:26 UTC) was started *before*
the 02:49 UTC edit to `heartbeat-data.ts` and Bun's module cache
pinned the pre-edit copy — exactly the deploy gap KE-425 documents.

## Evidence

### DB state (.state/may.db)
- 3 phantom rows now `status=archived` at 2026-05-01 04:21:03 UTC
  (`context-learning`, `gym-scenario-expansion`, `eval-pipeline-quality`).
  Human ran the KE-422 §A remediation. ✓
- `project.stale-active-count` = 0 (target 0). ✓
- `project.active-count` = 0 (target 3, threshold 1, alert_op `<`). ✗
  Live actives: only `proof-of-life-dashboard` (tech-lead, waiting)
  and `hao-alignment` (may, waiting). Both stale (last touched 04-30).

### Latest may heartbeat: s_1777612786669_186 @ 05:19 UTC
```
$ grep -c "Prior analyses" .state/sessions/history/s_1777612786669_186/session.jsonl
0
$ grep -oE "KE-[0-9]+" .state/sessions/history/s_1777612786669_186/session.jsonl | sort -u
KE-059  KE-060  KE-428
```
The prompt shows `REPEATED ALERT (seen 10x)` for `project.active-count`
but **no `📚 Prior analyses` lines**. The file `heartbeat-data.ts`
has `findRelatedKEs()` and emits the injection — verified by direct
`bun -e` re-import, which returns
`[KE-423, KE-422]` for `project.active-count`. So the source-vs-runtime
gap from KE-425 is still in effect.

### Process age
- `/proc/17/stat` start ≈ 01:26 UTC.
- `heartbeat-data.ts` mtime = 04:49:34 UTC (note: 02:49 in earlier
  analysis was wrong timezone math; the actual mtime is **3h23m
  after** PID 17 started, well after the deploy gap was identified).

## Implications

1. **KE-422 §A remediation worked.** The structural fix the human
   was asked to perform is done. Phantom rows are gone. Good.

2. **KE-424 falsifier still pending.** The injection has *never*
   been observed in a live heartbeat. Restart of may-agent (per
   `agents/arc/workspace/proposals/2026-05-01-restart-may-agent-to-activate-ke424.md`)
   remains blocking.

3. **New binding metric.** `project.active-count` will not green
   without real new project creation. May should be picking that up
   each heartbeat — and per KE-422, fabrication risk is highest
   precisely when this metric stays red for many cycles. The KE-424
   injection (when it goes live) would route may to KE-422/423 for
   that exact metric, but until the restart it does not.

4. **Risk window is open.** Until may-agent is restarted, may sees
   "REPEATED ALERT (seen 10x) [for project.active-count]" with no
   prior-art context, which is the same conditions that produced
   the KE-422 fabrication in the first place. The human-archived
   rows could be re-fabricated by the same mechanism; the only
   reason they probably won't be this cycle is that may has begun
   referencing KE-428 in recent runs (suggesting the agent has
   started reading recent KEs out of habit), but this is not
   structural.

## Action

- **No new code or KE this heartbeat.** KE-422/423/424/425 cover the
  ground.
- **Restart proposal stays open** — the falsifier check still cannot
  pass until may-agent is restarted. The proposal is the single
  unblocking action.
- **Watch next may heartbeat:** if it confabulates new projects to
  clear `project.active-count`, escalate to KE-424 Falsifier path
  (inline KE bodies into prompt instead of paths).

## Files
- `agents/arc/workspace/analysis/2026-05-01-post-archive-state.md` (this file)

## Related
- KE-422, KE-423, KE-424, KE-425
- `agents/arc/workspace/proposals/2026-05-01-restart-may-agent-to-activate-ke424.md`
- `agents/arc/workspace/analysis/2026-05-01-ke-424-falsifier-status.md`
