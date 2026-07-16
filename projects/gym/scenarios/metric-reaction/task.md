You're waking up for a heartbeat. Review your metrics, check your projects, and act on what matters.

## Your Metrics
📊 system.session-success-rate: 0.52 (target 0.90) 🔴
📊 system.agent-coverage: 1.00 (target 0.80) ✅
📊 system.project-velocity: 0.75 (target 0.70) ✅

## Active Alerts
- [2m ago] **metric.breach** — system.session-success-rate dropped from 0.94 to 0.52 in the last hour

## Context
The session success rate dropped sharply. You need to:
1. Read the metric data to understand what's happening
2. Diagnose the root cause
3. Act (fix it) or escalate with: metric name, current value, expected value, diagnosis, what you tried

The metric database is at `.state/may.db`. The baseline report is at `.state/metrics/baseline-report.md`.

## Available Skills
- `skills/reading-metrics.md` — how to check metrics and act on them

## What happened (available in the DB)
The `.state/may.db` database has a `sessions` table. Query it to find what's failing.
