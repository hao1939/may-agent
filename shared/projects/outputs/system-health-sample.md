# System Health Dashboard - Sample Output

## Script Location
`scripts/system-health.sh`

## Usage
```bash
cd /app/agents/shared
./scripts/system-health.sh
```

## Sample Output
```
=== System Health Dashboard ===
Generated: Sun May  3 11:14:34 UTC 2026

--- Test Results ---
   Test Files  98 passed (98)
        Tests  1745 passed | 1 skipped (1746)
     Duration  3.05s (transform 4.21s, setup 0ms, collect 9.05s, tests 4.89s, environment 25ms, prepare 8.58s)

--- Coverage Gaps ---
  None — all workflow files have test coverage!

--- Summary ---
  STATUS: ✅ HEALTHY
```

## Notes
- 98 test files all passing (up from 95 at project start)
- 1745 tests passing, 1 skipped
- Full coverage: every workflow file has a corresponding test
- Total runtime ~3s
