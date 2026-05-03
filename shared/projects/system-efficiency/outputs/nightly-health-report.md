# Nightly Health Report Script

## Status: COMPLETE

## What was built
Created `/app/agents/shared/scripts/nightly-health.sh` — a cron-compatible script that:
1. Runs `system-health.sh` and captures output
2. Writes a dated report to `outputs/health-reports/health-YYYY-MM-DD.md`
3. Maintains an index file at `outputs/health-reports/index.md`
4. Exits non-zero if tests are failing

## Usage
```bash
# Manual run
./scripts/nightly-health.sh

# Cron (daily at 2am)
0 2 * * * /app/agents/shared/scripts/nightly-health.sh
```

## Verification
Script executed successfully. See health-reports/ directory for generated output.
