# Daily Alert Review — 2026-05-09

**Period:** 2026-05-08 ~09:00 UTC → 2026-05-09 ~09:00 UTC  
**Total alerts:** 52  
**Unresolved:** 2

---

## Summary by Metric

| Metric | Alerts | Resolved | Unresolved | Priority | Owner |
|--------|--------|----------|------------|----------|-------|
| Invalid project.md format | 22 | 22 | 0 | P1 | may |
| Failed session triage rate (3h) | 8 | 8 | 0 | P1 | evaluator |
| Scout good session rate (24h) | 6 | 5 | **1** | P3 | scout |
| Reviewed good sessions overturned (24h) | 5 | 5 | 0 | P2 | evaluator |
| Stale active metrics (>15m) | 3 | 3 | 0 | P1 | may |
| Empty assistant stops (1h) | 1 | 0 | **1** | P2 | may |
| First-turn provider errors (1h) | 1 | 1 | 0 | P1 | may |
| Zero-op session errors (1h) | 1 | 1 | 0 | P1 | may |
| LLM evaluation lag | 1 | 1 | 0 | P0 | evaluator |
| Evaluator triage closure rate (24h) | 1 | 1 | 0 | P2 | evaluator |
| Evaluator meaningful review rate (24h) | 1 | 1 | 0 | P2 | evaluator |

---

## Key Findings

### 🔴 Unresolved Alerts (2)

1. **Empty assistant stops (1h)** — current=23, threshold=15 (P2, owner: may)
   - Fired at ~08:45 UTC, not yet resolved. Indicates sessions ending with empty assistant turns.

2. **Scout good session rate (24h)** — current=26.6%, threshold=65% (P3, owner: scout)
   - Fired at ~02:18 UTC, not resolved. Scout's good session rate is far below target (85%). This has been a recurring issue — 6 alerts in 24h, with the rate declining from 65% to 27%.

### 🟡 Top Noisy Metrics

1. **Invalid project.md format** — 22 alerts, all self-resolving within minutes. This metric fires and resolves constantly (~1 alert/hr). The threshold is 0, so any momentary spike triggers it. **Recommendation:** Raise threshold to ≥2 or add a cooldown period to reduce noise.

2. **Failed session triage rate (3h)** — 8 alerts, all self-resolving. Triage rate dips briefly below 80% then recovers. Transient dips are normal. **Recommendation:** Consider a sustained-breach window (e.g., must stay below threshold for 10+ min before alerting).

### 🟢 Resolved Issues

- **LLM evaluation lag** (P0) — peaked at 65.9h lag, resolved after evaluator caught up. This was the highest-priority alert.
- **First-turn provider errors** — spike of 12 errors in 1h, resolved within ~40min.
- **Zero-op session errors** — spike of 42, resolved within 4min. Likely a transient burst.
- **Evaluator quality metrics** (triage closure, meaningful review, false-good rate) — all briefly breached then recovered.

---

## Owner Summary

| Owner | Total Alerts | Unresolved | Action Needed |
|-------|-------------|------------|---------------|
| may | 27 | 1 | Investigate empty assistant stops; reduce project.md format alert noise |
| evaluator | 16 | 0 | No action — all resolved |
| scout | 6 | 1 | Good session rate declining, needs attention |

---

## Recommendations

1. **Reduce noise on `project.invalid-format-count`** — 22 alerts/day for a self-correcting issue is excessive. Raise threshold or add hysteresis.
2. **Investigate scout good session rate decline** — rate dropped from ~65% to ~27% over 24h. Root cause analysis needed.
3. **Monitor empty assistant stops** — newly unresolved, may indicate a session management issue.
4. **Add alert cooldowns** — several metrics fire and resolve within minutes repeatedly. A minimum re-alert interval would cut noise significantly.
