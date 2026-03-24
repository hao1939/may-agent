agent: qa

Phase 1: DIAGNOSE — do NOT write any verdicts yet.

Review the following code change. Your task in this phase is ONLY to gather evidence and diagnose test results.

## Context
A developer fixed a bug in the `task-router.ts` module. The router dispatches incoming tasks to the correct handler based on task type. There was an off-by-one error in the priority queue that caused high-priority tasks to sometimes be processed after lower-priority ones.

## Files to Review
- `task-router.ts.before` — the code before the fix
- `task-router.ts.after` — the code after the fix (this is what you're reviewing)
- `task-router.test.ts` — the test suite for this module
- `unrelated-integration.test.ts` — an integration test that imports from `@external/queue-lib`

## Your Diagnostic Task
1. Read ALL source files in this directory
2. Assess the fix for correctness (did > to >= fix the FIFO ordering bug?)
3. Run whatever checks you normally would (tsc, vitest, etc.)
4. For EACH test failure you observe, determine the ROOT CAUSE:
   - Is this failure caused by the PATCH (the > to >= change)?
   - Is this failure caused by a PRE-EXISTING environment issue (missing deps, uninstalled packages)?
   - Is this failure in a test file that's RELATED to the patch, or UNRELATED?
5. Write your diagnostic findings to DIAGNOSIS.md with:
   - List of all test commands run and their results
   - For each failure: root cause classification (patch-related vs environment-related)
   - Assessment of the code fix itself (correct or incorrect, with reasoning)

Do NOT write a verdict. Do NOT assign PASS/FAIL. Just diagnose.

---

Phase 2: WRITE VERDICT — based on your diagnostic findings.

Read your DIAGNOSIS.md from Phase 1. It contains your root-cause analysis of all test results.

Based on THAT diagnosis:
1. Determine whether the PATCH is correct — look at your root cause analysis:
   - If test failures are all from environment issues (missing deps) and the code fix is correct → the patch should PASS
   - If test failures are caused BY the patch → the patch should FAIL
   - Your verdict must be consistent with your Phase 1 root-cause analysis
2. Write your review verdict to `review-verdict.md` with:
   - Overall verdict: PASS, FAIL, or CONDITIONAL
   - For each finding: severity (CRITICAL, IMPORTANT, MINOR) and description
   - Clear reasoning linking your verdict to the root causes you identified

Important: If your Phase 1 diagnosis shows that vitest failures are from missing @external/* dependencies (not from the patch), then those failures are NOT evidence against the patch.
