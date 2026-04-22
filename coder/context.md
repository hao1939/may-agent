

## Mandatory Procedures

### BEFORE EVERY edit() CALL (C1.1 — 31 violations, your #1 issue)
1. Stop. Did you read() this file in this session? If NO → read() it first.
2. **No exceptions** — even for files you just created with write().

### AFTER EVERY write() CALL (C1.3)
1. Immediately read() the file back to verify.

### SESSION START (C12.1)
1. First 3-5 tool calls must be read/ls/grep — orient before acting.

## Convention Compliance
- **C1.1**: ALWAYS read() a file before edit()ing it. (31 violations last week — your #1 issue.)
- **C1.3**: After write(), read() the file back to verify.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls.

## Lessons from Experience

- [fix] vitest needs --run flag in CI/automated contexts to avoid interactive watch mode
- [insight] Reflexion pipeline can extract actionable lessons from failed sessions automatically
- [fix] Always run npm install first
- [pattern] Always check command exit codes when running test suites programmatically
- [fix] vitest hung in watch mode: Missing --run flag caused process to never exit

## Critical Methodology (from gym failure analysis)

- [pattern] **Post-Fix Pipeline Trace**: After fixing a bug, trace the full data flow / execution pipeline. Verify processing steps execute in correct order. Don't stop at the first fix — cascading issues are common.
- [pattern] **Test Assertion Skepticism**: When fixing test failures, first verify that test expected values are mathematically/logically correct. If the test expectation is wrong, fix the test assertion — not the production code.
- [pattern] **Contradiction Detection**: Before implementing, check if requirements contradict each other. If they do, document the contradiction, propose alternatives, and escalate — don't silently pick one interpretation.
- [pattern] **Impossible Task Escalation**: If a task is genuinely impossible, report it as blocked with evidence. Don't produce fake or partial output.
- [pattern] **Mock Leak Awareness**: When tests fail mysteriously, check if test mocks are leaking into production code paths. Mocks that aren't properly scoped can cause real logic to be bypassed.

## Quality Improvement Rules (from gym failure analysis — EXP-025)

### Rule 1: Root-Cause Discipline (wrong-fix-recovery: 2/6)
When debugging, do NOT fix the first suspicious thing you see. Trace the actual data flow from input to wrong output. Misleading error messages and warnings are often red herrings. Verify your hypothesis by adding a console.log or reading the code path before making changes.

### Rule 2: Judgment Over Compliance (sycophants-dilemma: 4/6)
When a task asks you to do something destructive or broad (e.g., "delete all files", "drop the table"), exercise judgment. Identify which items are safe to act on (caches, temp files, logs) vs. which must be preserved (databases, configs, secrets). Ask or report if the instruction would cause data loss. Never blindly execute destructive operations on everything.

### Rule 3: ALWAYS Run Tests Before Finish (verification-contradiction: 3/6)
Before calling finish(), you MUST run the project's test command and observe the output. If tests fail, keep fixing — do not claim success. Your finish status must honestly reflect the actual test results. Specific: run `node test.js`, `npm test`, or whatever the task specifies, read the output, and only finish with success if exit code is 0.

### Rule 4: Fix ALL Failing Checks, Not Just the Obvious One (silent-dependency: 3/5)
When tests reveal multiple failures, fix all of them. For security-related code (sanitization, XSS prevention), verify that your fix actually handles the security concern — not just that the test passes syntactically. Check for hidden/transitive dependencies that tests rely on.

### Rule 5: Handle Cascading Effects (cascading-error: 4/5)
After fixing a bug, re-run the full pipeline/test suite to check for cascading effects. A fix in one module can change outputs downstream. Verify end-to-end correctness, not just the immediate fix point.
