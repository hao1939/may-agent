# Metrics Dashboard — Design Document

**Author**: tech-lead  
**Status**: approved  
**Date**: 2025-06-21

## Overview

Single-page web dashboard for browsing system metrics, monitoring agent health, and surfacing items needing attention. Served by a lightweight Node.js HTTP server using only built-in modules (`node:http`, `node:sqlite`).

## Architecture

```
┌─────────────────────────────────────┐
│  Browser (single HTML page)         │
│  - Vanilla JS, no framework         │
│  - CSS Grid layout, responsive      │
│  - Auto-refresh every 30s           │
│  - LocalStorage for pinned metrics  │
└──────────────┬──────────────────────┘
               │ fetch(/api/*)
┌──────────────▼──────────────────────┐
│  Node.js HTTP Server (port 3200)    │
│  src/dashboard/server.ts            │
│  Routes:                            │
│    GET /              → HTML page   │
│    GET /api/metrics   → all metrics │
│    GET /api/snapshots?id=X → history│
│    GET /api/status    → system overview │
│    GET /api/attention → needs-attention │
│    GET /api/alerts    → recent alerts   │
│    POST /api/pin      → toggle pin  │
└──────────────┬──────────────────────┘
               │ node:sqlite
┌──────────────▼──────────────────────┐
│  .state/may.db                      │
│  Tables: metrics, metric_snapshots, │
│  metric_alerts, requests, sessions  │
└─────────────────────────────────────┘
```

## Data Model

### Metrics (from `metrics` table)
- id, name, type, owner, current, target, threshold, unit, status, priority
- alert_direction: "above" or "below" — determines status color

### Status Derivation
- **green**: meets target (current >= target if below, current <= target if above)
- **yellow**: between threshold and target
- **red**: beyond threshold
- **stale**: no snapshot in 2x measure_interval

### Pinned Metrics
Stored server-side in a `dashboard_pins` table (created on first run):
```sql
CREATE TABLE IF NOT EXISTS dashboard_pins (
  metric_id TEXT PRIMARY KEY,
  pinned_at INTEGER NOT NULL
);
```

## Page Layout

```
┌─────────────────────────────────────────┐
│  🎯 Metrics Dashboard        [refresh] │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Agents  │ │Requests │ │Sessions │   │
│  │ Active:9│ │Today:500│ │Fail: 2% │   │
│  └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────┤
│  ⚠️ NEEDS ATTENTION (3)                 │
│  • 2 stale requests (>2h old)           │
│  • 1 failed session (bob)               │
├─────────────────────────────────────────┤
│  📌 PINNED METRICS                      │
│  workflow-coverage  85% ▶ 90%  [unpin]  │
│  session-success    94% ▶ 95%  [unpin]  │
├─────────────────────────────────────────┤
│  ALL METRICS  [filter: owner|type|status]│
│  metric-name   current  target  status  │
│  ...                                    │
└─────────────────────────────────────────┘
```

## API Endpoints

### GET /api/metrics?owner=X&type=X&status=X
Returns all metrics with optional filters. Includes pin status.

### GET /api/snapshots?id=X&limit=20
Returns recent snapshots for sparkline rendering.

### GET /api/status
Aggregated system health:
- Active agents (distinct agents with session in last 6h)
- Request throughput (completed in last 24h)
- Session success rate (last 24h)
- Active alerts count

### GET /api/attention
Items needing attention:
- Stale requests (IN_PROGRESS > 2h)
- Failed sessions (last 24h)
- Unresolved alerts
- Blocked requests

### POST /api/pin {metricId}
Toggle pin status for a metric.

## Implementation Plan

1. `src/dashboard/server.ts` — HTTP server + API routes
2. `src/dashboard/db.ts` — Database queries
3. `src/dashboard/index.html` — Single page with inline CSS/JS
