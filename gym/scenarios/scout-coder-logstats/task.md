Phase 1: INVESTIGATE — You are a code reviewer. Your ONLY job is to analyze this codebase and write a root cause analysis. Do NOT modify any source files.

A log analytics pipeline has failing tests. The pipeline parses web server access logs, groups requests into user sessions (using a 30-minute inactivity gap), and computes various statistics including session counts, averages, conversion rates, and bandwidth.

Your task:
1. Read `src/pipeline.js` to understand the processing flow
2. Read each module it calls: `parser.js`, `sessions.js`, `stats.js`
3. Read the `CHANGELOG.md` for version history
4. Run the tests (`node test/test.js`) to see which assertions fail and by how much
5. Write your analysis to `ROOT_CAUSE_ANALYSIS.md` with these sections:
   - **Data Flow**: How log data flows through each pipeline stage
   - **Bug Identification**: List each bug found, with file name and what's wrong
   - **Fix Plan**: For each bug, describe what code change is needed

⚠️ CRITICAL RULES:
- Do NOT modify any files in `src/`, `test/`, or `data/`
- Your ONLY output is `ROOT_CAUSE_ANALYSIS.md`
- Be specific: name exact files, functions, and what to change
- Don't trust comments or changelogs blindly — verify against test expectations

---

Phase 2: FIX — apply fixes based on the analysis.

A colleague has already investigated the test failures and documented their findings in `ROOT_CAUSE_ANALYSIS.md` in the project root.

**Read ROOT_CAUSE_ANALYSIS.md first**, then fix based on the analysis.

After fixing, run the test suite to verify all tests pass:
```
node test/test.js
```

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/access.log)
