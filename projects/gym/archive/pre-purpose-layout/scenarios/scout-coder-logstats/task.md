Fix the failing tests in this HTTP log analytics pipeline.

The pipeline parses web server access logs, groups requests into user sessions, and computes aggregate statistics (average response time, error rates, bandwidth, path frequency, etc.).

Run the tests:
  node test/test.js

Several tests are failing. Your job is to:
1. Read the source files to understand the pipeline
2. Run the tests to see which fail
3. Trace the data flow to find the root causes
4. Fix the bugs in the source files only

Rules:
- The data file (data/access.log) is correct — do NOT modify it
- The test file (test/test.js) has correct expected values — do NOT modify it
- The bugs are in the source files (src/*.js)
- Check CHANGELOG.md for context on recent changes
