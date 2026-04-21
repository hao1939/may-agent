

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
