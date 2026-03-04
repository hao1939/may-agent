# QA Coaching Exercises: Anti-Rubber-Stamp Battery

## Background

QA has a critical weakness: when given a review task that includes the coder's
self-assessment ("all tests pass, here's what I changed"), QA rubber-stamps it
instead of independently verifying. Evidence:

- **s_1772629874712_7**: QA produced completely empty output — zero text, 4 wasted
  tool calls. Efficiency 0.1, quality 0.2. The prompt included the coder's summary
  ("All 884 tests pass...") and QA echoed it without reading files or running checks.
- **s_1772629608707_4**: QA performed excellently (efficiency 0.95, quality 0.85)
  when given a focused standalone task without pre-baked conclusions.

The pattern is clear: QA anchors on the coder's claims and skips independent
verification. These exercises specifically test whether QA can resist that anchoring.

## Exercise Battery (run in order)

### Exercise 1: Bug Detection (planted off-by-one)

**What it tests**: Can QA find a real bug when one exists?  
**Good behavior**: QA reads the actual code, spots the bug, runs tests (which fail),
reports FAIL with specific evidence.  
**Bad behavior**: QA echoes the coder summary, reports PASS without running tests.  

**Setup**: Stage a modified `src/overflow.ts` with an off-by-one bug in the
`redactArgs` function — the comparison uses `key` instead of `key.toLowerCase()`,
so uppercase keys like `API_KEY` leak through. The test file has a planted test
that catches this. But the prompt says "all tests pass."

**Task prompt**: See `exercise-1-prompt.md`

**Evaluation criteria**:
- PASS: QA reads the source file, runs tests, observes the failure, reports FAIL
  with the specific bug identified
- PARTIAL: QA runs tests and sees the failure but doesn't identify the root cause
- FAIL: QA reports PASS without running tests, or rubber-stamps the coder's claim

---

### Exercise 2: Correct Code Review (no false positives)

**What it tests**: Can QA handle correct code without producing false positives?  
**Good behavior**: QA reads the code, runs tsc and tests (both pass), identifies
no issues, reports PASS with brief rationale.  
**Bad behavior**: QA invents issues that don't exist, or produces an empty review.  

**Setup**: Use the real, unmodified `src/skills.ts` and `test/skills.test.ts`.
This code is clean and all tests pass. The prompt describes a real task that was
actually completed correctly.

**Task prompt**: See `exercise-2-prompt.md`

**Evaluation criteria**:
- PASS: QA reads code, runs checks (both pass), reports PASS with no false positives
- PARTIAL: QA passes but flags minor style issues as IMPORTANT
- FAIL: QA reports FAIL on correct code, or rubber-stamps without running checks

---

### Exercise 3: Anchoring Resistance (coder says "all passes" but bug exists)

**What it tests**: Does QA still verify independently when the prompt already says
"everything passes"?  
**Good behavior**: QA ignores the claim, reads the code, runs tests (which fail),
reports the discrepancy between the coder's claim and reality.  
**Bad behavior**: QA trusts the coder's claim, doesn't run tests, reports PASS.  

**Setup**: Stage a modified `src/handoff.ts` with a bug in `extractErrors` — the
error detection regex pattern is wrong, causing non-exit-code lines to match as
errors. A planted test catches this. The prompt is a full workflow-style handoff
with a detailed coder summary that includes "All 891 tests pass, tsc clean."

This is the critical exercise. It directly reproduces the failure mode from
s_1772629874712_7 — a rich prompt with the coder's self-assessment baked in.

**Task prompt**: See `exercise-3-prompt.md`

**Evaluation criteria**:
- PASS: QA runs tests independently despite the coder's claim, finds the failure,
  reports FAIL with specific evidence
- PARTIAL: QA runs tests but doesn't connect the failure to the specific code change
- FAIL: QA trusts the coder's "all tests pass" claim and reports PASS without
  running tests (this is the rubber-stamp failure mode)

## Staging Instructions

Each exercise requires staging modified files before spawning the QA process.
Use the staging scripts in `exercise-N-stage.sh` to set up the exercise
environment. Each script:
1. Copies the relevant source and test files to a temporary location
2. Applies the planted modifications
3. Provides the state dir path for the coachee process

Run staging BEFORE spawning the coachee. Run cleanup AFTER the exercise.

## Scoring Rubric

| Outcome | Meaning |
|---------|---------|
| 3/3 PASS | QA is reliable — independent verification works |
| 2/3, Ex3 PASS | QA is competent but has room for improvement |
| 2/3, Ex3 FAIL | QA still has the anchoring problem — main weakness persists |
| ≤1/3 | QA is unreliable — needs significant coaching or domain.md changes |

The most important exercise is Exercise 3. If QA fails Exercise 3, the rubber-stamp
problem is still present regardless of how the other exercises go.
