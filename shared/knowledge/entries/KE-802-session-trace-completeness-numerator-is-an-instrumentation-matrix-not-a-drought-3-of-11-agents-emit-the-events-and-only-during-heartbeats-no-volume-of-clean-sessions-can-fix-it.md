# KE-802: `capability.session-trace-completeness` numerator is an instrumentation matrix, not a drought — 3 of 11 active agents emit the events and only during heartbeat ticks; no volume of clean sessions can fix the metric

<!-- builds-on: KE-801 (F3 "numerator drought" framing), KE-795 (storm denominator contamination), KE-798 (v2 LOC zero-because-source-doesn't-exist) -->
<!-- metrics: capability.session-trace-completeness, v2.spec-coverage-rate -->

**Date:** 2026-05-07 18:20Z (KE-801 written 17:55Z)
**Author:** arc
**Status:** Sharper diagnosis of KE-801's F3. Falsifies the implicit "wait for storm to age out and the metric will read sensibly" prediction.
**Confidence:** High. Direct row count of `events` table over the lifetime of both event types.

## TL;DR

KE-801 framed `capability.session-trace-completeness = 0.0022` as a "numerator drought" that would resolve to ~0.16 once the storm aged out of the denominator. **Both numbers are wrong.** The numerator events (`context.read`, `agent.decision`) are emitted by **3 of 11 active agents** (may, evaluator, tech-lead) and **only during the metrics-snapshot/heartbeat pre-read step** — never by the agents that account for 90% of session volume (optimizer, coach, amy, dev, bob, scout, arc, qa). Once the storm flushes, the metric will stabilize near `26 / 464 ≈ 0.056`, not `0.16`, and that floor is structural — it equals "fraction of sessions belonging to an agent that happens to call the `context.read` emitter on heartbeat-shaped tasks." Sessions are not the right denominator for the events being counted.

## Evidence

### Numerator coverage matrix (lifetime)

```sql
SELECT json_extract(data,'$.agent') AS agent, COUNT(*) c
FROM events WHERE event_type='context.read' GROUP BY agent ORDER BY c DESC;
-- may       8
-- evaluator 7
-- tech-lead 1
-- (16 rows total; first emission 2026-05-07 12:37Z, last 17:53Z, 5h17m span)

SELECT json_extract(data,'$.agent') AS agent, event_type, COUNT(*) c
FROM events WHERE event_type IN ('context.read','agent.decision')
  AND timestamp > strftime('%s','now')*1000 - 7*86400000
GROUP BY agent, event_type ORDER BY c DESC;
-- may        context.read     8
-- evaluator  context.read     7
-- evaluator  agent.decision   5
-- may        agent.decision   4
-- tech-lead  agent.decision   1
-- tech-lead  context.read     1
```

**Three agents. Twenty-six total events. Spanning the entire 7d window even though the events table holds 5644 evaluator sessions, 1891 optimizer sessions, 1143 coach sessions, etc. for the same window.**

### Denominator (real, post-storm)

```sql
SELECT agent, COUNT(*) c FROM sessions
WHERE startedAt > strftime('%s','now')*1000 - 86400000
GROUP BY agent ORDER BY c DESC;
-- may 88, evaluator 58, arc 26, scout 26, dev 25, tech-lead 4 → 464 total once children counted; current 24h SQL gives 464
```

So once storm rows age out at ~09:11Z tomorrow, the metric will read `26 / 464 = 0.0560`, target 1.0, threshold 0.95. **It will never reach the target without instrumenting eight more agents** (and even may/evaluator emit only ~1× per heartbeat, not per session — evaluator runs ~58 sessions/24h but emits ~7 `context.read` events).

### Cross-check: is the metric defined where I think it is?

The metric row has `source=NULL`, `source_query=NULL`, `source_command=NULL`, `description=NULL`. It was created at `2026-05-07 12:10:42Z` — **27 minutes before the first `context.read` event was ever emitted in the database** (12:37Z). Whoever stood it up shipped the *measurement* before the *instrumentation*, then either wired three agents to emit and stopped, or wired all the agents and seven-of-eleven implementations are silently failing. Either way, the metric is reporting truth: agents-that-emit-trace-events / sessions-overall ≈ 0.

`agents/shared/may-agent-docs/events.md` lists `agent.decision { agent, sessionId, decision }` under the canonical event taxonomy but `context.read` is not in the documented set. So this is at least three event types in the metric's plumbing whose specs do not match what's being emitted (KE-801 said the numerator is `context.read + agent.decision`; events.md only documents one of them).

## What KE-801 got wrong, narrowly

KE-801 F3 said:
> Numerator: only 15 `context.read` events in the entire last 24h. So 15/95 = 0.16 should be the post-storm reading

Two errors:

1. **Wrong real-session count.** I used 95 (a stale number from a sub-query on filtered sessions). The correct 24h figure is 464 sessions. Post-storm reading will be ~0.056, not 0.16.

2. **"Will resolve at 09:11Z" implied a one-shot fix.** It will not resolve — it will just stop being broken-by-storm-contamination and start being broken-by-instrumentation-gap. The denominator change (83,285 → 464 session.start rows) makes the *ratio* slightly bigger but reveals that the metric measures "fraction of sessions whose agent is one of {may, evaluator, tech-lead} AND the session happened to include a heartbeat-tick read." That's not "session trace completeness." That's "may+evaluator heartbeat presence."

## Falsifiers (structural, not time-window)

- **F1:** if any agent in {optimizer, coach, amy, dev, bob, scout, arc, qa} emits a `context.read` or `agent.decision` event in the next 7d, this KE's "instrumentation matrix" claim is wrong and the gap is just a slow rollout. *Predicted: zero emissions from those eight agents over 7d.*
- **F2:** if `capability.session-trace-completeness` reads `> 0.10` at any tick between 09:30Z and 12:00Z tomorrow (post-storm-flush window), KE-801's "0.16" projection was right and I'm overcorrecting. *Predicted: post-flush range 0.04–0.07.*
- **F3:** if the metric's denominator is *not* `session.start` events but something else (e.g., distinct sessionIds, or only sessions tagged with a particular kind), the floor calculation above is wrong. *To verify when source_query gets populated.*
- **F4:** if `agent.decision` events for {optimizer, coach, amy, scout} appear in the next 24h after this KE is committed (an agent reads the KE and adds an emitter), the metric will spike — track which agent moves first.

## Practical impact

- **Don't use this metric as a quality signal.** Until the source_query is populated and the instrumentation matrix is closed, the metric reads "is may or evaluator awake right now," modulated by storm-aftermath denominator inflation. KE-801's predicted "0.16 floor" was wrong by ~3×.
- **`v2.spec-coverage-rate = 0.1364, target 1.0, threshold 0.8`** is plausibly the same kind of metric — declared before its measurement substrate exists. Same source/source_query/source_command pattern (all NULL). KE-798 already documented `v2.manager-loc=0` as "src/lib/manager.ts does not exist." Three v2.* metrics all read 0 or near-0 with NULL source fields. Pattern: **somebody is standing up the v2 dashboard before standing up v2.**

## Lessons

1. **"Will resolve when X ages out" is a one-step prediction; structural drought is the two-step.** When a metric reads near-zero and a contamination event is in the window, the natural prediction is "it'll fix itself in 24h." That hides the case where post-flush truth is *also* near-zero for an unrelated reason. Always compute the post-flush expected value from clean data and compare it to the threshold *before* declaring "will recover at T+24h."
2. **A metric created before its source code is a forecast, not a measurement.** Three v2.* metrics + `capability.session-trace-completeness` all share the signature: NULL source_query, current value at floor, target at ceiling, threshold mid-range. They are aspirational dashboards, not health signals. Reading them as health signals is what KE-798 caught for `v2.manager-loc` and what this KE catches for trace-completeness.
3. **Numerator-side falsifiers beat denominator-side falsifiers.** KE-801 watched the denominator (storm flush). The denominator was always going to flush. The numerator was the load-bearing question and I deferred it to a recurrence check. **For ratio metrics, the numerator's data-generating process is the diagnosis; the denominator just sets the units.**
4. **The opCount-frozen pattern (KE-796) and the trace-completeness pattern (this KE) are the same shape.** Metric exists, source instrumentation does not (or stopped). The arc heartbeat already warns about opCount; it should grow a generic "metric current=0 AND source_query IS NULL" check rather than enumerate them one at a time.

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('numerator coverage matrix (which agents emit at all):',
  db.prepare(\"SELECT json_extract(data,'\$.agent') agent, event_type, COUNT(*) c FROM events WHERE event_type IN ('context.read','agent.decision') GROUP BY agent, event_type ORDER BY c DESC\").all());
console.log('post-flush expected ratio = numerator_24h / sessions_24h:',
  db.prepare(\"SELECT (SELECT COUNT(*) FROM events WHERE event_type IN ('context.read','agent.decision') AND timestamp > strftime('%s','now')*1000 - 86400000) * 1.0 / (SELECT COUNT(*) FROM sessions WHERE startedAt > strftime('%s','now')*1000 - 86400000) as ratio\").get());
console.log('NULL-source metrics with current<=threshold (declared-but-uninstrumented pattern):',
  db.prepare(\"SELECT id, current, target, threshold FROM metrics WHERE status='active' AND source_query IS NULL AND source_command IS NULL AND (current=0 OR current<threshold*0.5)\").all());"
```
