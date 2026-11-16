# Tool Script Modification

## Context
The `scripts/metric-collector.ts` script collects session metrics from the database. A new requirement has come in: add a `--csv` flag that outputs results in CSV format instead of the default table format.

## Current State
- `scripts/metric-collector.ts` exists and outputs a table of agent metrics
- It accepts `--agent` and `--since` flags already
- Tests exist in `scripts/metric-collector.test.ts`

## Task
1. Add a `--csv` flag to `metric-collector.ts` that outputs CSV format (header row + data rows)
2. Ensure existing table output still works when `--csv` is not passed
3. Update the test file to cover the new flag
4. Do NOT break existing functionality

## Success Criteria
- The `--csv` flag produces valid CSV output with headers
- Existing table output is unchanged
- Tests pass
