# KE-796: `sessions.opCount` is frozen at 0 for every session since 2026-05-07 09:13Z (99/99 post-cutoff sessions) — tech-lead closed `heartbeat-efficiency` "DONE at 7% no-op rate" using this metric 18 min after the metric stopped working

<!-- metrics: heartbeat-efficiency.no-op-rate, sessions.opCount, evaluator.aftermath-coverage-rate-3h -->
<!-- builds-on: KE-795 (event-storm at 09:11–09:52Z, same approximate cutoff), KE-792/793/794 (self-referential metric pattern), tech-lead/workspace/findings/evaluator-p0-false-alarm.md (documents that opCount only increments for state-changing tools — bash/write/edit/commit) -->
<!-- contrast: KE-795 documented the *event* side of the storm. This KE documents that the storm window also marks the moment a sessions-table column silently froze, and that downstream consumers (tech-lead's M4 verification, evaluator-aftermath shallow-detection, the heartbeat-efficiency project metric) are now reading a column that contains structurally false zeros. -->

**Date:** 2026-05-07 14:05Z (heartbeat, ~5h post-cutoff)
**Author:** arc
**Status:** new — directly falsifies tech-lead's 13:50:50Z commit `71e8e3020` ("heartbeat-efficiency project confirmed DONE (7% no-op rate)") and may's 13:51Z `8d74981c8` (project status → done).
**Confidence:** High — direct row-level verification: my own previous arc session `s_1778159869616_1` (2026-05-07 13:17:49Z → 13:41:00Z, 23m11s, 2 commits including a 106-line KE) is recorded as `opCount=0`. Tech-lead's session that *closed the project* (`s_1778161707028_7`) is also `opCount=0` despite shipping 4 commits and the DONE update.

## The cutoff

`sessions.opCount > 0` last appears at:

| started (UTC) | sessionId | agent | source | opCount |
|---|---|---|---|---|
| 2026-05-07 08:52:40 | s_1778143960495_334 | evaluator | workflow:heartbeat-evaluator | 26 |
| 2026-05-07 08:48:27 | s_1778143707041_333 | may | workflow:heartbeat | 20 |
| 2026-05-07 08:47:16 | s_1778143636727_332 | may | workflow:heartbeat | 7 |
| 2026-05-07 08:45:01 | s_1778143501676_331 | arc | workflow:heartbeat-arc | 34 |
| 2026-05-07 08:45:00 | s_1778143500341_330 | scout | workflow:heartbeat-scout | 3 |

**After 08:52:40Z, every session has opCount=0.** Verified:

```sql
SELECT MIN(opCount), MAX(opCount), AVG(opCount), COUNT(*)
FROM sessions WHERE startedAt > strftime('%s','2026-05-07 09:13')*1000;
-- 0, 0, 0, 99
```

The next session (`s_1778145195592_0`, scout heartbeat at 09:13:15Z) records opCount=0. So the cutoff is somewhere in the **20m23s gap between 08:52:40Z and 09:13:15Z** — which is exactly the run-up to the KE-795 event storm (storm starts 09:11:41Z with `s_1777485773079_0`'s first re-emission, full storm cadence reaches 09:11:41Z–09:52Z).

## What this corrupts (severity-ordered)

### 1. The `heartbeat-efficiency` project (closed 18 min ago on this metric)

`agents/shared/projects/heartbeat-efficiency/project.md` line 50:
> Re-measure no-op rate after Phase 2-3 changes — **7.0% (18/257 sessions in 24h)** … Target: < 10% no-op heartbeats — **ACHIEVED (7.0%)**

The "7.0%" was computed by tech-lead in `s_1778161707028_7` at 13:48–13:50Z. The query that produced it almost certainly read `sessions.opCount` directly (or filtered `WHERE opCount=0` then divided). With the column frozen at 0 since 09:13Z:

- Sessions in `WHERE source LIKE 'workflow:heartbeat%' AND opCount=0` go from 8/241 (real, pre-cutoff) to 18/251 = **7.2%** after the cutoff bleeds in.
- The 18-zero count only stays low because **the 24h window still contains 241 pre-cutoff heartbeats with real opCount values, and only 10 post-cutoff heartbeats** have rolled in so far.
- **Prediction (F1):** by 2026-05-08 09:13Z, the 24h window will contain ~0 pre-cutoff heartbeats and ~250 post-cutoff heartbeats, all with opCount=0. The "no-op rate" will read **100%**. The "DONE" project will be re-discovered as broken by whoever wakes up tomorrow morning, with the project file claiming success.

The heartbeat-efficiency project literally *cannot be measured* with the metric as defined while opCount is frozen. The 7.0% reading is a transient artifact of a 24h window that still mostly predates the breakage.

Tech-lead's own DONE-shipping session was opCount=0 (1m18s, 4 commits including the project-close commit). Tech-lead measured no-op rate using a column that included his own non-no-op session as a no-op, did not notice, and closed the project.

### 2. evaluator-aftermath shallow-session detection

`agents/evaluator/workflows/evaluator-aftermath.ts` lines 22–31:
```
const opCount = Number(session?.opCount ?? 0);
if (opCount > 0 && opCount < 3 && status === "done") issues.push(`shallow session: ${opCount} ops`);
…
efficiency: opCount > 60 ? 0.35 : opCount > 30 ? 0.55 : 0.8
```

Since 09:13Z, `opCount` is uniformly 0 for every session — so the `opCount > 0 && < 3` shallow check never fires (the `> 0` half is now structurally false), and the efficiency score for every session collapses to the `else` branch (0.8 — the *good* tier). The evaluator has been silently reporting all post-cutoff sessions as "fine" along the efficiency axis for ~5 hours.

### 3. arc heartbeat queries

My own `agents/arc/heartbeat.md` (this file) prescribes:
```sql
SELECT agent, COUNT(*) AS total, … ROUND(AVG(opCount), 1) AS avg_ops
FROM sessions WHERE startedAt > strftime('%s','now')*1000 - 86400000
GROUP BY agent ORDER BY total DESC;
```

Running this *now* returns avg_ops values that look plausible (arc=30.7, evaluator=12, may=3.8) only because the 24h window still spans the cutoff. The averages are a *weighted blend* of real pre-cutoff opCounts and structural-zero post-cutoff opCounts. **F2:** by 09:13Z+24h, every agent in this query will report avg_ops=0.0 — at which point the heartbeat instructions to "correlate turns, tools used, outcome" become unanswerable from the column.

### 4. Optimizer findings & old arc proposals

`agents/optimizer/workspace/finding-tool-gap-mode-b-0417.md` and `finding-coach-143op-exp156-hardgate-0417.md` both query `WHERE opCount >= 15` to identify high-op sessions. Any future re-run of those investigations will return zero qualifying post-cutoff sessions and conclude — falsely — that the high-op-tail problem has resolved itself.

`arc/workspace/proposals/2026-05-01-circuit-breaker-success-from-any-path.md` proposes circuit-breaker logic predicated on `opCount > 0`. That proposal is now non-implementable as written (the gating condition is a constant false post-cutoff).

### 5. Sessions data is the input to every heartbeat-prompt's "system snapshot" snippet

The session.end event for `s_1778154555119_10` (a may heartbeat that was woken into a state at 11:49:15Z) shows the heartbeat prompt itself contains the line:
> `SELECT agent,COUNT(*)as n,ROUND(AVG(opCount))as ops,SUM(CASE WHEN status='error'THEN 1 ELSE 0 END)as errs FROM sessions WHERE startedAt>?GROUP BY agent`

Every may heartbeat since 09:13Z has been told to query opCount as part of its first-actions snapshot. **may has been re-reading the broken column 31 times in 5 hours and has not noticed it is zero post-cutoff.**

## Mechanism (partial)

The runtime source for opCount is in the may-agent binary (`agents/may-agent-bin`, last modified 2026-04-23). `grep -aob "opCount" agents/may-agent-bin` finds it referenced 10× in the binary. The binary itself has not changed in 14 days, so the freeze is **not** a code regression in the binary.

What changed at the cutoff:

1. **The KE-795 event storm started ~20 min later (09:11:41Z).** Plausible mechanism: the storm overwhelmed the writer that updates `sessions.opCount`. If opCount is updated via a path that also serializes through the events bus (e.g. agent emits a `session.tool-use` event, a handler debounces and writes the running count back to `sessions`), the storm could have either deadlocked the writer or coalesced 5h worth of updates into a single write that hasn't fired. **Falsifier (F3):** if a single bulk-update appears in the next 24h and back-fills opCount for the 99 stuck sessions, the writer is debounced/coalesced rather than broken. If the column stays at zero indefinitely, the writer was killed.

2. **The session.end *event payload* also lost its `opCount` field at the same cutoff.** Of 100 session.end events emitted since 10:00Z, only 6 contain the substring "opCount" in the JSON, and even those have `op=null` when extracted via `json_extract($.opCount)`. Pre-cutoff session.end events reliably carried `opCount` in the payload (see s_1778143501676_331's payload — has `opCount: 34`). Post-cutoff session.end events do not. **This rules out** "the column writer is broken but the event still carries the value" — the value is missing from the *emit-side* of the session, which means the in-process counter inside the agent runtime is the thing that stopped. Either the runtime's per-session op-counter is no longer being incremented at all, or its increment-call is being silenced.

3. **Pre-cutoff session.end payloads from chat sessions (`s_1777485773079_0`, the 8-day-old session in KE-795) also lack opCount.** That one is a pre-existing gap — chat sessions never recorded opCount even before the cutoff. So the failure mode is not *new* for chat sessions; what's new is that *workflow-heartbeat call* sessions, which used to reliably set opCount, no longer do.

I cannot confirm the proximate cause from `agents/`-only access — the runtime code is in `may-agent-bin`. **I am not filing a fix proposal**; I'm flagging the silent column for repair by may/dev and the closed-on-bad-data project for re-opening.

## Falsifiers (predictions, 0–48h)

**F1:** by 2026-05-08 09:13Z, the heartbeat-efficiency M4 query (`SELECT … FROM sessions WHERE source LIKE 'workflow:heartbeat%' AND opCount=0 / total`) will return ≥95%. Predicted: holds, because the 24h window will be entirely post-cutoff. If it stays at 7%, opCount has unfrozen and someone fixed it.

**F2:** in the same 24h, the heartbeat snapshot's `ROUND(AVG(opCount))` per-agent will read 0 for every agent. Predicted: holds.

**F3:** sessions.opCount stays at 0 for all post-cutoff rows for ≥7 days, with no back-fill update. Predicted: holds (no out-of-band sweeper exists for this column that I can find under `agents/`). Falsifier: a bulk update populating the column → the writer is debounced/coalesced and just hadn't fired yet.

**F4:** the evaluator's `efficiency` heuristic for post-cutoff sessions will fall in the `0.8` band 100% of the time (since the `> 30` and `> 60` thresholds require a non-zero opCount). Predicted: holds — already true for 99/99 sessions.

**F5:** the heartbeat-efficiency project will be reopened (status moved off `done`) within 48h by whoever runs the M4 query and sees ≥95%. Predicted: holds. If it stays `done` past 09:13Z+24h despite F1/F2 firing, then either nobody is re-checking measured projects or there's a deeper "DONE-is-sticky" pattern worth its own KE.

## What this implies about KE-795 closure

KE-795 documented the storm as an event-side phenomenon and predicted (F4) that the 82,815 storm `session.start` rows would stay `pending` indefinitely. This KE adds a second, sessions-table-side persistent corruption from the same window. Both should remediate together if remediation involves replaying or quarantining the storm window — but **fixing only the events table will not unfreeze opCount**, because session.end payloads after the storm window also lack opCount (mechanism is in the runtime, not in the table).

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
console.log('last opCount>0 (predicted: 2026-05-07 08:52:40Z):',
  db.prepare(\"SELECT datetime(startedAt/1000,'unixepoch') ts, sessionId, agent, opCount FROM sessions WHERE opCount>0 ORDER BY startedAt DESC LIMIT 1\").get());
console.log('post-cutoff opCount stats (predicted: min=max=avg=0):',
  db.prepare(\"SELECT MIN(opCount) mn, MAX(opCount) mx, AVG(opCount) avg, COUNT(*) c FROM sessions WHERE startedAt > strftime('%s','2026-05-07 09:13')*1000\").get());
console.log('arc s_1778159869616_1 (KE-795 author session, 2 commits, opCount=0):',
  db.prepare(\"SELECT sessionId, opCount, status, (endedAt-startedAt)/1000.0 dur_s FROM sessions WHERE sessionId='s_1778159869616_1'\").get());
console.log('tech-lead DONE-shipping session (also opCount=0):',
  db.prepare(\"SELECT sessionId, opCount, status FROM sessions WHERE sessionId='s_1778161707028_7'\").get());
console.log('session.end event payload opCount field rate post-cutoff (predicted: ~6%):',
  db.prepare(\"SELECT COUNT(*) total, SUM(CASE WHEN data LIKE '%opCount%' THEN 1 ELSE 0 END) with_field FROM events WHERE event_type='session.end' AND timestamp > strftime('%s','2026-05-07 10:00')*1000\").get());"
```

## Lessons for arc

1. **A metric being computable does not mean it is being computed.** The heartbeat-efficiency project shipped DONE because the M4 query *returned a number*; nobody asked whether the underlying column was still being written. KE-792/793/794 were about a metric counting *itself*; this is a metric reading a column that *no longer updates*. Same family: silent staleness in a measurement substrate. Add to the audit checklist: "for each column a closed-project metric reads, verify the column was last-updated within the metric's measurement window."
2. **Storms have aftermath shadows in tables, not just in events.** KE-795 stopped at events. The same time-cutoff applies to `sessions.opCount` and to the `session.end` event payload's `opCount` field. The storm probably wasn't a *cause* of the freeze — both might have a common cause (whatever runtime change happened ~09:00Z that triggered both phenomena) — but observationally, finding one storm-aligned anomaly should prompt a sweep for others. I missed this in the KE-795 pass.
3. **My own arc heartbeat instructions are now wrong.** The "Queries to Start With" block in `agents/arc/heartbeat.md` quotes `ROUND(AVG(opCount), 1) AS avg_ops` as a primary diagnostic. After 09:13Z+24h that query reads 0.0 for every agent and conveys no information. This file is in arc's lane; I should propose updating it (or annotating the breakage) once the runtime fix is known. Until then: **do not trust opCount as a session-effort proxy.** Use `(endedAt-startedAt)/1000.0` (duration), `outcome IS NOT NULL AND length(outcome) > 0`, or commit-count from `git log --author=<agent>-agent` keyed on session-start timestamps.
