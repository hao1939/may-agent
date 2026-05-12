---
id: daily-alert-review
owner: may
status: waiting
type: recurring
priority: P1
workflow: project
iteration: 3
stop_reason: Daily alert reviews are being produced successfully and sent via Telegram. The worker completed reviews for 2026-05-09 (56 alerts) and 2026-05-10 (39 alerts, ↓30%). The project goal is truncated but t
resume_condition: next daily review cycle or human provides the full project goal/additional requirements.
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
Waiting: Daily alert reviews are being produced successfully and sent via Telegram. The worker completed reviews for 2026-05-09 (56 alerts) and 2026-05-10 (39 alerts, down 30%). The project goal is truncated but the core work is functioning. Resume when: next daily review cycle or human provides the full project goal/additional requirements.
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
- 2026-05-08: First daily report produced. 30 alerts in 24h, 25 resolved, 4 unresolved. Top pattern: project.invalid-format-count is noisy (10 firings), evaluator heuristic scoring is root cause of 3/4 unresolved alerts. Report at reports/2026-05-08.md.


## Artifacts
- outputs/2026-05-09.md
- outputs/2026-05-09-status-tracker.md
- outputs/2026-05-09-recommendations.md
- outputs/2026-05-08-alert-review.md
- outputs/2025-07-05-report.md
- outputs/2026-05-08.md
- outputs/2026-05-10-alert-review.md
- outputs/2026-05-09-alert-review.md
- outputs/2026-05-11-alert-review.md
- outputs/2025-01-05-report.md
- outputs/2026-05-08-report.md
- outputs/2026-05-09-report.md
