# Nightly Health Report Script
## Status: COMPLETE

## Script Created
`scripts/nightly-health.sh` — cron-compatible health report generator.

## Features
- Runs `system-health.sh` and captures output
- Writes dated report to `outputs/health-reports/health-YYYY-MM-DD.md`
- Maintains an index file with date/status table
- Exits non-zero if tests are failing (cron alerting compatible)

## Usage
```bash
./scripts/nightly-health.sh
# Cron: 0 2 * * * /app/agents/shared/scripts/nightly-health.sh
```

## Test Run (2026-05-03)
- 101 test files passing, 1797 tests passed
- Duration: 3.08s
- Coverage gaps: None
- Status: ✅ HEALTHY
- Report generated at: `outputs/health-reports/health-2026-05-03.md`
