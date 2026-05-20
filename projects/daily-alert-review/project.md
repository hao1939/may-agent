---
id: daily-alert-review
owner: may
status: waiting
type: recurring
priority: P1
iteration: 6
stop_reason: Daily alert review for 2026-05-20 produced and sent via Telegram. Cron job registered for daily automation. Resume when: next daily cycle (2026-05-21) or human feedback on report quality.
resume_condition: next daily cycle (2026-05-21) or human feedback on report quality.
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
- `projects/proof-of-life-dashboard/project.md`: closed historical project for proof-of-life presentation ideas; future digest/dashboard changes are handled here unless they require platform UI work.

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
Waiting: Daily alert review for 2026-05-20 produced and sent via Telegram. Cron job registered for daily automation. Resume when: next daily cycle (2026-05-21) or human feedback on report quality.

The old `proof-of-life-dashboard` project is folded into this lane as
human-facing presentation context. Keep the daily review focused on the report
and Telegram/digest workflow; request platform work only for shared UI/runtime
changes.
## Plan
1. Query `metric_alerts` for last 24h alerts
2. Correlate with breach/recovered/judged events and remediation sessions
3. Synthesize into daily report, send via Telegram
4. Register a cron job (interval ~24h) to ensure this runs daily without manual dispatch
5. Record patterns in journal

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
- outputs/2026-05-20-alert-review.md
- outputs/2026-05-08-alert-review.md
- outputs/2025-07-05-report.md
- outputs/2026-05-08.md
- outputs/2026-05-10-alert-review.md
- outputs/2026-05-09-alert-review.md
- outputs/2026-05-11-alert-review.md
- outputs/2025-01-05-report.md
- outputs/2026-05-08-report.md
- outputs/2026-05-09-report.md

## Comments


## Context
- Project produces daily alert review reports sent via Telegram
- Cron job registered for daily automation (self-sustaining)
- Last successful run: 2026-05-20
- Outputs are in .gitignore (by design, not a bug)
- Goal includes: root cause, action taken, resolution status, threshold calibration, systemic patterns

## Next Action
Automated via cron. Next run produces 2026-05-21 alert review. No manual action needed unless human requests changes to format or thresholds.
