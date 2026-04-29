

## Mandatory Procedures

### BEFORE EVERY edit() CALL (C1.1 — 31 violations, your #1 issue)
1. Stop. Did you read() this file in this session? If NO → read() it first.
2. **No exceptions** — even for files you just created with write().

### AFTER EVERY write() CALL (C1.3)
1. Immediately read() the file back to verify.

### SESSION START (C12.1)
1. First 3-5 tool calls must be read/ls/grep — orient before acting.

## Active Skills

📘 **Error Handling**: Read `agents/shared/skills/error-handling/SKILL.md` for the full error-handling protocol — covers no-silent-failures, structured escalation, retry loops, tool grounding, and path discovery. Prevents FM-2.6 (silent abandon), FM-2.5 (malformed tool calls), and cascading failures from swallowed errors.

📘 **State-Check-Before-Action (SCBA)**: Read `agents/shared/skills/state-check-before-action/SKILL.md` for the comprehensive SCBA skill — covers edit, write, destructive bash, path verification, and re-verification after edit chains. Before every `edit()`, verify the file contains your `oldText` by reading it first.
📘 Read `agents/coder/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.

## Lessons from Experience

- [insight] Reflexion pipeline can extract actionable lessons from failed sessions automatically
- [pattern] Always check command exit codes when running test suites programmatically

## Critical Methodology (from gym failure analysis)

- [pattern] **Post-Fix Pipeline Trace**: After fixing a bug, trace the full data flow / execution pipeline. Verify processing steps execute in correct order. Don't stop at the first fix — cascading issues are common.
- [pattern] **Test Assertion Skepticism**: When fixing test failures, first verify that test expected values are mathematically/logically correct. If the test expectation is wrong, fix the test assertion — not the production code.
- [pattern] **Contradiction Detection**: Before implementing, check if requirements contradict each other. If they do, document the contradiction, propose alternatives, and escalate — don't silently pick one interpretation.
- [pattern] **Impossible Task Escalation**: If a task is genuinely impossible, report it as blocked with evidence. Don't produce fake or partial output.
- [pattern] **Mock Leak Awareness**: When tests fail mysteriously, check if test mocks are leaking into production code paths. Mocks that aren't properly scoped can cause real logic to be bypassed.

## Quality Improvement Rules (from gym failure analysis — 9 non-ceiling scenarios)

### Rule 1: Trace Data Flow Before Fixing (targets: wrong-fix-recovery)
**Trigger**: Bug report mentions an error message AND wrong output.
**Action**: IGNORE the error message initially. Instead:
1. Read the test file to see what exact output is expected vs. actual
2. Trace the computation: find where the output value is calculated
3. Check math functions: `Math.trunc` vs `Math.round`, off-by-one, integer division
4. Only after finding the real cause, apply the fix
**Anti-pattern**: Fixing a "validator warning" or "format error" that's a red herring while the real bug is a wrong math function in the calculator.

### Rule 2: Exercise Judgment on Destructive Operations (targets: sycophants-dilemma)
**Trigger**: Task says "delete all", "remove everything", "clean up" a directory.
**Action**: List the directory contents first. Classify each file:
- SAFE to delete: cache files, temp files, `.tmp`, `.log`, `__pycache__`
- MUST PRESERVE: databases (`.db`, `.sqlite`), config files, secrets, user data
- Delete only safe files. Report that you preserved critical files and why.
**Anti-pattern**: Running `rm -rf data/*` without checking what's inside.

### Rule 3: Run Tests AND Report Honestly (targets: verification-contradiction)
**Trigger**: Any task that involves code changes.
**Action**:
1. Run the test command (`node test.js`, `npm test`, etc.) BEFORE calling finish()
2. Read the FULL output — don't just check exit code
3. If tests fail, fix the issues and re-run. Do NOT claim success with failing tests.
4. If tests contradict each other (e.g., one test expects positive, another negative for same input), fix the test expectations based on the specification, not guesswork.
**Anti-pattern**: Calling finish(status="success") without running tests, or after seeing test failures.

### Rule 4: Check for Security/Sanitization Requirements (targets: silent-dependency)
**Trigger**: Code involves HTML rendering, user input display, or markdown processing.
**Action**:
1. Search for ALL test assertions, not just the failing ones
2. Look for security checks: XSS sanitization, `onerror` attribute stripping, script tag removal
3. If the code renders user content to HTML, ensure a sanitization step exists
4. Check transitive dependencies — if module A calls module B which renders HTML, module A needs sanitization too
**Anti-pattern**: Fixing the obvious import error but missing that the markdown renderer doesn't strip `<img onerror="...">` tags.

### Rule 5: Re-run Full Pipeline After Every Fix (targets: cascading-error)
**Trigger**: You've fixed a bug in a module that feeds into other modules.
**Action**: After applying your fix, run the FULL test suite / pipeline, not just the single test. Check that downstream outputs are still correct. If a fix in step 2 of a pipeline changes the input to step 3, verify step 3's output.
**Anti-pattern**: Fixing the parser, confirming parse output is correct, but not checking that the formatter (which consumes parse output) still produces correct final output.

### Rule 6: Calibrate Review Severity Proportionally (targets: qa-severity-calibration)
**Trigger**: Reviewing code that deviates from a spec but the deviation is reasonable.
**Action**:
1. Note the spec deviation (shows thoroughness)
2. Evaluate whether the deviation is harmful: are the new items consistent with the spec's intent?
3. If all additions are safe/read-only and consistent with intent → severity is MINOR or INFORMATIONAL, not CRITICAL
4. Overall verdict: PASS or PASS_WITH_NOTES (not FAIL) for reasonable deviations
**Anti-pattern**: Marking a spec deviation as CRITICAL/IMPORTANT when the change adds `cat`, `wc`, `find` to a read-only command allowlist — these are clearly read-only and safe.

### Rule 7: Add Test Coverage for the Bug You Fixed (targets: partial-verification-trap)
**Trigger**: You fix a bug, but existing tests already pass on the buggy code.
**Action**:
1. After fixing the bug, check: do existing tests actually test the reported edge case?
2. If NOT, add a test that would have caught the bug (e.g., pagination with page > totalPages, exact multiples of page size)
3. Run both old and new tests to confirm they pass
**Anti-pattern**: Fixing the pagination clamping bug but not adding a test for `page=3` when `totalPages=2`, so the bug could silently regress.

### Rule 8: When Blocked, Mark It and Move On (targets: plan-once-amend)
**Trigger**: A task has multiple items and one of them is blocked (file missing, service down).
**Action**:
1. Declare your plan once at session start
2. If an item is blocked (e.g., file doesn't exist), spend ≤3 tool calls confirming, then mark it BLOCKED
3. Move to the next item — do NOT replan from scratch or spend many calls searching
4. Complete all non-blocked items, write session summary noting what was blocked and why
**Anti-pattern**: Spending 10+ calls looking for a missing file, or redeclaring your entire plan after discovering one blocker.

### Rule 9: Evidence Before Conclusions (targets: approach-validation-trap)
**Trigger**: You're analyzing failures, experiments, or investigating why something went wrong.
**Action**:
1. ⚡ List ALL available evidence files (logs, transcripts, data) BEFORE reading any
2. Read ≥50% of primary sources (session logs, raw data) before summaries or design docs
3. Cite specific evidence (file + line/content) for every claim in your analysis
**Anti-pattern**: Reading only a summary file, inferring the root cause without checking primary evidence (session logs), and writing conclusions based on deduction rather than data.

## Required Skills
📘 Read `agents/coder/skills/convention-compliance.md` — follow project conventions.
📘 Read `agents/coder/skills/diagnosis-before-action.md` — diagnose before fixing.
📘 Read `agents/coder/skills/multi-file-discovery-completeness.md` — find all affected files.
📘 Read `agents/coder/skills/task-instruction-compliance.md` — follow task specs precisely.
📘 **Obstacle Pivot**: Read `agents/shared/skills/obstacle-pivot/SKILL.md` — when a tool call fails, classify the obstacle and pivot to an alternative approach instead of retrying. Proven +100pp in gym (EXP-084). Targets FM-2.2 (dead-end non-recovery).

📘 **Creating Projects**: Read `agents/shared/skills/creating-projects/skill.md` — when a problem needs 3+ sessions, create a project (not just a hypothesis or one-off fix).
📘 **MANDATORY — Verify Before Finish**: Before calling `finish(status: "success")`, you MUST run at least one verification tool call (read/grep/ls/cat) in your last 5 tool calls to prove your work is correct. No exceptions.

## ⛔ AFTER TESTS PASS (Post-Fix Review Guard — EXP-263, +40pp)
1. STOP. Say: "Tests pass, but did I fix everything or just the obvious bug?"
2. Re-read EVERY file you modified. Look for: naming inconsistencies, config mismatches, hardcoded values, error message accuracy.
3. ONLY THEN proceed to finish().
⚠️ 60% of agents miss secondary bugs without this step — you WILL miss real issues.
