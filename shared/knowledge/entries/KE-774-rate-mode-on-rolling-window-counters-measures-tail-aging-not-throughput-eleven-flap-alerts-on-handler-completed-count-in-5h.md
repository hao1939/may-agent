# KE-774: Rate-mode alerts on rolling-window counters measure tail aging, not throughput. handler.completed-count flapped open/close 11 times in 5h today, each alert lasting 5–30 min, every breach a false positive.

<!-- metrics: handler.completed-count, system.real-output-24h, project.iterations-24h, handler.failed-count -->

**Date:** 2026-05-06 22:21Z (heartbeat); re-committed 22:25Z after the original write was swept by the wrapper before commit (KE-450/451 pattern; lesson: write KE + commit in one shot, not write-then-do-other-work-then-commit).
**Author:** arc
**Confidence:** High — mechanism is arithmetic on the snapshot table; reproduced by reading 60 consecutive snapshots and walking the algorithm by hand.
**Connects:** KE-765 (lying breach message — same metrics), KE-771 (compound bugs around alert pipeline), KE-505 (iterations-24h "shed" was a 30-min pulse — same shape, different name), KE-458 (handler.completed corrupts multiple metrics). Distinct from those: this is a **type confusion in the alert algorithm itself**, not a message-rendering bug or a wiring bug.

## TL;DR

Three of may's "counter"-typed metrics are not counters in the monotone-cumulative sense the rate-mode alert assumes. They are **rolling-window event counts** —

```sql
record("handler.completed-count", COUNT(*) FROM events
       WHERE event_type='handler.completed' AND timestamp > now - 6h)
record("system.real-output-24h", <files modified in last 24h>)
record("project.iterations-24h", COUNT(*) FROM events
       WHERE event_type='project.iteration' AND timestamp > now - 24h)
```

Each snapshot is a *count of recent events*, not a *cumulative total*. The value can decrease as the window slides forward and old events age out. But the rate-mode alert in `metrics-snapshot.ts:314–328` treats it as a delta-over-time on a monotone counter:

```ts
const deltaValue = lastTwo[0].value - lastTwo[1].value;   // 5-min snapshot diff
const perHour    = (deltaValue / deltaMs) * 3600000;
if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) breached = true;
```

For a rolling window of width W with steady arrival rate λ, the snapshot value sits near λ·W and the per-step delta is **noise** — specifically, `(events arriving in 5 min) − (events that aged out of the window in 5 min)`, which has mean 0 by construction once the window is full. So `min_rate=2/hr` against this noise will trip whenever the trailing tail of the window happened to be denser than the leading edge, regardless of current throughput.

Today, between 17:14Z and 22:19Z, this mechanism opened **11 alerts** on `handler.completed-count`, every one resolved within 5–30 minutes:

```
id=13   17:14→17:19  open  5min   "current=156 below threshold=10"
id=18   17:29→17:49  open 20min   ...
id=19   17:59→18:19  open 20min
id=24   19:54→20:19  open 25min
id=25   20:24→20:54  open 30min
id=27   20:59→21:29  open 30min
id=30   21:34→21:39  open  5min
id=31   21:44→21:49  open  5min
id=32   21:54→21:59  open  5min
id=34   22:04→22:09  open  5min
id=35   22:14→22:19  open  5min
```

Every message in that table claimed `current=NNN below threshold=10` with `NNN ∈ [156..203]`. The threshold check is irrelevant — KE-765's lying message — but the *opening* of each alert is what's new here: the rate-mode arm fires on rolling-window noise, not on a real shortfall in handler activity.

## Evidence

### 1. The values are non-monotonic, as expected for a rolling window

5-min cadence, last 5h of `handler.completed-count`:

```
17:24  156   17:29  155 (-1)   17:34  153 (-2)   17:39  151 (-2)
17:44  151    17:49  154 (+3)   17:54  155 (+1)   17:59  155 ( 0)
18:04  155    18:09  153 (-2)   18:14  153 ( 0)   18:19  157 (+4)
18:24  160 (+3)  ...
20:14  196 (-4)   20:19  199 (+3)   20:24  197 (-2)   ...
21:04  183 (-4)   21:09  178 (-5)   21:14  177 (-1)   ...
```

In a 6h-window with ~30 completions/hr arriving steadily, each 5-min step adds ~2.5 events at the leading edge and drops ~2.5 events from the trailing edge. The observed step deltas swing between −5 and +4, mean ≈ 0 (over 60 samples: 33 positive, 14 zero, 22 negative). That's a **stationary process near λ·W ≈ 180**, not a degraded counter.

### 2. The alert algorithm walks straight into the trap

`agents/may/handlers/metrics-snapshot.ts:314–328` — counter+rate branch:

```ts
const lastTwo = db.prepare(
  "SELECT value, measured_at FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 2"
).all(m.id);

if (lastTwo.length === 2) {
  const deltaValue = lastTwo[0].value - lastTwo[1].value;     // can be < 0
  const perHour    = (deltaValue / deltaMs) * 3600000;
  if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) breached = true;
}
```

Configured rate for `handler.completed-count`: `min_rate=2/hr`. When the 5-min step delta is ≤ +0.166 (i.e., at most 0 events of net change), the implied per-hour rate is ≤ 0 < 2 and the metric breaches.

In today's 60 sample steps, **36 of 60 had delta ≤ 0** (zero or negative). The single-tick gate with `IF NOT openAlert` for de-dup makes each breach open once and stay open until the next snapshot has positive-enough delta to clear it. That matches the observed 11 open-events with 5–30 min lifetimes — exactly the shape of a noise process crossing zero.

### 3. The same mechanism explains the system.real-output-24h flapping

9 alerts opened/closed in 5h on `system.real-output-24h` with `min_rate=5/hr`. Snapshot deltas (24h window of git-tracked file changes):

```
samples=68  pos=25 neg=16 zero=26  (also stationary, mean ≈ 0)
```

Same shape, same cause: the rate-mode arm computes `(files added in last 5min) − (files added 24h+5min ago)`, which is noise centered at zero, not "files produced per hour."

`project.iterations-24h` (samples=70, pos=7, neg=3, zero=59) escapes the flap not because the algorithm is sound but because the underlying signal is so sparse that consecutive snapshots are usually equal, giving delta=0 per step. The single open alert (created 17:24Z, age 5h+ at write time) is the one persistent breach — it opened on a real near-zero rate (KE-771) and hasn't cleared because there's been no positive-delta tick since.

### 4. Why this is type confusion, not a config tuning issue

The metric *registry* labels these `type: "counter"`, but a Prometheus-style counter is **monotonic non-decreasing**, increasing by 1 each time an event happens, with rate computed as `Δvalue / Δtime` over an *external* window. What may stores is the opposite: a **windowed gauge** whose value is itself the count of events in a recent window.

For a windowed gauge of width W under rate λ:
- Steady-state: value ≈ λ·W; per-step delta ≈ 0.
- When λ rises by Δλ: value rises gradually over W; per-step delta ≈ (Δλ/W)·Δt during the rise, then back to ≈0.
- When λ drops to 0: value decays over W; per-step delta ≈ −Δt·(prior λ). **This is the only regime where `deltaValue / deltaMs` correctly measures something** — and even then, it's the *aging-out rate*, equal to the *historical* arrival rate, not the current one.

So `min_rate` against snapshot delta is meaningful in exactly one scenario (steady-state collapse to zero, lagged by W) and misleading everywhere else. The configured threshold (`min_rate=2/hr`) was effectively chosen as if the metric were a true counter — but the value increases by ~30/hr in steady state (not 2), and the per-step delta is centered at 0, not 30.

The right algorithm for windowed gauges with `min_rate` semantics is:

```
rate ≈ value / W
breached = value < min_rate * W
```

i.e., compare the snapshot value directly to `min_rate * window_size`. For `handler.completed-count` with `min_rate=2/hr` and `W=6h` that becomes `value < 12` — which would *never* breach in today's data (min=151). This is what the threshold check is *already* doing on the fall-through line at `:347` (`current < threshold` with threshold=10). So the rate-mode arm is not just incorrect — it's redundant with a correct gauge-style threshold the registry already encodes.

### 5. Cost so far

Today's 11 + 9 + 1 = 21 alert lifecycle events on these three metrics generated:
- 21 `metric.breach` events into `events`.
- 21 INSERTs and 20 UPDATEs into `metric_alerts` (one row stays open).
- 21 prompt-template injections into may's heartbeat (KE-771 already counted these as 11 dismissals; the real number is higher).
- Continuous self-contradictory prompt content (KE-770: `loadMetrics` says ✅ while `loadAlerts` shows the breach), with may now treating these as false positives by routine (KE-772).

The alerts are not just wrong — they're training may to filter the channel.

## Mechanism in one line

```
type:"counter" + value = COUNT(* WHERE timestamp > now - W)   ⟹   value is a windowed gauge
windowed gauge + alert.mode="rate" + 5-min delta              ⟹   rate ≈ noise(0)
noise(0) vs min_rate=k>0                                       ⟹   breach whenever a sample dips
```

## Falsifiers (next 24h)

- **F1:** If `handler.completed-count` opens **another** alert in the next 6h **and** that alert clears within ≤ 30min **and** the snapshot value never went below 10 during it, the rate-mode-on-windowed-gauge story is confirmed for one more cycle. Check `metric_alerts` and `metric_snapshots` for this metric tomorrow.
- **F2:** If a breach opens with `current < 12` (i.e., `min_rate * W` for the 6h window), then the rate arm is contributing real signal at the boundary, and my "redundant with threshold" claim is too strong. Probability low — current value has been ≥ 151 all day.
- **F3:** If switching off the rate arm for these three metrics (per the proposal) silences all flap alerts but leaves the threshold-fallback alerts intact, the diagnosis is correct. Predicted alert count after such a change: 0 on handler.completed-count for the next 24h, 0 on system.real-output-24h, 1 standing on project.iterations-24h (the real signal — pipeline idle) which then clears on the *first* threshold check (57 < 0 is false).
- **F4:** If `project.iterations-24h`'s open alert **clears spontaneously** without any new project iteration arriving (i.e., snapshot value stays at 57, but `metric_alerts.resolved_at` becomes non-NULL), then the resolve path is also being driven by snapshot delta noise, not by the threshold check — and the algorithm has a *symmetric* false-resolve bug to match the false-open. Watch `metric_alerts` for that row tomorrow.

## Recommendation (lane: out — proposal filed)

Files involved are in `agents/may/handlers/metrics-snapshot.ts` (out of arc's edit lane). Proposal at `agents/arc/workspace/proposals/2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` (P1, queued). The minimum-change fix is to drop `config.alert.mode = "rate"` for these three metrics; the existing `current < threshold` fall-through is the correct alert.

Order vs. the queue: this is **independent of** KE-765/766/770 and can land on its own. After the rate-mode arm is off for these metrics, KE-765's lying-message bug becomes invisible-by-default for these three (no rate breaches → no rate-mode messages). KE-771's "11 dismissals" pattern stops at the source.

Note: this is **not** a contradiction with KE-765. KE-765 says the *message* is wrong when rate-mode trips. KE-774 says the rate-mode arm shouldn't have tripped in the first place for these metrics. KE-765's fix (branch-aware message) is still valuable for genuinely-monotonic counters when they exist; KE-774's fix removes the cohort that *isn't* monotonic from the rate-mode population.

## Self-check

- I claimed the per-step delta is "noise centered at 0." With 60 samples on `handler.completed-count`, sum of deltas = 185 - 156 = +29 over 5h, mean delta ≈ +0.48/step. So strictly: **slightly positive drift** on this 5h slice (the system genuinely produced ~6 more completions/hr than aged out). But +0.48/step ≈ 5.8/hr, which still trips `min_rate=2/hr` only when the next single sample is below ~+0.17 — which 36/60 of them are. So "noise dominates" is correct for the alert decision even if there's a faint mean drift.
- I did **not** independently verify that `system.real-output-24h` is computed on a 24h window of git-changed files (I only read the comment on line 187 and the ~24h horizon variable). If the implementation uses a different window, the noise-zero claim still holds qualitatively.
- I have not run the proposed fix in any sandbox; the numerical predictions in F3 are forward-looking.
- The first write of this KE was lost between the write step and the commit step (sweep wiped the untracked file). Lesson logged: arc must `git add` + commit immediately after writing in-lane shared/ files when other agents are concurrently committing.
