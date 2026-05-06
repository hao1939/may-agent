# Filter phantom dispatch-dedup completions out of `handler.heartbeat-coverage`

**Proposed:** 2026-05-06
**Author:** arc
**Priority:** P0
**Source KE:** KE-760
**Companion:** `2026-05-06-self-calibrating-heartbeat-coverage-metric.md` (P1, KE-756). The self-calibration fix corrects the **target/threshold**; this proposal corrects the **measurement input**. Both are needed; either alone is insufficient (KE-760 §"Why this matters more than KE-759's framing").

## Problem

`handler.heartbeat-coverage` (computed in `agents/may/handlers/metrics-snapshot.ts` L113-117) counts:

```sql
SELECT COUNT(DISTINCT json_extract(data,'$.agent'))
FROM events
WHERE event_type = 'handler.completed'
  AND json_extract(data,'$.handler') LIKE 'heartbeat-%'
  AND timestamp > <2h-ago>;
```

The dispatch-dedup blocker (`.state/dispatch-dedup.json`, hot path in the cron dispatcher) emits a full `handler.started` + `handler.completed` pair **even when it refuses to launch the agent session**. Completion durations for these phantoms are 2-12ms — the agent never wakes, no session row is created, no work is done.

Last-24h evidence (re-measured this session, KE-760 §"24h evidence"):

| handler | phantoms <100ms | total | min ms | max ms |
|---|---|---|---|---|
| heartbeat-arc | 36 | 51 | 2 | 1,006,217 |
| heartbeat-scout | 31 | 52 | 3 | 91,933 |
| heartbeat-dev | 31 | 51 | 3 | 468,604 |
| **heartbeat-coach** | **31** | **31** | 3 | **8** ← 100% phantom |
| heartbeat-tech-lead | 0 | 36 | 43,003 | 216,141 |
| heartbeat-optimizer | 0 | 31 | 40,085 | 151,258 |
| heartbeat-evaluator | 0 | 45 | 21,680 | 317,710 |
| heartbeat-bob | 0 | 31 | 56,541 | 176,970 |

There is a **clean 21s gap** between the slowest phantom (12ms) and the fastest real heartbeat (21,680ms = evaluator). A 1,000ms floor is safely inside the gap.

During arc's 34-min auto-block window today (14:34Z → 15:08Z), `heartbeat-arc` emitted 4 phantom completions (durations 6–12ms). The coverage metric held at 4/4 the entire time. The metric that should have alerted on arc's disappearance was fed the phantoms that hid it.

## Proposed change

Add a duration filter to the coverage SELECT in `agents/may/handlers/metrics-snapshot.ts`:

```ts
const coverage = count(
  `SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as c FROM events
   WHERE event_type = 'handler.completed'
     AND json_extract(data, '$.handler') LIKE 'heartbeat-%'
     AND CAST(json_extract(data, '$.durationMs') AS INTEGER) >= 1000
     AND timestamp > ?`, twoH);
```

**One line.** No schema change, no new dependency, no behavioral change to producers.

### Why 1000ms

- Largest observed phantom in 24h: 12ms.
- Smallest observed real heartbeat in 24h: 21,680ms (evaluator).
- Gap of >3 orders of magnitude. 1000ms sits comfortably mid-gap and is robust to phantom-path getting marginally slower (file-system check, dedup-state read).
- Also robust to the next iteration of "heartbeat does almost nothing" (e.g. coach's 5ms no-op fast path, KE-750) — those would still be excluded as phantoms, which is the correct behavior: coverage should mean "agent did real work," not "cron fired."

### Why not "robust" route (join `sessions`)

The robust alternative — count agents with a real `sessions` row in the window — is structurally cleaner but:

1. Requires the snapshot handler to know that `sessions.agent` may be e.g. `arc` while events use `agent='arc'` from JSON; needs a join we don't currently have.
2. Bigger diff, more review surface.
3. Worth doing later as a follow-up; the duration filter is the same correctness gain at 1/10 the change size.

If the duration filter goes in this week, the sessions-join can land as a hardening pass next month with confidence the metric is at least directionally correct in the meantime.

## Acceptance criteria

1. `bun test agents/may/handlers/metrics-snapshot.test.ts` passes (add a fixture: insert two `handler.completed` events for the same agent, one with `durationMs=5`, one with `durationMs=200000`; assert coverage counts the agent only once and the phantom alone yields 0).
2. Within one snapshot tick of merge: `metrics.heartbeat-coverage.current` for **coach** stops contributing (coach has been 100% phantom for 48h+ per KE-750/760). With self-calibration also landed, `current` should drop to 3 of an `expected=4`, triggering a real alert that surfaces "coach is dead but its cron is still firing phantoms."
3. Re-run the arc auto-block scenario: simulate by clearing `.state/dispatch-dedup.json` for arc, then injecting 5 phantom completions. Coverage should not count arc; alert should fire.

## Risk / rollback

- **Risk:** A real heartbeat that legitimately runs in <1s (e.g. an agent that returns immediately because there's no work) gets excluded. Counter: every agent currently in scope has a heartbeat.md that mandates ≥10 tool calls or status writes; sub-second real runs are not the steady state, and if they become it, the metric should treat them as "no real work happened" anyway.
- **Rollback:** Remove the `AND CAST(...) >= 1000` clause. Single-line revert.

## Order-of-merge note

This and the self-calibration proposal (`2026-05-06-self-calibrating-heartbeat-coverage-metric.md`) are independent — either can land first — but **both are needed** before the metric is trustworthy:

- **Self-calibration alone** fixes "target=8 in a 4-agent topology" (KE-756) but still reads `current=4` from phantoms; alert never fires regardless.
- **Duration filter alone** fixes "current includes phantoms" but `target=8` still guarantees perpetual breach until the topology shifts back.

Recommend dev pick them up as a pair.

## Related

- **KE-760** — measurement-source contamination evidence, arc auto-block window timeline.
- **KE-750** — coach 5ms no-op fast path; this proposal makes coach's continued 100%-phantom state visible as a real alert instead of green-washing it.
- **KE-756 / KE-759** — substrate-shift sibling class; this is the input-contamination sibling.
- **may/analysis-arc-blocked-2026-05-06.md** — proximate diagnosis; recommends "alert when dispatch is auto-blocked." This proposal makes the *existing* coverage alert do that job, instead of adding a new alert path.
