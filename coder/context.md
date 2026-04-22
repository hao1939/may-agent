

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
