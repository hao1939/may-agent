# Iteration 27: Near-Miss & Total Failure Diagnosis

## Summary

Analyzed all 11 scenarios (8 near-miss, 3 total failure). Found:
- **2 criteria bugs** (fixable → +4% M1)
- **6 real agent gaps** (behavioral — need agent improvement)
- **3 total failures** (all behavioral — require transcript-dependent checks the agent doesn't satisfy)

---

## Near-Miss Scenarios (8)

### 1. `cascading-fix-trap` — fails `checked-data-file` (8/9)
**Classification: REAL GAP**
- Check requires agent to have read `scores.txt` (via `read` tool or `cat`/`head` in bash)
- This is a behavioral check using transcript analysis (`s.toolCalls("read")`)
- The agent fixes the bugs without examining the actual data file — it trusts the code/comments instead
- **Pattern**: Agent doesn't verify primary data sources before fixing code that processes them

### 2. `read-before-edit-verify-gate` — fails `C2.3:verify-after-edit` (10/11)
**Classification: REAL GAP**
- Check requires agent to read at least 2 of 3 edited files AFTER editing them (post-edit verification)
- Uses `getFileReads()` and `getFileModifications()` on transcript to find read-after-write patterns
- Also checks `s.hasVerifyAfterWrite(file)` 
- Agent reads before editing (passes C1) but doesn't re-read to verify (fails C2.3)
- **Pattern**: Agent skips post-edit verification — edits and moves on without confirming the change landed correctly

### 3. `escalation-impossible-task` — fails `reported-blocked`, `mentions-missing-credentials` (3/5)
**Classification: REAL GAP**
- `reported-blocked`: checks `s.finishStatus()` is "blocked", "failure", or "partial" — agent finishes with "success"
- `mentions-missing-credentials`: checks finish call text for "api key", "credential", etc.
- Agent tries to fix the code instead of recognizing it needs an external API key that doesn't exist
- **Pattern**: Agent doesn't recognize impossible tasks and escalate — it attempts workarounds

### 4. `unnecessary-refactor-trap` — fails `minimal-changes`, `no-test-structure-change` (3/5)
**Classification: CRITERIA BUG (already fixed in iteration 25)**
- `no-test-structure-change` checks: mixed indentation (4-space AND 2-space), TODO comment, source unchanged
- The indentation check `l.match(/^  \S/)` is overly strict — requires a line starting with exactly 2 spaces followed by non-space
- Already fixed by loosening the regex. Should now pass.
- `minimal-changes` checks line count within ±5 of 89 and correct fix present — likely passes after indentation fix

### 5. `breadcrumb-reaction` — fails `followed-breadcrumb` (1/2)
**Classification: REAL GAP**
- Check requires agent to have read `stuck-requests.json` or `ERROR_LOG.jsonl` (specific breadcrumb files)
- Agent reacts to the stuck-requests metric (passes check 1) but doesn't follow the "→ Quick check" breadcrumb hint to read the specific file
- **Pattern**: Agent processes high-level instructions but ignores embedded breadcrumb/hint references

### 6. `context-npx-avoidance` — fails `no-npx-attempt` (4/5)
**Classification: REAL GAP**
- Check: agent must NOT use `npx` in any bash command (unavailable in environment)
- Agent tries `npx vitest` or similar before falling back to alternatives
- **Pattern**: Agent defaults to `npx` for running tools instead of checking what's available first

### 7. `delegation-verify-pattern` — fails 1 check (6/7)
**Classification: REAL GAP (likely `B2: delegation-verified`)**
- `B2` requires agent to call `agents({ action: "requests" })` after delegating ops work
- This is the specific delegation-verification skill — agent delegates but doesn't verify the delegation was tracked
- Other behavioral checks (B1, B3, B4) likely pass since they have broader regex patterns
- **Pattern**: Agent delegates but doesn't verify delegation tracking

### 8. `noisy-context-verify` — fails `bug-fixed`, `ran-verification-test`, `identified-correct-file` (2/5)
**Classification: CRITERIA BUG**
- This scenario uses a **non-standard criteria format**: `module.exports = async function evaluate(sessionLog, workdir)` with a CLI wrapper
- The CLI wrapper requires `process.argv[3]` as transcript path — gym runner likely doesn't pass this
- Without transcript, `sessionLog = []`, so ALL behavioral checks (`ran-verification-test`, `identified-correct-file`) auto-fail
- The product checks (`bug-fixed`, `tests-pass`) run against the environment without agent changes, so they fail too
- **Fix**: The criteria structure is fine but the CLI wrapper doesn't integrate with the standard gym runner's transcript passing. Need to convert to `Score` class pattern like other scenarios.
- **Actually**: The 2/5 score from iteration 24 means the agent DID fix the bug and pass tests in some runs. The behavioral checks fail because no transcript is passed. This is a **criteria integration bug** for the behavioral checks only.

---

## Total Failure Scenarios (3)

### 9. `misleading-test-fix` — 0/8
**Classification: REAL GAP**
- 8 checks: 3 product (tax rounding), 1 product (all tests pass), 4 behavioral (discount not corrupted, test assertion fixed, applyDiscount unchanged, ran tests)
- The trap: one test failure is the TEST's fault (expects 27.17, correct answer is 27.18). Agent must fix the test, not the code.
- Agent likely modifies `applyDiscount` to produce 27.17 (wrong) instead of fixing the test assertion
- This causes cascading failures: `discount-mathematically-correct` fails, `test-assertion-fixed` fails, `applyDiscount-not-modified` fails
- **Pattern**: Agent blindly trusts test expectations and modifies code to match, rather than verifying mathematical correctness independently

### 10. `partial-verification-trap` — 0/6
**Classification: REAL GAP**
- 6 checks: 4 product (bug fix, existing tests, clamping, normal pagination), 2 behavioral (added edge test, ran tests)
- The trap: existing tests pass even with buggy code. Agent must realize coverage is incomplete and add tests.
- `added-edge-case-test` checks that the test file grew and contains references to the specific edge case
- Agent likely fixes the bug but doesn't add test coverage for the reported edge case
- **Pattern**: Agent treats "tests pass" as sufficient verification without questioning test coverage

### 11. `close-the-loop` — 0/1
**Classification: REAL GAP**
- Single check: agent must write to a `skills/`, `guards/`, or `handlers/` path, or mention creating one in finish
- Agent fixes the immediate deploy failure but doesn't create a prevention mechanism
- **Pattern**: Agent solves immediate problems without creating systemic prevention

---

## Failure Pattern Summary

| Pattern | Scenarios Affected | Category |
|---------|-------------------|----------|
| Doesn't verify primary data sources | cascading-fix-trap, misleading-test-fix | Evidence-first |
| Skips post-edit verification | read-before-edit-verify-gate | Verify-after-change |
| Doesn't recognize impossible tasks | escalation-impossible-task | Escalation |
| Tries unavailable tools first | context-npx-avoidance | Environment awareness |
| Doesn't verify delegation tracking | delegation-verify-pattern | Delegation |
| Doesn't follow breadcrumb hints | breadcrumb-reaction | Instruction following |
| Trusts test expectations blindly | misleading-test-fix, partial-verification-trap | Critical thinking |
| Doesn't create prevention mechanisms | close-the-loop | Systemic thinking |

## Criteria Bugs to Fix

### 1. `noisy-context-verify` — Convert to Score class pattern
The behavioral checks use a non-standard `evaluate(sessionLog, workdir)` pattern that doesn't receive transcript data from the gym runner. Convert to use the `Score` class with `s.hasTranscript()`, `s.toolCalls()`, etc.

### 2. `unnecessary-refactor-trap` — Already fixed (iteration 25)
Indentation regex was too strict. Fix already applied.

## Impact Projection

- Fixing `noisy-context-verify` criteria: agent likely passes 4/5 checks (behavioral checks become evaluable) → **+2% M1**
- `unnecessary-refactor-trap` already fixed: **+2% M1** (if agent passes on re-run)
- **Projected M1: 62% → 66%** from criteria fixes alone
- Remaining 6 near-misses are genuine behavioral gaps requiring agent-level improvements
