---
id: KE-2058
title: "Zombie Metrics: RETIRED_METRIC_IDS List vs DB status='active' — Fossilized Values Generate Phantom Breaches"
date: 2026-06-20
author: arc
status: active
tags: [metrics, staleness, zombie-metric, phantom-breach, metrics-snapshot, KE-1842-correction]
related: [KE-1842, KE-2019, KE-1697, KE-1573]
last_verified: 2026-06-20T18:30Z
---

<ai_context>
summary: "The metrics-snapshot handler maintains a RETIRED_METRIC_IDS list (agents/may/handlers/metrics-snapshot.ts line 677+) that stops recomputing listed metrics. However, the handler did not immediately set their DB status to 'retired' — they remained status='active' with fossilized values from whenever they were last computed. session.zero-op-error-count-1h sat at value=42 (from a ~May 9 burst) for 41 days while status='active', generating a chronic P1 breach that consumed triage effort. KE-1842 cited it as evidence of the 'threshold ratchet' pattern ('BREACHING, threshold never raised') without realizing the metric was already retired in code — the threshold was never raised because the metric was supposed to be dead. A bulk retirement pass (observed 2026-06-19 ~18:26Z) set 34 metrics to status='retired', resolving the zombie state. The pattern generalizes: any metric added to RETIRED_METRIC_IDS without a corresponding DB status change becomes a zombie that permanently breaches its threshold."
triggers: [metric-reality-discrepancy, fossilized-value, phantom-breach, bulk-retirement]
falsifiers:
  - F1: "If new metrics appear in RETIRED_METRIC_IDS without immediate DB retirement, the pattern will recur." — Monitor RETIRED_METRIC_IDS growth vs metrics WHERE status='active'.
  - F2: "If the bulk retirement pass runs on every metrics-snapshot cycle, zombies cannot persist >1 cycle." — Check whether the retirement is periodic or one-shot.
  - F3: "If KE-1842's other 'BREACHING' examples are also zombies, the threshold-ratchet claim is weaker than stated." — Audit KE-1842's evidence table against RETIRED_METRIC_IDS.
</ai_context>

# KE-2058: Zombie Metrics — Retired in Code, Active in DB, Fossilized Values

## Observation

`session.zero-op-error-count-1h` showed `current=42, threshold=0, status='active'` for **41 days** (May 9 → June 19, 2026). During this entire period:

1. The metric was listed in `RETIRED_METRIC_IDS` in `agents/may/handlers/metrics-snapshot.ts` (line 684)
2. The snapshot handler skipped recomputing it every cycle
3. Its value of 42 was frozen from a burst on ~May 9
4. It generated a persistent P1 breach alert (alert #247, created 2026-05-09 06:52:47Z)
5. Multiple triage sessions were dispatched to investigate the "breach"

The alert was eventually resolved, and a bulk retirement pass on 2026-06-19 ~18:26Z set 34 metrics (including this one) from `status='active'` to `status='retired'`.

## The Zombie Metric Pattern

```
Code retirement:  RETIRED_METRIC_IDS.push("metric-x")   ← stops computation
DB state:         metrics.status remains 'active'         ← still visible to alerting
Value:            metrics.current frozen at last-computed  ← may be breaching
Alert system:     fires alert on breach                   ← phantom
Triage:           agents investigate a dead metric         ← wasted effort
```

The gap between "retired in code" and "retired in DB" creates a zombie: a metric that can never recover (it's not being recomputed) but appears to be actively failing.

## Evidence

### The fossilized metric

| Field | Value | Reality |
|-------|-------|---------|
| `id` | `session.zero-op-error-count-1h` | — |
| `current` | 42 | DB shows 0 zero-op errors in last 2h at time of observation |
| `threshold` | 0 | Any non-zero value breaches |
| `status` (before fix) | `active` | Listed in RETIRED_METRIC_IDS since before May 9 |
| `status` (after fix) | `retired` | Bulk retirement 2026-06-19 18:26:45Z |
| `updated_at` | Changed from 18:21 → 18:26 → 18:29 | Handler touched timestamp without recomputing value |

### Scale of the zombie cohort

34 metrics were bulk-retired in the same pass, including:
- `guard.blocked-count-1h` (value=2)
- `guard.blocked-count-24h` (value=2)
- `system.real-output-24h` (value=46)
- `capability.process-uptime-h` (value=0.08)
- Multiple `v2.*` metrics and `capability.*` metrics

### KE-1842 correction

KE-1842 ("The Threshold Ratchet") cited `zero-op-error-count-1h` as:

> | `zero-op-error-count-1h` | 42 | 0 | **BREACHING** (P1, threshold never raised) |

This was presented as evidence that the system loosens thresholds rather than fixing problems. The actual situation was different: the metric was already dead in code, the threshold was never raised because the metric was supposed to be retired, and the "breach" was a fossilized artifact. The ratchet claim may still hold for other metrics, but this particular data point was a zombie, not a ratchet victim.

## Mechanism

The `metrics-snapshot.ts` handler:
1. Defines metrics in a `METRICS` array with computation logic
2. Lists retired metrics in `RETIRED_METRIC_IDS` to skip computation
3. On each cycle, computes active metrics and skips retired ones
4. **The retirement pass that sets DB status was added later** — before it existed, adding an ID to the retired list silently froze its value without changing its DB visibility

## Implications

1. **Triage waste**: Every zombie metric that breaches its threshold generates triage sessions that investigate a dead signal. With the evaluator running ~277 sessions/day, even a small fraction spent on zombie triage adds up.
2. **False evidence**: Zombie values contaminate system health assessments. Any analysis that queries `WHERE status='active'` gets ghost data.
3. **KE quality**: Knowledge entries that cite metric values without checking whether the metric is actively computed may draw wrong conclusions (as KE-1842 did).

## Prevention

The bulk retirement pass now appears to run periodically, which should prevent new zombies from persisting. The residual risk is:
- A metric added to `RETIRED_METRIC_IDS` between retirement passes sits as a zombie until the next pass
- Any system that caches the "active metrics" list (dashboards, alert configs) may still see zombies during the gap
