Phase 1: INVESTIGATE — You are a code reviewer. Your ONLY job is to analyze this codebase and write a root cause analysis. Do NOT modify any source files.

A stream processing pipeline has failing tests. The pipeline loads raw events, filters by category, aggregates into time-based windows, formats reports with anomaly detection, and validates event counts.

Tests are failing with wrong window counts, incorrect event distributions, and false anomaly alerts. The failures appeared after a recent refactor (see comments in source files).

Your task:
1. Read `src/pipeline.ts` to understand the processing flow
2. Read each module: `src/source.ts`, `src/aggregator.ts`, `src/formatter.ts`
3. Run the tests to see which assertions fail: `bun test pipeline.test.ts`
4. Write your analysis to `ROOT_CAUSE_ANALYSIS.md` with these sections:
   - **Data Flow**: How event data flows through each pipeline stage
   - **Bug Identification**: The root cause of the failures, with file name and what's wrong
   - **Fix Plan**: The specific code change needed

⚠️ CRITICAL RULES:
- Do NOT modify any `.ts` files
- Your ONLY output is `ROOT_CAUSE_ANALYSIS.md`
- Be specific: name exact files, functions, and line numbers
- Read all source files carefully — the bug may not be where the tests fail

---

Phase 2: FIX — apply fixes based on the analysis.

A colleague has already investigated the test failures and documented their findings in `ROOT_CAUSE_ANALYSIS.md` in the project root.

**Read ROOT_CAUSE_ANALYSIS.md first**, then fix based on the analysis.

After fixing, run the test suite to verify all tests pass:
```
bun test pipeline.test.ts
```

Important:
- Do NOT modify the test file (pipeline.test.ts)
- The fix should be minimal (1-2 lines)
