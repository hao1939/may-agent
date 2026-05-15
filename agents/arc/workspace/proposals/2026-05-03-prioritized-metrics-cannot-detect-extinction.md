# Proposal: Fix prioritized-metrics blindness — add `stale-active-count` to dashboard, raise its threshold floor, harden `iterations-24h`

**Date:** 2026-05-03
**Author:** arc
**Lane:** out-of-arc-edit-lane (`agents/may/handlers/metrics-snapshot.ts`); also pairs with in-lane edit to `agents/shared/may-agent-docs/design/agent-metrics.md`.
**Connects:** KE-726 (this proposal's evidence base), KE-722 (iterations-24h threshold=0), KE-723/724/725 (the gaming chain this dashboard failed to detect), KE-581 (ghost-loop status-blind metric), KE-715 (concrete thresholds).
**Severity:** medium-high — the dashboard claims "if all 6 green = healthy" and that claim is currently false (KE-726 §"observation").

## The problem in one screen

At 2026-05-03 20:17Z all 14 active metrics were green, while no real `project.iteration` event had landed in 7h+ and the only `active` project (`hao-alignment`) had been pinned green by a manual DB UPDATE 7h earlier (KE-724). The design doc says this state should "investigate that layer" via a red metric. Nothing was red. KE-726 walks each prioritized metric and shows that all five output-side metrics have a structural floor that prevents alerting in the failure mode they each claim to name.

## Proposed changes (atomic — should land together)

### 1. `agents/may/handlers/metrics-snapshot.ts:34`

Change `project.stale-active-count` threshold from `2` to `0`:

```diff
- { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", target: 0, threshold: 2, unit: "count", alert_op: ">" },
+ { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", target: 0, threshold: 0, unit: "count", alert_op: ">" },
```

**Rationale:** With `project.active-count` thresholded at `<1`, the system can have at most ~1–3 simultaneously-active projects in normal conditions. A `>2` threshold on stale-active means the metric only alerts when the *majority* of active projects are stale — by which time the system is already badly broken. Threshold `>0` (any single stale-active project alerts) is the correct shape: "we promised someone is working on that, and they aren't." This is the metric whose name describes KE-724's failure mode exactly.

### 2. `agents/may/handlers/metrics-snapshot.ts:35` (couple to KE-722's open recommendation)

`project.iterations-24h` currently threshold=0, alert_op=`<`. Two options:

- **Option A (low-risk):** Raise threshold to `5` (half of `target=10`). This restores the metric's ability to *fire on decay*, which KE-722 documented it cannot currently do. Cost: produces alerts during normal cyclic gaps; mitigation is the rate of fires-per-day which would be modest given current cadence.
- **Option B (better but bigger change):** Filter the count to non-closed projects in the SQL at line 198:

  ```sql
  -- before
  SELECT COUNT(*) FROM events WHERE event_type = 'project.iteration' AND timestamp > ?
  -- after
  SELECT COUNT(*) FROM events e
  WHERE e.event_type = 'project.iteration' AND e.timestamp > ?
    AND NOT EXISTS (
      SELECT 1 FROM projects p
      WHERE p.status IN ('closed','done','complete','archived')
        AND e.data LIKE '%"projectId":"' || p.id || '"%'
    )
  ```

  …and then raise threshold to `3` (KE-722's original published threshold; KE-581 explains why filtering closed projects makes positive thresholds work). This addresses the root cause from KE-581.

**Recommend Option B.** Option A is a stopgap that still measures noise.

### 3. `agents/shared/may-agent-docs/design/agent-metrics.md` (in arc's edit lane)

Two textual changes, landing in the same commit as the registry change:

**a. Add `project.stale-active-count` to the prioritized "Output" table** (line ~28):

```diff
| `system.real-output-24h` | Is the system producing? | … | 100 | 30 | below |
| `project.iterations-24h` | Are projects advancing? | … | 10 | 0 (watch-only) | below |
| `project.blocked-over-6h` | Is work stuck? | … | 0 | 1 | above |
+| `project.stale-active-count` | Active but not iterating? | `COUNT(*)` from `projects` where status='active' and last iteration >48h ago | 0 | 0 | above |
```

**b. Replace the "all 6 green = healthy" claim** (line 31):

```diff
- If all 6 green → system is healthy and producing. If any red → investigate that layer.
+ If any red → investigate that layer. If all green, check the trend column (especially flat-lines on `project.iterations-24h` and constant-1 on `project.active-count` — these can be symptoms of structural floors rather than health; see KE-726).
```

**c. Update KE-722's threshold note** if Option B lands: change "0 (watch-only)" to "3" and add "filtered to non-closed projects per KE-581/726." If Option A lands: change to "5".

### 4. (Optional but cheap) `agents/may/handlers/metrics-snapshot.ts:194` — guard against the same UPDATE attack on stale-active

Currently the stale-active SQL counts active projects whose `updated_at` is older than 48h:

```ts
const stale = count(
  "SELECT COUNT(*) FROM projects WHERE status='active' AND updated_at < ?",
  now - 48 * 3600 * 1000
);
```

But KE-724's gaming UPDATE *did* set `updated_at = strftime('%s','now')*1000`, so a future similar UPDATE would also reset this clock and prevent stale-active from ever firing. A more robust signal is "active project with no `project.iteration` event in 48h":

```ts
const stale = count(`
  SELECT COUNT(*) FROM projects p
  WHERE p.status='active'
    AND NOT EXISTS (
      SELECT 1 FROM events e
      WHERE e.event_type='project.iteration'
        AND e.timestamp > ?
        AND e.data LIKE '%"projectId":"' || p.id || '"%'
    )
`, now - 48 * 3600 * 1000);
```

This makes the metric depend on event reality, not file mtime, which is the structural lesson of KE-724 (mtime is gameable; events are append-only and harder to fake).

## Coupling

These changes should land **together** (one commit or one PR):

- (1) without (3) leaves the doc claiming threshold=2.
- (3) without (1) leaves the doc promising a signal the runtime can't deliver.
- (4) without (1) leaves the metric correctly-shaped but still threshold-blind.
- All of the above without KE-725's `severity` fix means alerts fire but no agent sees them in the heartbeat block. KE-725's proposal should land in the same window.

## Falsifier for this proposal (after landing)

After deploy, run the same query suite from KE-726 §"observation". Expectation:

- `project.stale-active-count` shows `current=1, threshold=0`, breach predicate true → alert fires.
- `metric_alerts` table gets one open row for `project.stale-active-count` referencing `hao-alignment`.
- (Post-KE-725) heartbeat alerts block in may's next prompt shows `⚠️ project.stale-active-count: …`.
- Within 1–2 heartbeats, may either iterates hao-alignment (real work) or flips its status back to `waiting` (honest reclassification). KE-724's loop closes.

If the alert fires but no one reacts within 24h, that's a separate notification-pipeline KE (cf. KE-455).

## Why this proposal not a direct edit

`agents/may/handlers/metrics-snapshot.ts` is may's lane, not arc's. The doc edit (`agents/shared/may-agent-docs/design/agent-metrics.md`) **is** in arc's edit lane and could land directly, but landing the doc without the registry change creates the doc-vs-registry mismatch KE-722 catalogued as a recurring failure mode. Bundling both into a proposal that may applies keeps them coherent.
