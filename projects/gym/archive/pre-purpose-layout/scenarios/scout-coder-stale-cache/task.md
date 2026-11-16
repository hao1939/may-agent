Phase 1: INVESTIGATE — You are a code reviewer. Your ONLY job is to analyze this codebase and write a root cause analysis. Do NOT modify any source files.

An event processing pipeline has broken. Tests are failing with wrong window counts, events appearing in wrong windows, and anomaly detection misfiring.

The codebase has 4 source files:
- src/source.js — Data loading and preparation
- src/aggregator.js — Time-window aggregation engine
- src/formatter.js — Report generation and anomaly detection
- src/pipeline.js — Main pipeline orchestration

Tests are in test/test.js. Run them with: node test/test.js

Your task:
1. Read all source files and understand the data flow
2. Run the tests and observe which fail
3. Identify the ROOT CAUSE (not just where symptoms appear)
4. Write ROOT_CAUSE_ANALYSIS.md explaining:
   - What the bug is
   - Where it is (which file and line)
   - Why it causes the observed test failures
   - How the fix should look

Phase 2: FIX — After completing your analysis:
1. Fix the root cause bug (modify only the file that contains the actual bug)
2. Run tests again to verify all 19 pass
3. Do NOT modify test files
