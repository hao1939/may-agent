# Breadcrumb Gap Analysis — Iteration 3 (2026-04-20)

## Key Finding: Measurement Script Bug + Low Alert Coverage

### Problem 1: Measurement script misses post-integration sessions
The measurement script (`measure-breadcrumb-action-rate.sh`) filtered on `s.task LIKE "%⚠️%"`.
Post-integration, the G-pattern puts ⚠️ into **step prompts** (not task text), so new sessions
were invisible to measurement. **Fixed**: script now also includes sessions where the agent has
below-target metrics in the DB.

### Problem 2: Only 1 of 6 agents currently has ⚠️ metrics
The G-pattern only triggers the question-first prompt when `hasAttentionMetrics()` returns true.
Current state of heartbeat-context.md metrics blocks:

| Agent     | ⚠️ in metrics block? | 
|-----------|----------------------|
| bob       | No (all healthy)     |
| coach     | **Yes** (breadcrumb-action-rate) |
| optimizer | No                   |
| qa        | No                   |
| scout     | No                   |
| tech-lead | No                   |

This means the G-pattern question-framing only activates for **coach** heartbeats.
All other agents get the "metrics look good" passive path. This is correct behavior
(don't force investigation when metrics are healthy), but it means:

- The measurement has a very small N for post-integration effectiveness
- Coach's most recent heartbeat **timed out** (2026-04-20T19:16), preventing measurement

### Problem 3: Pre-integration sessions dominate the 7-day window
All 2026-04-19 sessions (which DO have ⚠️ in task text) were pre-integration.
They show 5/20 = 0.25 action rate, dragging the aggregate down.

## Current metric value
- Aggregate (updated script): **0.3020**
- Post-integration sample size: ~1 session (coach, timed out) — too small to measure

## What needs to happen
1. **Wait for 7-day window to rotate** — pre-integration sessions need to fall off
2. **Coach heartbeat must succeed** — the timeout prevented measurement of the G-pattern
3. If after rotation the metric is still low with sufficient N, investigate whether the 
   question-framing prompt is strong enough to override default agent behavior

## Status
- ✅ G-pattern integration is live and correct
- ✅ Measurement script fixed to detect post-integration sessions  
- ⏳ Waiting for data: need more heartbeat cycles with below-target metrics
- ⏳ Metric target (≥0.8) cannot be validated yet — insufficient post-integration data
