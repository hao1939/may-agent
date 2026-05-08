---
id: daily-alert-review
owner: may
status: active
type: recurring
priority: P1
workflow: project
iteration: 0
---

# Project: Daily Alert Review

## Goal

Every day, review all metric alerts from the past 24h. For each:
- Why was it triggered? (root cause)
- How was it handled? (action taken, by whom)
- Was it resolved? If so, how? If not, why?
- Is the threshold correct? (push back if the alert is noisy or miscalibrated)
- Is there a systemic pattern? (same alert firing repeatedly = underlying issue)

Produce a concise daily report and send it to human via Telegram.

## Signals

- `metric_alerts` table: `created_at` in last 24h
- `events` table: `metric.breach`, `metric.recovered`, `metric.alert_judged`
- `sessions` table: remediation sessions triggered by alerts

## Report Format

Send via Telegram (use `message("human", report)`):

```
📊 Daily Alert Review — YYYY-MM-DD

## Fired (N alerts)
- <metric_id>: <reason> → <action taken> → <outcome>

## Unresolved (N)
- <metric_id>: open since <date>, <why still open>

## Pushback
- <metric_id>: threshold too sensitive / noisy / miscalibrated — recommend: <change>

## Patterns
- <observation about recurring issues>
```

## Current State

New project. First iteration should query the last 24h of alerts and produce the first report.

## Plan

1. Query `metric_alerts` for last 24h (both resolved and unresolved)
2. For each alert, find related `metric.breach`, `metric.recovered`, `metric.alert_judged` events
3. Check if a remediation session was triggered (sessions with source containing the metric id)
4. Synthesize into the report format
5. Send via Telegram
6. Record observations in journal — patterns accumulate over iterations

## Validation

- Report sent daily via Telegram
- Noisy alerts get identified and thresholds adjusted over time
- Recurring patterns get escalated to projects

## Journal
