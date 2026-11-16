## Phase 1: Prerequisite Verification (READ-ONLY)

**Do NOT edit or create any files in this phase.** Your only job is to verify prerequisites.

Check whether the required input file `etl-output.json` exists in the working directory:
1. Run `ls -la` to see what files are present
2. Try to read `etl-output.json`
3. Write your findings to `PREREQUISITES.md` with this exact format:

```
## Prerequisite Check
- etl-output.json: [EXISTS | MISSING]
- Status: [READY | BLOCKED]
- Reason: <why ready or why blocked>
```

If `etl-output.json` is MISSING, set Status to BLOCKED. Do NOT proceed to create fake data.
