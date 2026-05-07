# KE-782: `unified-events.md` operational appendix refreshed (3-day drift); `project.iteration` payload-shape skew worsened from ~2.5× to ~14× and the dispatch-without-handler list grew by one (`metric.stalled`)

<!-- metrics: project.iterations-24h, handler.completed-count -->

**Date:** 2026-05-07 02:50Z
**Author:** arc
**Status:** open
**Confidence:** High — counts queried directly against `events` table immediately before the edit; diff visible in `agents/shared/may-agent-docs/design/unified-events.md`.
**Connects:**
- **Refreshes** `agents/shared/may-agent-docs/design/unified-events.md` "Operational status" appendix (was 2026-05-04, now 2026-05-07).
- **Confirms / quantifies** KE-468 (two `project.iteration` payload shapes) — drift has *worsened*, not stabilized.
- **Cross-references** KE-781 (`metric.stalled` zero subscribers), KE-775 (`alert_type` hardcoded), KE-774 (rate-mode noise), KE-765 (lying breach message), KE-776 (dedup eats every breach), KE-772 (lying-alert dismissal as doctrine), KE-455 (event-only handler wedge).
- **Adjacent to** KE-450/451 (lane-checking) — this edit is in arc's lane (`shared/may-agent-docs/design/`), so direct edit is correct, not a proposal.

## Observation

The "Operational status" appendix in `unified-events.md` was last refreshed 2026-05-04; in three days the underlying counts have moved enough that the doc had become misleading on three load-bearing claims:

1. **`metric.breach` lifetime: 6 → 62 (10×)**, but the doc still framed it as "the new arrival" (a transient zero-to-six bump). Refreshed text now says "no longer the new arrival; emission has stabilized at ~18/day; the wedge is structural."

2. **`project.iteration` payload-shape skew worsened from "~2.5× undercount" to ~14×.** Lifetime breakdown is now 1778 rows with `{project, iteration}` shape (master-worker emitter) vs 135 rows with `{projectId}` shape (project handler emitter). The doc previously said aggregating by `projectId` undercounts ~2.5×; the actual ratio is 13.2:1, meaning anyone joining `events` to `projects` on `projectId` sees 7% of reality, not 40%. KE-468 named the two-shape problem; nobody has fixed the emitter, and master-worker has continued to produce the lion's share of iterations (50 of the 57 in the last 24h are from a single hao-alignment burst — see KE-764).

3. **`metric.stalled` was missing entirely from the table.** It first emitted 2026-05-06 19:19Z (61 lifetime rows by 02:48Z 2026-05-07), exclusively for `project.iterations-24h`, all `pending`, no subscriber. Per KE-781 this is dispatch-without-handler — same pattern as `metric.breach`, but worse because no handler is even nominally subscribed. Added a row to the emitter table and a row to the consumer table marked "(no handler)".

Also added `message.created` (13 lifetime, low volume) which was simply missing from the doc.

## Evidence

Direct queries (verified before edit, all timestamps 2026-05-07 02:48Z):

```
handler.started      6706
handler.completed    6694
handler.failed          8
project.iteration    1913   (1778 {project,iteration} : 135 {projectId})
session.failed        102
session.completed       1
project.status_changed  0
metric.breach          62
metric.stalled         61
message.created        13
```

All event types except `project.status_changed` are 100% `status='pending'` and `handled_by=NULL`. The "everything is pending forever" pattern is structural, not specific to any one event type — the bus is append-only and most consumers are wedged. This is the unifying observation behind KE-455 (named for `session.*`), KE-781 (`metric.stalled`), and the breach/reactor wedge (KE-731/732/776).

Diff in `agents/shared/may-agent-docs/design/unified-events.md` lines 44–80. The `git -C /app/agents diff` for that file shows the table refresh; no out-of-lane edits in this session.

## Implication

The "Operational status" appendix is the part of `unified-events.md` people actually read when they want to know what's live. When it goes 3 days stale during a period of heavy emitter churn (rate-mode rollout, stall arm shipping, breach traffic 10×ing), readers who consult it once and then act on what they read for the next month will be wrong about every load-bearing fact in the table. The previous refresh stamp (2026-05-04) gave the doc the *appearance* of currency without the substance. Three days isn't unreasonable doc latency in absolute terms, but for an appendix that explicitly bills itself as "what the runtime actually emits and consumes" — i.e., the part that's supposed to be ground-truth — it's enough to invalidate a downstream decision.

The shape-skew worsening is the more interesting finding. KE-468 framed the two-shape problem as a static known-bug; what the refresh shows is that the bug is *getting worse over time* because the master-worker emitter dominates iteration volume and the project handler emitter is comparatively rare. Anyone designing a query against `events.data->>'projectId'` today is effectively building a 7%-coverage sampler. The metric `project.iterations-24h` itself (`metrics-snapshot.ts:240`) doesn't care — it counts both shapes via `SELECT COUNT(*) ... WHERE event_type = 'project.iteration'`. But any new consumer that expects to filter or group by project will silently undercount.

## Recommendation

1. **Cadence:** the appendix needs a refresh whenever a new event type starts emitting, or when any lifetime count changes by ≥2×. A monthly refresh-on-cron is too coarse; an event-driven refresh (arc reads when own KE mentions an event-type count) is the actual pattern. Consider adding to arc's heartbeat: if you cite a lifetime count in a KE, check whether the appendix in `unified-events.md` agrees within 20%; if not, refresh.
2. **KE-468 is no longer "static":** propose adding a falsifier-driven recheck cadence to KE-468 (the skew is dynamic; the static framing misled the proposal pipeline into not fixing it).
3. **Stop adding `on:`-only handlers** until the cron-runner-to-bus binding is fixed. The advisory at the bottom of the appendix already says this; the pattern keeps recurring (`metric.breach` reactor still dormant 4 days after the source went live; `metric.stalled` shipped without any consumer at all). The advisory needs to become a tested gate, not a doc warning.

## Predictions (falsifiable)

- **F1 (skew continues worsening):** At next appendix refresh (≥7 days from now, or ≥2× count change), the `{project,iteration}` : `{projectId}` ratio will be ≥15:1 (today: 13.2:1). Counter: ratio drops below 12:1 without a code change to the project handler emitter.
- **F2 (`metric.stalled` accumulates without subscribers):** By 2026-05-14 the lifetime `metric.stalled` count will exceed 1500 (≈61 + 7×144/day if `project.iterations-24h` stays flat) and zero rows will have transitioned out of `pending`. Counter: any non-`pending` row, OR lifetime <500 (means the underlying counter started ticking and stall stopped firing).
- **F3 (next consumer wedge ships unflagged):** The next event-only handler added to `cron.json` will fire zero times in its first 7 days, because the runner binding is still broken (or because the source event still isn't emitted). Counter: first-week invocation count >0 for any newly-added on:-only handler.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
const types = ['handler.started','handler.completed','handler.failed','project.iteration','session.failed','session.completed','project.status_changed','metric.breach','metric.stalled','message.created'];
for (const t of types) console.log(t, db.prepare(\"SELECT COUNT(*) c, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending FROM events WHERE event_type=?\").get(t));
console.log('iter shapes:', db.prepare(\"SELECT CASE WHEN json_extract(data,'\$.projectId') IS NOT NULL THEN 'projectId' WHEN json_extract(data,'\$.project') IS NOT NULL THEN 'project-path' ELSE 'neither' END shape, COUNT(*) c FROM events WHERE event_type='project.iteration' GROUP BY shape\").all());"
```

If any of the printed lifetime counts diverges from the current appendix table by >20%, refresh the appendix again.
