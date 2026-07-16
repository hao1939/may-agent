## Root Cause Isolation Process (SKILL — follow this for Phase 1)

When investigating a bug, do NOT just describe what's failing. Follow this loop:

1. HYPOTHESIZE: State a specific causal mechanism ("X causes Y because Z")
2. TEST: Run a command that would produce different output depending on whether your hypothesis is true
   - Add logging, check execution order, inspect intermediate values
3. CONFIRM or REJECT: Based on the test output, confirm or reject the hypothesis
4. REPEAT until you have a confirmed root cause with evidence

Your analysis MUST include:
- The confirmed root cause mechanism (not symptoms)
- The evidence that confirmed it (specific tool output)
- The exact fix needed (not "investigate further")

A good root cause: "normalize() runs after penalties() in pipeline.js line 47, so penalty calculations use raw scores instead of normalized ones"
A bad root cause: "the grades are calculated incorrectly"

---

Phase 1: INVESTIGATE — You are a code reviewer. Your ONLY job is to analyze this codebase and write a root cause analysis. Do NOT modify any source files.

A student grade processing pipeline has failing tests. The pipeline reads student grade data from CSV, applies late submission penalties, computes homework averages (dropping the lowest score), calculates weighted final grades, and generates a class report.

Your task:
1. Read `src/pipeline.js` and trace the data flow through ALL stages
2. Read each module that pipeline.js calls, in the order they're called
3. Read the CHANGELOG.md and compare the documented execution order against the actual code
4. Run the tests (`node test/test.js`) to see which assertions fail and by how much
5. Write your analysis to `ROOT_CAUSE_ANALYSIS.md` with these sections:
   - **Data Flow**: Map how data flows through each pipeline stage
   - **Bug Identification**: List each bug, distinguishing ROOT CAUSES from SYMPTOMS
   - **Cascading Effects**: Explain how one bug masks or interacts with another
   - **Fix Plan**: For each bug, describe the exact ROOT CAUSE fix (not a workaround)

⚠️ CRITICAL RULES:
- Do NOT modify any files in `src/`, `test/`, or `data/`
- Do NOT modify `package.json`
- Your ONLY output is `ROOT_CAUSE_ANALYSIS.md`
- Be specific: name exact files, line numbers, and what to change
- Distinguish root causes from symptoms — workarounds (like adding fields to penalties.js) are NOT root cause fixes

---

Phase 2: FIX — apply fixes based on the analysis.

A colleague has already investigated the test failures and documented their findings in `ROOT_CAUSE_ANALYSIS.md` in the project root.

**Read ROOT_CAUSE_ANALYSIS.md first**, then fix based on the analysis. For each bug:
- If the analysis identifies a ROOT CAUSE: fix the root cause as described
- Do NOT apply workarounds — fix the underlying issues

After fixing, run the test suite to verify all tests pass:
```
node test/test.js
```

Important:
- Do NOT modify the test file (test/test.js)
- Do NOT modify the data file (data/grades.csv)
- Do NOT modify the policy configuration (src/policy.js)
- The policy defines: homework 40%, midterm 25%, final 35%
- Fix root causes, not symptoms — don't add fields or workarounds to make numbers match
