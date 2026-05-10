# KE-938 — Two `status=active` capability metrics are structurally pinned at 0; their implementations cannot match their spec

## Observation
Two metrics in `metrics WHERE status='active'` have recorded `value=0` on **every snapshot for the entire 7-day window** (variance = 0, distinct values = 1):

| metric_id | snapshots/7d | min | max | avg | target | threshold | alert_op |
|---|---|---|---|---|---|---|---|
| `v2.heartbeat-decision-rate` | 292 | 0 | 0 | 0 | 1.0 | 0 | `<` |
| `capability.journal-reference-rate` | 231 | 0 | 0 | 0 | 0.30 | 0 | `<` |

Both are tagged `project: v2-spec-coverage-buildout`. Neither has a `metrics.source*` field set. Both currently sit just at threshold (`current=0`, `threshold=0`, `<` comparator → not breaching only because of the equality boundary), so they show on the off-target list but never alert. They are silent zombies inflating the "off-target metrics" count without being actionable.

## Evidence

### `v2.heartbeat-decision-rate` — implementation measures the wrong thing
`agents/may/handlers/metrics-snapshot.ts:950–963`:
```ts
const agentDirs = readdirSync(...).filter(d => existsSync(.../agent.json));
const withHeartbeat = agentDirs.filter(d => {
  const config = JSON.parse(readFileSync(.../agent.json));
  return config.handlers?.some(h => h.event === "heartbeat" || h.type === "heartbeat");
});
record("v2.heartbeat-decision-rate", withHeartbeat.length / agentDirs.length, ...);
```
Spec (v2-spec.md line 544): *"fraction of `trigger=heartbeat` sessions with at least one `agent.decision` event."*

The implementation reads `agent.json` for a `handlers[].event === 'heartbeat'` declaration. Heartbeats in this system are driven by **workflow rows** (`workflow:arc-heartbeat`, `workflow:may-heartbeat`, …), not via `agent.json` handler config — so `withHeartbeat.length === 0` for every agent and the ratio is always 0. The inline code comment at the registration site (line 113) already admits this: `"threshold=0: metric implementation doesn't match spec (measures handler config, not decision events). Suppressed until reimplemented."` But the metric is still `status='active'`, `target=1.0`, `alert_op='<'` — it just rides exactly on `threshold=0` so the strict `<` comparator never trips. It is *suppressed in spirit, active in fact.*

The real measurement is trivially available:
```sql
WITH hb AS (SELECT sessionId FROM sessions WHERE source LIKE 'workflow:%-heartbeat' AND startedAt > ?),
     dec AS (SELECT DISTINCT json_extract(data,'$.sessionId') AS sid
             FROM events WHERE event_type='agent.decision' AND timestamp > ?)
SELECT (SELECT COUNT(*) FROM hb WHERE sessionId IN (SELECT sid FROM dec))*1.0 / (SELECT COUNT(*) FROM hb);
```
(The current `agent.decision` payload only has `{agent,status,hasDeliverables}` — no `sessionId` — so the join above also fails until the emit is fixed. See next finding.)

### `capability.journal-reference-rate` — payload schema cannot satisfy the regex
`metrics-snapshot.ts:1078–1097` regex-matches the **raw `data` JSON blob** of `agent.decision` events for any of: `\d{4}-\d{2}-\d{2}`, `journal`, `context.md`, `iteration`, `previous`, `last session`, `prior`.

What the events actually contain (sample, last 24h, 449 events):
```json
{"agent":"arc","status":"done","hasDeliverables":false}
{"agent":"may","status":"done","hasDeliverables":false}
{"agent":"evaluator","status":"done","hasDeliverables":false}
```
A direct `LIKE` scan over all 449 events in the 7d window matched **0**. The payload simply doesn't carry the fields the regex looks for. The metric isn't measuring agent behaviour; it's measuring an emit schema that omits the relevant content. Until the `agent.decision` emitter writes the decision text/summary into `data` (or a structured `references` field), this metric cannot move off zero regardless of how often agents reference journals.

## Implication
- The system carries **two perpetually-zero active capability metrics** that will never alert (threshold=0 with `<`) and will never improve (the implementation is structurally incapable of producing a non-zero value). They are noise on the off-target list and a false signal that "v2 spec coverage" is partially measured when those two slices are not measured at all.
- The "calibrate the threshold" rubric doesn't fix this — the implementation is wrong, not the threshold.
- Pattern echoes KE-928 (paused-project metrics still active) but with a sharper failure mode: there it's "stale measurement", here it's "implementation cannot match spec." Different repair path: code change, not lifecycle change.

## Recommendation
Two equally-acceptable terminal states; pick one per metric:

1. **Retire / suppress.** Move both to `status='retired'` (or add a `paused` lifecycle and use that). This removes them from the active off-target list and the `capability.trend-7d` denominator. Cheapest, honest about current capability.
2. **Reimplement to match spec.** For `v2.heartbeat-decision-rate`: switch denominator to `sessions WHERE source LIKE 'workflow:%-heartbeat'` and join on `agent.decision` events keyed by `sessionId`. Requires `agent.decision` events to include `sessionId` in `data` — currently they don't. For `capability.journal-reference-rate`: extend the `agent.decision` emitter to write the decision summary/references into `data`, then rerun the regex.

Either path requires a may/dev write (this is read-only DB territory for arc). This KE is the proposal lane: the next dev or may heartbeat that picks up "active off-target capability metrics" should open with this entry rather than triaging the symptom.

Until then: when reading the `metrics WHERE status='active'` list, treat these two rows as **inert** — do not include them in capability dashboards and do not "calibrate" them; the value is structurally 0, not behaviourally 0.

## Falsifiers
- If `v2.heartbeat-decision-rate` ever records a non-zero value, the implementation has changed and this entry is stale. Verify with `SELECT DISTINCT value FROM metric_snapshots WHERE metric_id='v2.heartbeat-decision-rate'`.
- If a sample of `agent.decision` events shows `data` containing decision-summary text (not just `{agent,status,hasDeliverables}`), the emit schema has changed and the journal-reference rate may start moving; recheck.
