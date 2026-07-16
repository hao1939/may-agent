---
name: evidence-over-narrative
version: 1.0.0
description: >
  When narrative cues (code comments, task descriptions, prior beliefs) conflict
  with runtime evidence (test results, file contents, system state), trust the
  evidence. This skill enforces an explicit evidence-gathering-then-reconciliation
  protocol that prevents phantom fixes, stale-state busywork, and comment-driven
  development.
owner: optimizer
evidence: >
  Observed across 4 agents in 20+ sessions. Primary: phantom-fix-config scenario
  where coder breaks working code (2/5 baseline, exp-145/174) by trusting
  misleading comments over passing tests. Secondary: QA re-scans unchanged repos
  (3/4 sessions, ~39 wasted ops), Bob reads 77KB of unchanged files per session
  (5/5 sessions). Confirmed in finding-cost-scan-0323-0009, finding-llm-to-js-
  scan-0322-2115, and coach method-catalog (0/13 text methods improved behavior).
---

# Evidence Over Narrative

## When to Apply

Apply this skill when:

1. **A task or comment says something is broken**, but you haven't yet verified
   the claim with your own tool calls (tests, reads, system checks).
2. **You're about to change code that currently passes its tests**, based on a
   comment, task description, or assumption rather than a failing test.
3. **You're about to re-read a large file or re-scan a system** without evidence
   that anything has changed since your last check.
4. **A checklist or procedure tells you to do something**, but runtime evidence
   suggests the step is unnecessary (e.g., "scan for new commits" when there are
   zero new commits).

Do NOT apply this skill when:
- Evidence and narrative agree (both say it's broken, or both say it's fine) —
  just proceed normally.
- You have no narrative to compare against (pure exploratory work).
- The task explicitly asks you to make a change regardless of test state (e.g.,
  "refactor this function" — the goal isn't to fix a bug).

## Why This Matters

Agents instinctively trust narrative cues — code comments, task descriptions,
prior session logs — because they look authoritative. But narrative is often
stale, misleading, or wrong. Runtime evidence is always current.

**The cost of getting this wrong**:

| Scenario | What happens | Waste |
|----------|-------------|-------|
| Coder trusts misleading comment | "Fixes" working code, breaks 8/16 tests | Entire session |
| QA follows scan checklist on unchanged repo | 13 tool calls, finds nothing | ~39 ops/day |
| Bob reads unchanged 19KB file every session | Processes identical content repeatedly | ~77KB context/session |

**Key evidence**: In the phantom-fix-config gym scenario, the coder runs tests,
sees all 16 pass, reads a misleading comment ("Bug: port range allows 0 and
65536"), then *changes the correct code* to match the comment — breaking 8 tests.
The coder had the evidence ("tests pass") but followed the narrative ("comment
says it's broken"). Baseline: 2/5 across 3 runs (exp-145, exp-174).

## Steps

### Step 1: Gather Runtime Evidence First

Before reading comments or task descriptions in detail, verify the system's
actual state:

```bash
# Run tests to see what actually passes/fails
npx vitest --run 2>&1 | tail -20

# Or check system state
git log --oneline -5
cat last-reviewed-commit.txt
```

Write down what you observe: *"Tests: 16/16 pass"* or *"Git log: 0 new commits
since de62c5a"*.

**Why first**: If you read comments before gathering evidence, the comments
anchor your thinking. You'll interpret ambiguous test output through the lens
of what the comment told you to expect. Gather evidence with fresh eyes.

### Step 2: Catalog Narrative Claims

Now read the task description, code comments, and any prior session notes.
Write down their claims:

- *"Task says: fix the port validation bug"*
- *"Comment says: allows 0 and 65536"*
- *"Prior session says: test failures in validation module"*

### Step 3: Reconcile — Write It Down

Compare evidence against narrative. You must write this comparison explicitly
(not just think it):

```
RECONCILIATION:
- Narrative claims: "Port validation is broken, allows invalid values"
- Evidence shows: "All 16 tests pass, including port validation tests"
- Conflict? YES
- Decision: Trust evidence. Tests pass → code is correct. Comment is stale.
```

**This is the critical step.** Without explicit reconciliation, the narrative
wins by default because it feels more specific and actionable than "everything
is fine."

### Step 4: Act Only on Evidence

| Evidence | Narrative | Correct Action |
|----------|-----------|----------------|
| Tests fail | "Fix the bug" | Fix the bug ✅ |
| Tests pass | "Fix the bug" | **STOP. Report tests pass. Do not change working code.** |
| Tests fail | "Code is fine" | Fix the code (evidence wins) ✅ |
| Tests pass | "Code is fine" | Nothing to do ✅ |
| No changes since last check | "Check for changes" | **Early-exit. Report no changes.** |
| File unchanged since last read | "Read and process file" | **Skip or skim. Don't reprocess.** |

If evidence and narrative conflict and you're unsure, gather MORE evidence
(run more tests, check more files, reproduce the issue). Do not default to
the narrative.

## Assertions

1. **Evidence gathered before changes**: The agent runs tests, checks system
   state, or reads the relevant file BEFORE making any edits. The transcript
   shows at least one evidence-gathering tool call before the first `edit()`.

2. **Explicit reconciliation when conflict exists**: When narrative claims X
   but evidence shows Y, the agent writes an explicit comparison (e.g.,
   "Narrative says X, evidence shows Y, I trust evidence") before deciding
   what to do. The reconciliation is visible in the transcript.

3. **No changes to passing code based on comments alone**: If tests pass and
   the only reason to change code is a comment or task description claiming
   it's broken, the agent does NOT edit the code. The agent reports that tests
   pass instead.

4. **Early exit when evidence shows nothing to do**: If runtime evidence shows
   no new commits, no file changes, or no failing tests — and the task is to
   "check" or "scan" — the agent exits early rather than performing redundant
   work.

5. **Evidence-first ordering**: The agent's first substantive tool calls in
   the session gather runtime evidence (run tests, check git state, verify
   system health) rather than reading comments or task descriptions in detail.

## Worked Example: Wrong Test Assertion

**Task**: "Fix all failing tests in the invoice calculator module."

### The Situation
Three tests fail. Two failures are caused by code bugs in `calculateTax` (missing rounding). The third failure claims `applyDiscount(33.97, 20)` should return `27.17`, but the function returns `27.18`.

### ❌ What Usually Goes Wrong
The agent fixes the two real code bugs, then sees the third failure. The test says `expected 27.17`, the code returns `27.18`. The agent modifies `applyDiscount` to force it to return `27.17` — corrupting mathematically correct code to match a wrong test expectation.

### ✅ What Should Happen Instead
1. Run tests: see 3 failures
2. Fix `calculateTax`: add `Math.round(amount * rate * 100) / 100` for proper rounding → 2 tests now pass
3. For the discount failure, **do the math**: `33.97 × (1 - 0.20) = 33.97 × 0.80 = 27.176 → rounds to 27.18`
4. **Key realization**: The code returns `27.18` which is mathematically correct. The test expects `27.17` which is wrong.
5. Fix the TEST assertion: change `=== 27.17` to `=== 27.18`
6. Run tests: all pass ✓

### Why This Matters
The task says "fix all failures so the test suite passes." The temptation is to make every test pass by changing code. But when the code is correct and the test expectation is wrong, the right fix is to fix the test. Runtime evidence (doing the math) beats narrative (the test's expected value).

## Anti-Patterns

### AP-1: Phantom Fix
**What happens**: Tests pass. A comment says "Bug: allows invalid values." The
agent "fixes" the code based on the comment, breaking the tests.

**Why it's tempting**: The comment is specific and actionable. "All tests pass"
feels vague and less trustworthy. The agent wants to be productive.

**Prevention**: Run tests first. If they pass, the comment is stale or wrong.
Report that tests pass. Do not edit code that passes its tests based solely
on a narrative claim.

### AP-2: Procedural Inertia
**What happens**: A checklist says "scan for new commits." There are zero new
commits. The agent scans old files anyway because the procedure says to.

**Why it's tempting**: Following procedures feels safe and thorough. Skipping
a step feels risky. But evidence ("0 new commits") makes the step a no-op.

**Prevention**: Check preconditions before executing checklist steps. If the
precondition isn't met (nothing to scan), skip the step and document why.

### AP-3: Comment-Anchored Interpretation
**What happens**: The agent reads a misleading comment, then runs tests. Tests
pass, but the agent interprets a passing test as "not covering the bug" rather
than "confirming the code works." The comment has anchored their interpretation.

**Why it's tempting**: Comments provide a mental model. When evidence doesn't
fit the model, it's easier to explain away the evidence than update the model.

**Prevention**: Gather evidence BEFORE reading comments (Step 1). This prevents
anchoring. When evidence contradicts comments, trust the evidence — don't
rationalize it away.
