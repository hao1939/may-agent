# Design: Metric Types & SDK

**Status**: draft (convention now, SDK later)
**Date**: 2026-04-27

## Problem
All metrics are treated as gauges. Counters accumulate forever ("523 fires" is meaningless). Histograms lose distribution info when stored as a single value. No convention for how to interpret different metric types.

## Metric Types

### Gauge
A point-in-time value. Most metrics are this.

- **Store**: current value
- **Show**: current value
- **Examples**: handler.success-rate (0.95), project.active-count (3), handler.heartbeat-coverage (8)

### Counter
A value that only goes up. Meaningful as a **rate** (delta per interval).

- **Store**: value within a time window (not cumulative total)
- **Show**: value per interval or per hour
- **Examples**: handler.fires-per-hour (35), project.iterations-24h (12)
- **Convention**: metric name includes the window (`-per-hour`, `-24h`). The measurement query uses `WHERE timestamp > ?` to compute the count within the window, not a cumulative sum.

### Histogram
A distribution of values. Meaningful as **percentiles**.

- **Store**: percentile value (p50, p95, p99) within a time window
- **Show**: the percentile value
- **Examples**: handler.p95-duration (262000ms)
- **Convention**: metric name includes the percentile (`p95-`). The measurement query sorts values and picks the percentile index.

## Current Conventions

Since we don't have an SDK yet, follow these rules:

1. **Counters**: always query with a time window. Store the windowed count, not cumulative.
   ```sql
   -- Good: count in last hour
   SELECT COUNT(*) FROM events WHERE event_type = 'handler.started' AND timestamp > ?
   
   -- Bad: cumulative total
   SELECT COUNT(*) FROM events WHERE event_type = 'handler.started'
   ```

2. **Histograms**: query with a time window, sort, pick percentile.
   ```sql
   -- p95 in last 6h
   SELECT value FROM events WHERE ... ORDER BY value ASC
   -- then pick index at 95th percentile in code
   ```

3. **Gauges**: just read the current value. No window needed.
   ```sql
   SELECT COUNT(*) FROM projects WHERE status = 'active'
   ```

4. **Naming**: include the window or percentile in the metric name.
   - `handler.fires-per-hour` (counter, 1h window)
   - `project.iterations-24h` (counter, 24h window)
   - `handler.p95-duration` (histogram, p95)
   - `handler.success-rate` (gauge, but computed over 6h window)

## Future: Metric SDK

When we need it, build a simple SDK:

```typescript
const metrics = createMetricStore(db);

// Gauge
metrics.set("handler.success-rate", 0.95);

// Counter — SDK computes delta automatically
metrics.increment("handler.fires");
// Internally: stores cumulative, snapshot stores delta since last snapshot

// Histogram — SDK computes percentiles
metrics.observe("handler.duration", 45230);
// Internally: stores in a ring buffer, snapshot computes p50/p95/p99

// Snapshot (called by metrics-snapshot handler)
metrics.snapshot(); 
// Writes all metrics to metric_snapshots table with correct values
```

**Build when**: we add 10+ counter/histogram metrics and the SQL-in-handler approach becomes unmaintainable.

**Not now because**: 24 metrics, all working, SQL queries are readable and correct.
