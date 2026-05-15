# Flakiness Detector Report

## Script Created
`scripts/flakiness-detector.sh` — runs the test suite 3 times and compares results to detect flaky tests.

## How It Works
1. Runs `npx vitest run` 3 times, capturing full output
2. Extracts failing test file names from each run
3. Compares fail lists across all 3 runs
4. If any file fails in some runs but not others → FLAKY
5. Exit 0 = consistent, Exit 1 = flaky tests found

## Usage
```bash
./scripts/flakiness-detector.sh
```

## Sample Output
```
=== Flakiness Detector ===
Running test suite 3 times to detect flaky tests...
Run 1/3...
Run 2/3...
Run 3/3...

=== Results ===
NO FLAKY TESTS DETECTED (3 runs consistent)
Exit codes: 000
```

## Result
No flaky tests detected. All test files produce consistent results across multiple runs.
