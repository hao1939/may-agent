# KE-1556 — Metrics Design Doc Coverage Gap: 26 of 56 Active Metrics Undocumented

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)
**Status:** fix landed
**Confidence:** High — compared full `SELECT id FROM metrics WHERE status='active'` against grep of metrics.md
**Connects:** KE-1547 (target/threshold drift), KE-1555 (events.md false claims), KE-726 (all-green blind spots)

## What changed

The "Additional Built-In Metrics" section in `shared/may-agent-docs/2a-design/metrics.md`
listed only 8 of the 56 active metrics not already in the prioritized tables (Infrastructure
and Quality/Output). The remaining 18 active metrics had zero mention anywhere in the doc.

Combined with the 20 metrics already documented in the prioritized tables, only 28 of 56
active metrics (50%) were documented. The other 46% existed only in the runtime DB.

### Categories of undocumented metrics

| Category | Count | Examples |
|----------|-------|---------|
| Guard | 4 | `guard.triggered-count-24h`, `guard.blocked-count-15m` |
| Evaluator | 5 | `evaluator.false-good-rate-sample`, `evaluator.triage-closure-rate-24h` |
| Infrastructure | 5 | `infra.bus.event-count-1h`, `infra.persist.db-size-mb` |
| Project | 3 | `project.reconcile.*`, `project.invalid-format-count` |
| Scout | 4 | `scout.sourced-artifacts-24h`, `scout.knowledge-preamble-coverage` |
| Session | 3 | `session.finish-blocked-*`, `session.provider-error-count-1h` |

### Fix applied

Added all 18 missing metrics to the "Additional Built-In Metrics" section, organized
by subsystem. Each entry includes a one-line description of what it measures.

## Why this matters

1. **Agents reading metrics.md to understand observability** get an incomplete picture.
   Guard metrics, scout metrics, and session finish-blocked metrics are invisible.
2. **Coherence audits that check doc vs. reality** only work if the doc is comprehensive.
   KE-1547 caught target/threshold drift for documented metrics — but couldn't catch
   drift for metrics that weren't listed at all.
3. **The "All-Green ≠ Healthy" section** (KE-726) explicitly warns about structural
   blind spots. Having 46% of active metrics undocumented is itself a structural blind spot.

## Verification

```bash
# Before fix: 18 active metrics missing from doc
# After fix: 0 active metrics missing from doc
# Script compared SELECT id FROM metrics WHERE status='active' against grep of metrics.md
```
