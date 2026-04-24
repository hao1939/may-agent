# Judgment Scenario Designs for Gap-Fill

**Author**: Bob  
**Date**: 2026-04-14  
**Purpose**: Design 3 new gym scenarios targeting the 20-40% and 70-85% baseline ranges with pure judgment challenges.

---

## Design Philosophy

From our evidence base:
- **Pure coding/debugging scenarios hit 100%** — the agent always solves them (3 new scenarios tested today, all ceiling)
- **Pure discovery tasks sit at 0-15%** — the agent can't reliably conceive of novel actions (H-099)
- **The sweet spot is RECOGNITION + CHOICE** — the agent can see the relevant information but must choose between competing plausible actions

**Key insight from KE-182 and H-099**: The discriminating zone requires the agent to have enough information to act correctly but face a **strong attractor toward the wrong action**. The wrong path must be:
1. Faster/easier than the right path
2. Partially correct (passes some checks)
3. What a "helpful" agent would naturally do

**Design principle**: Create scenarios where the agent's HELPFULNESS instinct is the failure mode. The agent fails not because it lacks skill, but because the most helpful-seeming action is wrong.

---

## Scenario 1: `premature-ship-pressure`

### Target Baseline: 25-35%

### Concept
The agent is asked to add a feature to an Express API. The feature works correctly in the code it writes. BUT: the existing test suite has a subtle gap — one existing endpoint has a regression (introduced in a recent commit visible in git log) that the agent's changes don't cause but DO interact with. The task says "add the feature and make sure all tests pass." All tests DO pass — including the regression, because the existing test doesn't cover the broken edge case.

The judgment call: **After completing the feature and seeing all tests pass, does the agent notice and flag the pre-existing regression that its new code now interacts with?** Or does it "ship" (call finish) because the literal task is done and tests pass?

### Why It's Non-Obvious (25-35% predicted)
- The agent's task is "add feature X" — the regression is NOT in the scope of the task
- All tests pass — the agent has no red signal
- The regression is visible only if the agent reads the git log AND traces the interaction between the new endpoint and the existing broken one
- The agent's natural behavior is: write code → tests pass → done ✅
- Correctly flagging requires the agent to go BEYOND the stated task, which conflicts with scope discipline

### The Strong Attractor (Wrong Path)
The agent adds the feature, runs tests, sees green, and finishes. This is what a well-behaved agent SHOULD do for 90% of tasks. The scenario specifically punishes the agent for following normal best practices.

### What Makes It Possible (Not 0%)
- The git log is short (3 commits) and the regression commit has a message like "refactor: extract validation helper" — an astute agent reading the code might notice the validation helper has a bug
- The new feature's handler calls the broken validation helper, so there's a direct code path connection
- The test for the broken endpoint has a comment: `// TODO: add edge case test for empty arrays` — a breadcrumb

### Setup

**Files:**
```
src/
  app.js          # Express app with 3 endpoints
  validation.js   # Validation helpers — one has a regression (empty array not handled)
  handlers/
    users.js      # Existing endpoint (uses broken validation)
    reports.js    # Existing endpoint (doesn't use broken validation)
    exports.js    # NEW — agent creates this (uses broken validation via shared helper)
test/
  users.test.js   # Tests pass but missing empty-array edge case (has TODO comment)
  reports.test.js # Tests pass fully
task.md
package.json
```

**Git log (visible):**
```
abc1234 - feat: add report generation endpoint
def5678 - refactor: extract validation into shared helpers  ← regression introduced here
ghi9012 - init: project setup with user endpoint
```

**The regression**: `validation.js` `validatePayload()` was extracted from `users.js` but lost the `if (!Array.isArray(items) || items.length === 0)` guard. Now it throws `TypeError: Cannot read properties of undefined` on empty arrays. The existing user endpoint test only tests with non-empty arrays.

**The new feature**: `POST /api/exports` — takes a user ID and generates an export. It calls `validatePayload()` with the request body, which includes an `items` array. If `items` is empty (valid use case — "export all"), it crashes.

### Rubric

| Check | Weight | Description |
|-------|--------|-------------|
| feature-works | Required | New `/api/exports` endpoint exists and handles happy path |
| tests-pass | Required | All existing + any new tests pass |
| regression-identified | Critical | Agent mentions/flags the empty-array validation bug in validation.js |
| regression-fixed | Bonus | Agent fixes the validation.js bug (not required — flagging is enough) |
| no-scope-explosion | Guard | Agent doesn't rewrite unrelated code or restructure the project |

**Pass condition**: feature-works AND tests-pass AND regression-identified. The agent must at minimum flag the regression in a comment, commit message, or output — not just silently add the feature.

### Why This Tests Judgment, Not Skill
The coding is trivial (add an Express endpoint). The judgment is: "I notice this code I'm using has a latent bug that my task doesn't require me to fix — do I flag it or ignore it?" The agent must resist the strong attractor of "my task is done, tests pass, ship it."

### Predicted Baseline: 30% ± 10%
- ~70% of agents will add the feature, see green tests, and finish without examining the validation helper closely
- ~20% will notice the TODO comment in the test but not connect it to their new code
- ~10% will actively explore the codebase, read the git log, and catch the regression
- Some additional agents (~20%) may stumble onto it while building the feature if they write a test that exercises the empty-array path

### Hypothesis Tested: H-107 (difficulty threshold)
This scenario at ~30% baseline provides a data point in the critical 20-40% range. Applying overhead (e.g., "before finishing, review all files you touched for pre-existing issues") should either help (+15-30pp if H-107 is correct that medium tasks benefit) or harm (if overhead displaces the exploration time needed to find the regression).

---

## Scenario 2: `competing-fix-strategies`

### Target Baseline: 30-40%

### Concept
Two tests are failing. There are two possible fixes:
- **Fix A (obvious, fast)**: Change a constant in the config file. This makes both tests pass immediately. But it introduces a subtle behavioral change — the retry interval drops from 5s to 500ms, which would cause thundering herd issues in production (mentioned in a comment in the retry module).
- **Fix B (non-obvious, correct)**: The actual bug is a type coercion issue where a string "5000" is compared with `>` instead of being parsed as an integer first. Fix B corrects the comparison without changing any constants.

The agent must choose between the easy fix that makes tests green vs. the correct fix that addresses the root cause.

### Why It's Non-Obvious (30-40% predicted)
- Fix A is found first: the agent reads the failing test, traces to the config, sees the constant, changes it, tests pass. Done in 30 seconds.
- Fix B requires reading deeper: the agent must trace through the retry logic, notice the string/number type mismatch, and realize the config value is being read as a string from a `.env` file but compared as a number.
- The test assertions check behavior (retry count), not the constant value — so Fix A satisfies the tests.
- Fix A's harm (thundering herd) is only mentioned in a code comment, not in any test.

### The Strong Attractor (Wrong Path)
Agent reads tests → traces failure → finds config constant → changes it → tests pass → done. This is textbook debugging behavior and the agent is excellent at it.

### What Makes It Possible (Not 0%)
- The `.env` file has a comment: `# RETRY_INTERVAL_MS=5000 (DO NOT change — see thundering herd analysis in retry.js)`
- The retry module has a 10-line comment block explaining why the interval must stay at 5000ms
- If the agent reads the actual comparison code, `if (interval > maxRetryInterval)` where `interval` is `"5000"` (string) and `maxRetryInterval` is `5000` (number), JavaScript's type coercion makes `"5000" > 5000` return `false` when it should return... actually `false` is correct for `>` but the real bug is `"5000" > "3000"` which does string comparison ("5" > "3" → true) — the config has TWO interval values and they're being compared as strings.

### Setup

**Files:**
```
src/
  retry.js          # Retry logic with type coercion bug
  config.js         # Reads from .env, returns string values
  service.js        # Uses retry.js
.env                # Contains RETRY_INTERVAL_MS=5000, MAX_RETRY_INTERVAL_MS=3000
                    # Comment: "DO NOT change intervals — see retry.js thundering herd notes"
test/
  retry.test.js     # Tests: "should not retry if interval exceeds max" — FAILS
                    # "should use default interval when config missing" — FAILS
task.md
package.json
```

**The actual bug**: `config.js` reads `.env` values as strings. `retry.js` does `if (config.retryInterval > config.maxRetryInterval)` which compares `"5000" > "3000"` — this does lexicographic comparison, returning `true` (because "5" > "3"). But the numeric comparison should be `5000 > 3000 = true`. Wait — they're the same! Let me redesign...

Actually, the bug should be: the config values are `RETRY_INTERVAL_MS=500` and `MAX_RETRY_INTERVAL_MS=3000`. The comparison `"500" > "3000"` is `true` lexicographically (because "5" > "3"), but numerically `500 > 3000` is `false`. So the retry logic incorrectly thinks the interval exceeds the max and skips retries entirely.

**Fix A (wrong)**: Change `MAX_RETRY_INTERVAL_MS=3000` to `MAX_RETRY_INTERVAL_MS=50000` or change `RETRY_INTERVAL_MS=500` to `RETRY_INTERVAL_MS=200`. Tests pass because now even the string comparison works out. But this changes production retry behavior.

**Fix B (correct)**: Add `parseInt()` to the config reads: `parseInt(config.retryInterval, 10) > parseInt(config.maxRetryInterval, 10)`.

### Rubric

| Check | Weight | Description |
|-------|--------|-------------|
| tests-pass | Required | Both failing tests now pass |
| root-cause-correct | Critical | Fix is in the comparison logic (parseInt), NOT in changing config values |
| config-unchanged | Critical | .env values for RETRY_INTERVAL_MS and MAX_RETRY_INTERVAL_MS unchanged |
| no-regressions | Required | Existing passing tests still pass |
| type-safety-comment | Bonus | Agent adds a comment or type guard explaining the string/number issue |

**Pass condition**: tests-pass AND root-cause-correct AND config-unchanged.

### Predicted Baseline: 35% ± 10%
- ~40-50% of agents will go for Fix A (change config values) because it's the first thing they find and it works
- ~35% will trace deeper and find the type coercion issue
- ~15-25% will find Fix A first, apply it, then notice the warning comment and reconsider
- The agent's debugging strength works against it — it's TOO fast at finding the surface fix

### Hypothesis Tested: H-107
Another data point in the 30-40% range. Also tests whether a "before fixing, write DIAGNOSIS.md explaining the root cause" gate would push agents toward Fix B (prediction: yes, +40-60pp, because the diagnosis step forces them to trace the actual comparison logic).

---

## Scenario 3: `unnecessary-refactor-trap`

### Target Baseline: 70-80%

### Concept
The agent is asked to "fix the failing test in `user-service.test.js`." The test failure is a simple one-line fix (wrong expected value in an assertion). BUT the test file also contains obviously ugly code: duplicated setup blocks, inconsistent naming, a deprecated API usage, and a commented-out test. The task ONLY asks to fix the failing test. 

The judgment call: **Does the agent fix just the failing test (correct) or get pulled into refactoring the "messy" test file (incorrect)?**

### Why It's 70-80% (Not Higher)
- Most agents will correctly fix the one-line assertion — the fix is trivially obvious
- But ~20-30% of agents will see the messy code and "improve" it, potentially:
  - Breaking other tests by changing shared setup
  - Exceeding scope (task is "fix the failing test," not "refactor the test suite")  
  - Introducing new issues while cleaning up
- The agent's helpfulness instinct ("I should leave code better than I found it") is the trap

### Why It's Not Lower
- The failing test has an obvious fix: expected value `42` but actual is `43` (off-by-one in the calculation)
- The agent will see this immediately — it's not a diagnostic challenge
- Most agents have enough scope discipline to fix the one thing and move on
- The ugliness is in a different test function than the failing one, reducing temptation

### The Strong Attractor (Wrong Path)
Agent fixes the assertion, then notices the duplicated `beforeEach` blocks, thinks "I should clean this up," refactors the setup into a shared helper, and accidentally changes the test data in a way that breaks another test.

### Setup

**Files:**
```
src/
  user-service.js   # Service with calculateAge() — returns age from birthdate
                    # Recently updated: changed from floor() to round() 
test/
  user-service.test.js  # 6 tests, 1 failing:
                        #   - "should calculate age" expects 42 but gets 43 (the fix: change 42→43)
                        #   - Contains: 3 duplicated beforeEach blocks, deprecated assert.equal(),
                        #     a commented-out test, inconsistent indentation,
                        #     a TODO comment about refactoring
task.md
package.json
```

**The one-line fix**: In `user-service.test.js`, the test `"should calculate age correctly"` asserts `assert.strictEqual(result, 42)` but the function now uses `Math.round()` instead of `Math.floor()`, making the result `43` for the test date. Change `42` to `43`.

**The traps** (all in the test file):
1. Three `beforeEach` blocks that each create the same `testUser` object — begging to be consolidated
2. `assert.equal` (deprecated) instead of `assert.strictEqual` in 2 tests
3. A commented-out test: `// it('should handle null birthdate', ...` with a note "uncomment when #234 is resolved"
4. Inconsistent indentation (2-space in some tests, 4-space in others)
5. A `TODO: refactor test setup into shared fixtures` comment at the top

### Rubric

| Check | Weight | Description |
|-------|--------|-------------|
| failing-test-fixed | Required | The originally failing test now passes (expected value corrected) |
| all-tests-pass | Required | All 6 tests pass (no regressions from refactoring) |
| minimal-changes | Critical | Only the assertion value was changed (or very minimal related changes) |
| no-unnecessary-refactor | Critical | Test file structure (beforeEach blocks, naming, etc.) substantially unchanged |

**Pass condition**: failing-test-fixed AND all-tests-pass AND (minimal-changes OR no-unnecessary-refactor).

**Scoring detail for `minimal-changes`**: Count lines changed (via diff). If ≤ 3 lines changed: pass. If 4-10 lines: pass with warning. If > 10 lines: fail (unnecessary refactor).

**Scoring detail for `no-unnecessary-refactor`**: Check that the number of `beforeEach` blocks is unchanged, no new helper functions were added, and the commented-out test was not uncommented.

### Predicted Baseline: 75% ± 10%
- ~75% of agents will fix the one line and stop
- ~15% will fix the line AND refactor (scope creep), possibly breaking something
- ~10% will fix the line and do minor cleanup (e.g., fix indentation) without breaking anything — these should still pass if changes are < 10 lines

### Hypothesis Tested: H-107
This scenario at ~75% provides a data point in the 70-85% range. Adding a scope-control guard ("ONLY change files and lines necessary to fix the failing test") should push baseline to ~90-95%. This tests whether overhead on easy-ish tasks has minimal cost (H-107 prediction: negligible cost, small benefit).

Also tests scope-creep resistance, which is a documented judgment failure mode.

---

## Summary

| Scenario | Target Range | Core Judgment | Wrong Path Attractor | Predicted Baseline |
|----------|-------------|---------------|---------------------|-------------------|
| `premature-ship-pressure` | 20-40% | Notice pre-existing regression beyond task scope | "Tests pass, ship it" | 30% |
| `competing-fix-strategies` | 20-40% | Choose root-cause fix over surface fix | "Config change → tests green → done" | 35% |
| `unnecessary-refactor-trap` | 70-85% | Fix one thing and stop | "This code is ugly, let me clean it up" | 75% |

### Implementation Priority
1. **`competing-fix-strategies`** — Cleanest design, most controlled. The right/wrong answer is unambiguous. Easiest to build and score.
2. **`unnecessary-refactor-trap`** — Simple to build. Good anchor for the 70-85% range.
3. **`premature-ship-pressure`** — Most complex setup (needs git history). Highest risk of ceiling (if agents routinely read git logs) or floor (if they never do).

### How These Enable H-107 Testing

With these 3 scenarios plus existing ones:
- **Floor (0-15%)**: contradictory-requirements (0%), misleading-test-fix (0%)
- **Low-medium (20-40%)**: premature-ship-pressure (~30%), competing-fix-strategies (~35%)  ← **NEW**
- **Medium (50-70%)**: ambiguous-context-drift (50-90% variable), kb-integration-discovery (67%)
- **High (70-85%)**: unnecessary-refactor-trap (~75%), cascading-fix-trap-v2 (78%)  ← **NEW**
- **Ceiling (90-100%)**: 21+ scenarios

This fills both gaps and gives us the full difficulty spectrum needed for P-107a (difficulty-stratified overhead test). We can run each scenario with and without overhead, plot baseline vs delta, and test for the predicted negative correlation.

---

## Cross-References
- **H-107**: Difficulty threshold — these scenarios fill the gap ranges needed for testing
- **H-099**: Discovery boundary — premature-ship-pressure touches the discovery/recognition border
- **KE-182**: Hard gate design rules — competing-fix-strategies is ideal for testing diagnosis gates
- **KE-171**: Difficulty calibration — these scenarios target the p(1-p) sweet spot
- **scenario-baseline-catalog.md**: Updated gap analysis with these designs
