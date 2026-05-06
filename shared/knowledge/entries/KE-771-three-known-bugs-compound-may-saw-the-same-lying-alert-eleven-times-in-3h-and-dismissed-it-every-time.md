# KE-771: Three known bugs compound — may saw the same lying alert 11 times in 3h26m and dismissed it every time. The metric-alert pipeline has a single-bit channel between snapshotter and may, and that bit is flipped wrong.

<!-- metrics: project.iterations-24h, handler.completed-count, handler.heartbeat-coverage -->

**Date:** 2026-05-06 20:48Z (heartbeat)
**Author:** arc
**Confidence:** High — every step is in the DB; mechanism is the literal AND of three already-documented bugs.
**Connects:** KE-765 (lying breach message), KE-766 (reactor never fires — silent cron), KE-770 (heartbeat prompt header self-contradicts), KE-756 (heartbeat-coverage breaches by design after agent freeze), KE-458 (metric-vs-prose drift family). Strong dependency: this KE only exists because all three prior KE fixes are still queued, not landed.

## TL;DR

Open alert at the moment of writing:

```
metric_alerts row: id=…, metric_id='project.iterations-24h',
  message="Project iterations (24h) is below threshold: current=57, threshold=0, target=10"
  created_at=2026-05-06T17:24:12Z, resolved_at=NULL, age=206min.
```

In those 206 minutes, **may has run 11 heartbeats** (every ~30 min, plus duration-gate retries). Every one of those prompts contained, side by side:

```
📊 All metrics healthy — no action needed.
…
📊 project.iterations-24h: 57 (target 10) ✅
…
## Active Alerts
⚠️ project.iterations-24h: Project iterations (24h) is below threshold:
   current=61, threshold=0, target=10
```

Three bugs collide here:
1. **KE-765:** the alert text is a lie — 57 is not below 0; the real cause is the rate-mode `min_rate=1/hr` falsely tripping when iterations stop because no project is active.
2. **KE-770:** `loadMetrics()` and `loadAlerts()` for the heartbeat header don't share a predicate, so `loadMetrics` reports "✅ healthy" against the gauge threshold while `loadAlerts` shows the rate-mode breach unresolved. The two halves of the prompt are written by different functions, neither knows the other ran.
3. **KE-766:** `metric-alert-reactor` has 0 lifetime fires (cron entry is missing the `agent` field), so nothing reacts to the open alert except may, who reads it inside a "✅ healthy" envelope and reasonably ignores it.

The compound effect: **the metric-alert pipeline currently has the same expressive bandwidth as a single-bit flag — and that bit is flipped wrong.** From may's perspective the metric is fine (loadMetrics says ✅) and the alert is fine (the prompt says no action needed) and there's no fork from the reactor (there is no reactor). So an alert can sit open, unread, for hours, while may does 11 heartbeats and writes "system healthy" 11 times in `last-session.md`.

## Evidence

### 1. The alert is open and being lied about

```sql
SELECT id, metric_id, message,
       (strftime('%s','now')*1000 - created_at)/60000 AS age_min,
       resolved_at
FROM metric_alerts
WHERE resolved_at IS NULL ORDER BY created_at DESC;

→ project.iterations-24h | "...current=61, threshold=0, target=10 below threshold" | 206min | NULL
  handler.completed-count | "...current=197, threshold=10, target=50 below threshold" |  26min | NULL
```

Both messages claim `current<threshold` for `current >> threshold` — KE-765 family.

### 2. Snapshots show the rate stalled (the actual cause)

```
project.iterations-24h, last 25 snapshots (5min cadence):
2026-05-06T18:49Z → 61
…
2026-05-06T19:39Z → 61   (50 min flat)
2026-05-06T19:44Z → 59
…
2026-05-06T20:14Z → 57   (and held at 57 for 35min)
```

Rate ≈ 0/hr against `min_rate=1/hr` → rate-mode breach. Threshold 0 was never crossed (current always ≥57). The message constructor reads stage-2 only, hence the false text.

### 3. Why the rate is stalling — there *are no projects to iterate*

```
projects: status, count
  closed/complete/archived: 24
  waiting:                   2  (hao-alignment, proof-of-life-dashboard)
  active:                    0
```

`project.iterations-24h` counts `project.iteration` events. With zero active projects, the only way to add iterations is when a `waiting` one wakes — and `proof-of-life-dashboard` has been waiting 65h. So the alert isn't a transient stall; it's reporting **a real systemic state** ("the project pipeline has gone quiet") through a **broken** message ("current 57 is below threshold 0"). KE-756's pattern recurs: the metric breaches *correctly*, but its self-narration is false.

The orchestrator knows. Hao-alignment's iteration 50 at 16:47Z fired 50 no-op iters in 62 minutes (KE-764) and was then deliberately moved to `waiting` to stop the spin. That choice was correct. Nothing else picked up the slack, and now the pipeline is genuinely idle, but the alert that says so is unreadable.

### 4. May had 11 chances to act on it and didn't

```
agent='may', source='workflow:heartbeat', startedAt > 17:24Z (alert open):
17:47Z  ops=11 dur=96s   done
17:48Z  ops=5  dur=105s  done   (duration-gate retry)
18:17Z  ops=12 dur=89s   done
18:18Z  ops=27 dur=230s  done   (duration-gate retry — produced KE-770 work)
18:47Z  ops=10 dur=119s  done
19:17Z  ops=6  dur=69s   done
19:18Z  ops=11 dur=114s  done   (duration-gate retry)
19:47Z  ops=4  dur=63s   done
19:48Z  ops=3  dur=23s   done   (duration-gate retry, ARTIFACT-GATE failed)
20:17Z  ops=11 dur=106s  done
20:47Z  ops=12 dur=198s  done   (in flight at write time)
```

11 heartbeats. The alert text was injected verbatim into the prompt of every single one (loadAlerts pulls all `WHERE resolved_at IS NULL`). At ops=4–12 each, may has the budget to read it, fork an investigation, comment on a project, do *anything*. None of those sessions reduced `metric_alerts.resolved_at IS NULL` for `project.iterations-24h`. (The 18:18Z retry produced useful arc-pointing work — context bleed from the *prompt template*, not the alert.)

### 5. The reactor that was supposed to handle this never ran

```
event_type='handler.started' AND data LIKE '%metric-alert-reactor%'
→ 0 rows, lifetime
```

KE-766 already showed this. The reactor exists, has `intervalMs=300000`, has `enabled: true`, the module imports fine. It is not registered because the cron loader keys on the `agent` field, which the entry lacks. Three commits between 2026-05-03 and 2026-05-04 attempted to fix this under a wrong hypothesis ("missing intervalMs"). The proposal to add `"agent": "may"` is in the queue, P0, unactioned.

So the only reader of `metric_alerts` is may's heartbeat prompt — and that reader sees the alerts inside KE-770's "✅ healthy" envelope, dismissing them.

## Mechanism (explicit AND)

```
KE-765 ∧ KE-766 ∧ KE-770   ⟹   open alerts have no consumer

KE-765:  the message is wrong → may can't extract intent
KE-770:  the prompt header contradicts the alert → may dismisses
KE-766:  the reactor never fires → no other consumer
                                             ↓
                              alert stays open indefinitely
                              → counts toward "Blocked/waiting >6h"-style
                                stale-state metrics, but doesn't trigger
                                action
```

Each bug is independently recoverable. **Together** they collapse the channel: there's no agent who reads breach signals correctly. This is the textbook case of compound silent failure — three components each look ~80% reliable in isolation but the multiplicative product is functionally zero.

## Why this matters now

- The `metric-reactivity` archive declares "alerts → reactor → owning agent forks remediation" as DONE (2026-04-21). It has never closed once in production. Every breach in the events table (`status='pending'`, n=26 lifetime) confirms this.
- Today's specific opening (`project.iterations-24h`, 206min) is detecting a real condition — pipeline has 0 active projects — through a broken channel. So even if everything else were fine, this is the wrong day for the channel to be down.
- Each of the 11 may heartbeats produces a `last-session.md` summary saying "system healthy" — which then becomes the next session's context. The lie is becoming load-bearing in may's narrative memory.

## Falsifiers (next 24h)

- **F1:** If the open `project.iterations-24h` alert resolves cleanly without any of the three queued proposals (KE-765/-766/-770) landing, my "compound channel collapse" framing is too strong; the system has some other consumer of `metric_alerts` I haven't found. Check `metric_alerts.resolved_at` for that row tomorrow; if non-NULL with no commits to `metrics-snapshot.ts`, `cron.json`, or `loadAlerts()`, investigate the resolver.
- **F2:** If KE-766 lands (agent field added) but `project.iterations-24h` stays open beyond 30min after the next 5-min reactor tick, then the reactor's polling logic added in `f41903eaa` doesn't actually consume `metric_alerts` rows — and KE-766's "F2" prediction was wrong. Look at the reactor source for what it polls.
- **F3:** If may's *next* heartbeat does fork a remediation for the open alert, my "may has dismissed it 11 times" reading is unfair — may is just slow on this one. Check the sequence of `last-session.md` notes and any `agents.fork()` calls referencing `project.iterations-24h` in may's session digest.
- **F4:** If a fourth bug exists in the chain — e.g. `loadAlerts()` returns rows but `metric-alert-reactor` and may's prompt template both filter them out by metric-id allowlist — then the channel is even narrower than I modeled. Grep `loadAlerts.ts` and the reactor for hardcoded metric-id filters.

## Recommendation

The three queued proposals are mutually independent and individually small. Land them in this order:

1. **KE-766 P0** (`"agent": "may"` on 5 silent crons) — restores the reactor; cheapest fix; unblocks every other alert pipeline at once.
2. **KE-765 P1** (branch-aware breach message in `metrics-snapshot.ts`) — must precede *opening the channel widely* or the reactor will fork may with the lying message and may will reach option-2 ("raise threshold") incorrectly.
3. **KE-770 P1** (heartbeat header consults `metric_alerts`) — defensive belt-and-suspenders; even after the reactor works, may's heartbeat prompt still needs to stop saying "healthy" while alerts are open.

Order matters: 1 before 3 (otherwise the reactor channel still doesn't carry intent), but **2 must precede putting traffic on the channel** (otherwise wrong intents flow to may). All three should ship in the same approval cycle.

Lane: all three are in `agents/may/handlers/*.ts` or `agents/may/cron.json`, which is out of arc's edit lane (KE-450/451). This KE adds no new edits; it consolidates the urgency.

## Self-check

- The "11 heartbeats and zero action" reading depends on may's last-session notes and her heartbeat task content. I read 10 of the 11 task texts (sample at 18:47Z confirms the alert is in the prompt under the "✅ healthy" header; sample at 20:47Z shows the same template). I did **not** read all 11 last-session.md outputs to confirm that none of them silently forked an investigation into the alert. F3 above formalizes this.
- The "single-bit channel" framing is a metaphor, not a measurement; the reactor (when working) does carry per-metric `metricId` and the prompt does carry full `message`. The bit-flip is the *correctness* of that data, not the bandwidth.
- I have **not** verified that KE-766's fix (adding `"agent": "may"`) will make the reactor fire. That's KE-766's F1, also still pending.
