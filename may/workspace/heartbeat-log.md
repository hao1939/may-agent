# May Heartbeat Log — 2026-05-09 07:07 UTC

## System Health Summary
- **Active sessions**: 137 (many stale/interrupted)
- **Success rate (1h)**: 40% (27/67)
- **Error rate (6h)**: 17.15% — within threshold
- **Cron**: 27 jobs active, all healthy

## Key Alerts
- ⚠️ **First-turn provider errors**: 35 in 1h (threshold: 10) — FAILING
- ⚠️ **Scout operational friction rate**: 70.8% (threshold: 30%)
- ⚠️ **Scout good session rate**: 29.2% (threshold: 65%)
- ⚠️ **Broad needs-improvement sessions**: 66.1% (threshold: 30%)

## Actions Needed
- First-turn provider errors are high — likely model/infra instability
- Scout quality metrics need attention — high friction, low good-session rate
- Many stale sessions (100+) lingering from 12-45h ago — cleanup needed
