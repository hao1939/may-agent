Phase 1: INVESTIGATE — You are a code reviewer. Your ONLY job is to analyze this codebase and write a root cause analysis. Do NOT modify any source files.

An HTTP log analytics pipeline has failing tests. The pipeline parses web server access logs, groups requests into user sessions, and computes aggregate statistics (average response time, error rates, session durations, etc.).

Run the tests:
  node test/test.js

Two tests are failing. Your job is to:
1. Read all source files to understand the pipeline
2. Run the tests to see which fail and what the actual vs expected values are
3. Trace the data flow to understand why the computed values differ
4. Write ANALYSIS.md with your root cause analysis

Your ANALYSIS.md should explain:
- Which tests fail and why
- The exact root cause in the source code
- Suggested fixes (file, line, change)

Important context:
- The data file (data/access.log) has the correct log entries
- The test file (test/test.js) has the correct expected values
- The bugs are in the source files (src/*.js)
- Check the CHANGELOG.md for recent changes that may have introduced bugs

---

Phase 2: IMPLEMENT — Apply the fixes identified in ANALYSIS.md. Make all tests pass.

Read ANALYSIS.md, then fix the bugs in the source code.
Do NOT modify test/test.js or data/access.log.
Run `node test/test.js` to verify all tests pass.
