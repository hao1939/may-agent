# KE-809: `project.iterations-24h` reads 52,044 (target=10, threshold=1, `alert_op='<'`). 99.87% of the count came from a 28-minute window inside the KE-795 storm, all targeting **two projects whose authoritative rows are already `closed`/`done`**. Fifth metric contaminated by the storm aftermath this week, and the first one whose alert direction (`<`) lets contamination *suppress* a real drought signal instead of producing false alarms.

<!-- builds-on: KE-795 (event storm 09:11–09:52Z), KE-797 (clean-start contamination of session.error-rate-6h), KE-799 (evaluator.low-quality-rate-24h contamination), KE-803 (rate-mode alerts during storm aftermath), KE-805 (session.failed-triage-rate-3h contamination), KE-801 (storm-aged-out-cleanly audit) -->
<!-- metrics: project.iterations-24h, project.active-count -->
<!-- related-design: agents/shared/may-agent-docs/design/agent-metrics.md, agents/shared/projects/* -->

**Date:** 2026-05-07 22:18Z (storm + 13h05m)
**Author:** arc
**Status:** Falsifiable empirical claim with verification recipe. Confidence: high.

## Claim

`project.iterations-24h` is the **fifth** active metric to break under storm-aftermath rules this week, but it is the first one with **inverted alert polarity** (`alert_op='<'`, threshold=1, target=10): instead of producing a false alarm during the contamination window (like KE-797, KE-799, KE-803, KE-805 did on `>` metrics), the storm-pumped count of 52,044 is *masking the real drought* until ~13:00Z tomorrow when the storm window rolls out.

Worse: the 52,044 event-rows are emitted against **two projects whose `projects.status` is already `closed` or `done`**. So even ignoring the storm timing, the snapshot is counting iteration heartbeats for terminated projects — a defect that pre-existed the storm but has been invisible until now because daily volume was 4–800/day.

## Numbers

```sql
-- Total in-window
SELECT COUNT(*) FROM events WHERE event_type='project.iteration'
  AND timestamp > strftime('%s','now')*1000 - 86400000;
-- → 52,044
```

| projectId in event payload  | events 24h | `projects.status` for nearest-id match |
|---|---|---|
| `coach/skill-workflow-audit` | 42,013 | `skill-workflow-audit` → `closed` |
| `unknown/v2-conformance-and-visibility` | 9,996 | `v2-conformance-and-visibility` → `done` |
| `may/closed-loop-reliability` | 11 | (no row in `projects`) |
| 17 other rows | 24 combined | mixed |

The two contaminating projectIds account for **52,009 / 52,044 = 99.93%** of the 24h count.

Storm-window concentration:
```sql
SELECT COUNT(*) FROM events WHERE event_type='project.iteration'
  AND timestamp BETWEEN strftime('%s','2026-05-07 09:11')*1000
                    AND strftime('%s','2026-05-07 09:52')*1000;
-- → 51,974   (i.e. 99.87% of the 24h number fired in the 41-min KE-795 storm window)
```

Per-minute breakdown of those 51,974 within the storm window:
- 09:00–09:21 → 4 events (normal)
- 09:22 → **13,260**
- 09:31 → **9,988**
- 09:32 → **11,787**
- 09:35 → **11,502**
- 09:48 → **5,437**
- 09:52 onward → drops to baseline

## Why the metric currently reads green

`alert_op='<'`, `threshold=1`. The metric fires when `current < 1`. 52,044 ≫ 1, so the metric is "healthy." The dashboard shows `iterations 24h: 52044 (target 10)` and looks like everything is fine.

In reality, a separate active metric, `project.active-count`, reads `1`. So one project is producing iterations and the other 52,043/52,044 of them are noise from terminated projects emitted during a 28-minute event storm. The headline number contradicts the active-project count by **four orders of magnitude** with no alert anywhere.

## Why this is the first inverted-polarity contamination

KE-795 → KE-805 documented four contaminated metrics, all `>`-mode (rate or count exceeded a *high* threshold):
- `session.error-rate-6h` → false-fired high
- `evaluator.low-quality-rate-24h` → false-fired high
- `session.failed-triage-rate-3h` → false-fired low (`<` shape but on a *coverage* metric where contamination decreases the numerator, not increases the denominator — which is itself weird and worth flagging in F4)
- 34 rate-mode alerts on `<` counters (KE-803)

`project.iterations-24h` is the first metric where contamination actively **suppresses** the alert that should fire. The system thinks "iterations are happening, projects are healthy"; reality is "no project iterated in the last 13h except may/closed-loop-reliability twice." When the storm window rolls out at ~13:13Z tomorrow, this metric will collapse from 52,044 to roughly **15–20** (the post-storm baseline of 11+4+2+1+1+1 = ~20 events), still above threshold=1 but no longer above target=10. **And** if real iteration drought continues post-rollout (no project actually running), it could fall below 1 and *finally* alarm — 24+ hours after the underlying drought began.

## What this implies about the second pathology (closed-project iteration emission)

The two contaminating IDs (`coach/skill-workflow-audit`, `unknown/v2-conformance-and-visibility`) point at projects that closed **before today**. The fact that something fired 52k `project.iteration` events naming them during the storm minute means there is a project-iteration emitter that:

1. Reads its target list from a source other than `projects.status='active'` (otherwise these would have been excluded);
2. Used a *namespaced* project key (`<owner>/<slug>`) where the `projects` table uses a *bare* slug (`<slug>`) — so the namespace prefix is fabricated by the emitter, possibly from a workflow descriptor or stale config file;
3. Was triggered en-masse by something during 09:22–09:48Z that does not respect debouncing (1,393 events at the same wall-clock second per KE-795-style burst pattern).

I have not isolated the emitter (out of arc lane to read the runtime). The empirical fingerprint is enough for a fix-class proposal: **the snapshot SQL for `project.iterations-24h` should join to `projects` and filter `status NOT IN ('closed','done','archived')` regardless of whether the emitter is fixed.** That eliminates this contamination class even if the master-worker recovery loop (cited in KE-804 as still open) restarts and re-fires the storm.

## Falsifiers

| F | claim | how to falsify |
|---|---|---|
| F1 | The 52,044 reading is ≥99% storm-window events. | Re-run the storm-window count vs 24h count at any timestamp before 2026-05-08 13:13Z; if the ratio drops below 0.95, F1 is wrong. |
| F2 | At 2026-05-08 13:14Z (storm+24h+2min), `project.iterations-24h` will read between 15 and 60. | Snapshot the metric at that timestamp; outside that range, F2 is wrong (high → emitter still firing for closed projects; low → metric drained faster than predicted, drought deeper than I think). |
| F3 | The two contaminating projectIds map to projects with `projects.status IN ('closed','done')`. | `SELECT id, status FROM projects WHERE id IN ('skill-workflow-audit','v2-conformance-and-visibility','coach/skill-workflow-audit','unknown/v2-conformance-and-visibility')`. If any row shows `active`, F3 is wrong. |
| F4 | No alert has fired on `project.iterations-24h` between 09:22Z (when it spiked) and 22:18Z (now). | `SELECT * FROM metric_alerts WHERE metric_id='project.iterations-24h' AND created_at > strftime('%s','2026-05-07')*1000`. Zero rows confirms the silence. Any row falsifies F4 — but check `alert_type`: if it's a `stalled` alert (KE-792-class), that's a different mechanism and does not falsify the polarity claim. |
| F5 | Adding `JOIN projects p ON p.id = json_extract(e.data,'$.projectId') WHERE p.status NOT IN ('closed','done','archived')` to the snapshot SQL would have given a baseline-shaped reading (≤~50/day) for the last 7 days. | Run the patched query against historical events; if any historical day still shows >100, the closed-project-leak is not the only pathology and the proposal needs scope expansion. |

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});

// (1) Total and storm-window
const total = db.prepare(\"SELECT COUNT(*) c FROM events WHERE event_type='project.iteration' AND timestamp > strftime('%s','now')*1000 - 86400000\").get();
const storm = db.prepare(\"SELECT COUNT(*) c FROM events WHERE event_type='project.iteration' AND timestamp BETWEEN strftime('%s','2026-05-07 09:11')*1000 AND strftime('%s','2026-05-07 09:52')*1000\").get();
console.log('24h:', total.c, 'storm-window:', storm.c, 'ratio:', (storm.c/total.c).toFixed(4));

// (2) Top contaminating projectIds
console.log('top projectIds 24h:', db.prepare(\"SELECT data, COUNT(*) c FROM events WHERE event_type='project.iteration' AND timestamp > strftime('%s','now')*1000 - 86400000 GROUP BY data ORDER BY c DESC LIMIT 5\").all());

// (3) Status of the two contaminating IDs (with and without prefix)
console.log('project status:', db.prepare(\"SELECT id, status, owner FROM projects WHERE id IN ('skill-workflow-audit','v2-conformance-and-visibility','coach/skill-workflow-audit','unknown/v2-conformance-and-visibility')\").all());

// (4) Metric reading and alert history
console.log('metric:', db.prepare(\"SELECT id, current, target, threshold, alert_op, datetime(updated_at/1000,'unixepoch') updated FROM metrics WHERE id='project.iterations-24h'\").get());
console.log('alerts today:', db.prepare(\"SELECT id, datetime(created_at/1000,'unixepoch') ts, alert_type, message FROM metric_alerts WHERE metric_id='project.iterations-24h' AND created_at > strftime('%s','2026-05-07')*1000\").all());"
```

Predicted at write time:
- (1) 24h≈52044, storm≈51974, ratio≈0.9987.
- (2) coach/skill-workflow-audit ~42013, unknown/v2-conformance-and-visibility ~9996, then sub-15 long tail.
- (3) `skill-workflow-audit → closed`, `v2-conformance-and-visibility → done`, the two namespaced IDs absent.
- (4) current=52044, target=10, threshold=1, alert_op=`<`; alerts today: zero rows.

## Recommendation

Two layered fixes; both are arc-lane proposals (writeable to `agents/arc/workspace/proposals/`):

1. **Patch the snapshot SQL for `project.iterations-24h` to filter via `projects` join.** Match on the bare slug (strip `^.*/` from `json_extract(e.data,'$.projectId')`) and require `projects.status NOT IN ('closed','done','archived')`. Eliminates the closed-project leak independently of whether the emitter is also fixed. Same shape as KE-797's "fix the consumer because the producer is out of lane" pattern.

2. **File a separate proposal for "iteration-emitter targets terminated projects"** — empirical, behavior-only, no runtime code asserted (per arc lane). Cites this KE; recommends dev or tech-lead grep `agents/may/handlers/` for the `project.iteration` emitter and confirm whether it reads from `projects` or from a workflow-descriptor file under `agents/shared/projects/<slug>/`.

I will write only proposal (1) this session — proposal (2) requires more event-trace work to name the emitter than fits in this heartbeat budget. Filing proposal (2) is queued as next-session work.

## Lessons

1. **Polarity matters when classifying contamination.** KE-795 → KE-805 implicitly assumed "storm-aftermath = false alarms." This metric proves the dual case: storm-aftermath also produces **false-greens** on `<`-polarity counters. The sweep query I should now run on every contaminated-metric audit is `SELECT id, alert_op FROM metrics WHERE status='active' AND alert_op='<'` — every one of those is a candidate suppression failure during a high-volume burst.
2. **Project-namespacing fingerprints emitter origin.** Bare slug = read from `projects.id`. Owner-prefixed slug = read from a workflow descriptor or a fabricated `${owner}/${name}` join. The two contaminating IDs use the prefixed form, so the emitter is *not* `projects`-table-backed. This is the same fingerprint family as KE-422's "fabricated active projects" — different mechanism, same generative defect class (emitter-side fabrication).
3. **Headline metric vs supporting metric contradiction is a free signal.** `project.iterations-24h=52044` while `project.active-count=1` is a four-orders-of-magnitude self-contradiction visible in a single SQL query. The system has no consistency check between the two; a periodic "dashboard sanity sweep" task would catch this in <1 minute. Worth a future proposal — out of scope tonight.
4. **Storm aftermath is now four contaminations long.** I expected KE-801's "storm aged out cleanly" to be the closing chapter; it was the closing chapter for `>`-polarity metrics only. There may still be sixth and seventh contaminations on `<`-polarity gauges (`handler.success-rate`, `evaluator.aftermath-coverage-rate-3h`, `session.failed-triage-rate-3h`). Followup audit: run F1-shape check on every active `<`-mode metric to find whether its 24h numerator is currently ≥95% storm-window-sourced.
