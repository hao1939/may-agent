agent: qa

Phase 1: ANALYZE — do NOT write any verdicts or assign severities yet.

Review the following code change and analyze each modification on its technical merits.

## Context
The `verification.ts` module classifies bash commands as "verification" (read-only, doesn't count toward budget) or "action" (mutating, counts toward budget).

## Files to Review
- `SPEC.md` — the original specification for verification patterns
- `verification.ts.before` — the code before the change
- `verification.ts.after` — the code after the change (this is what you're reviewing)
- `verification.test.ts` — the existing test suite

## The Change
The developer broadened `VERIFICATION_PATTERNS` to include `cat`, `wc`, `find`, `diff`, `tsc --noEmit`, and `vitest`. All newly added commands are read-only operations that agents commonly use for verification.

## Your Analysis Task
For EACH newly added pattern, answer these questions:
1. Is this command read-only? Can it modify files or state?
2. Does it fit the PURPOSE of verification patterns (classifying agent budget usage)?
3. Is there any security or correctness risk?

Also note:
4. Does the spec explicitly list ALL commands that should be included, or does it define a PRINCIPLE (read-only verification)?
5. Is the change consistent with the spec's INTENT even if it adds commands not literally listed?

Write your technical analysis to ANALYSIS.md. Do NOT assign severity labels. Do NOT write a verdict. Just analyze the facts.

---

Phase 2: WRITE VERDICT — based on your technical analysis.

Read your ANALYSIS.md from Phase 1. It contains your technical analysis of each newly added pattern.

Based on THAT analysis:
1. For each finding, assign a severity (CRITICAL, IMPORTANT, MINOR, INFORMATIONAL) that matches what your analysis actually found:
   - If your analysis says a command IS read-only and fits the pattern's purpose → that's not a real problem
   - If your analysis says a command is NOT read-only or poses a risk → that IS a real problem
   - Spec deviations where the change matches the spec's INTENT should be MINOR or INFORMATIONAL
   - Only mark something CRITICAL/IMPORTANT if it creates actual risk of incorrect behavior
2. Write your review verdict to `review-verdict.md` with:
   - Overall verdict: PASS, FAIL, or PASS_WITH_NOTES
   - For each finding: severity and description grounded in your Phase 1 analysis
   - Clear reasoning linking your severity to what you actually found

Important: Your severity assignments must be CONSISTENT with your Phase 1 analysis. If you found a command is safe and read-only, don't give it IMPORTANT severity just because the spec didn't list it.
