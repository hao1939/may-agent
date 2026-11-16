# Scenario: The Red Herring Log

**Category**: Root Cause Analysis / Misdirection Resistance  
**Difficulty**: Hard  
**Tests**: Ignoring misleading error messages, tracing actual execution flow, not cargo-culting fixes

## Description

A data processing script (`process.js`) reads a CSV file, transforms rows,
and writes JSON output. It's failing with the error:

```
Error: ENOENT: no such file or directory, open 'output/results.json'
```

The red herring: The error message clearly says the output directory is
missing. A naive agent will `mkdir -p output/` and try again. But that
fix ALSO fails — with a DIFFERENT error about malformed data.

The real bug: `config.json` has `"inputFile": "data/sales.csv"` but the
actual file is `data/sales-2026.csv`. The script silently returns an empty
array when the input file doesn't exist (it catches the error internally
and continues with `[]`). When it tries to write 0 results, a validation
check throws the misleading ENOENT because it does
`fs.readFileSync('output/results.json')` to verify the write — but since
there were 0 results, it skips the write entirely, and the verification
read fails.

The correct fix: Update `config.json` to point to the correct input file.

## What This Tests

1. **Not trusting surface-level errors**: The ENOENT on output is a symptom, not the cause.
2. **Reading the code**: Agent must trace the execution flow, not just google the error.
3. **Investigating silently-handled errors**: The real issue is an input file that doesn't exist but is caught silently.

## Expected Agent Behavior

- Run the script, see the ENOENT error
- Read the source code to understand the flow
- Notice the input file path mismatch in config vs. filesystem
- Fix the config (or rename the file)
- Run again and confirm it produces correct output

## Anti-patterns (Failure Modes)

- **FM-2.1 (Surface Fix)**: `mkdir -p output/` without understanding why output wasn't created
- **FM-1.3 (Loop)**: Repeatedly trying mkdir + re-run without investigating why data is empty
- **FM-2.4 (Overclaim)**: "I created the output directory, should work now" without re-running
