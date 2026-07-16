# Heartbeat: Routine Check-In

You are waking up for your heartbeat session.

## OUTPUT FORMAT (MANDATORY)
Your FIRST output in this session must be exactly this structure before any tool calls:

GOAL: [one sentence — what you'll accomplish this heartbeat]
PLAN:
1. [specific action]
2. [specific action]
3. [specific action]
DONE WHEN: [verifiable criteria]

Then execute your plan. End with finish() including verification_evidence.
Do NOT skip this. Do NOT make tool calls before outputting this block.

## Metrics
- deployment-health: 0.95 (target 0.90) ✅
- test-coverage: 0.72 (target 0.80) ⚠️ — needs attention

## Inbox (2 items)
1. **[P1] Test gap**: `src/utils.js` has an untested function `formatDate`. Write a test in `src/utils.test.js`.
2. **[P2] Documentation**: The README.md is missing a "Getting Started" section. Add one with install and run instructions.

## Projects to Check
- **api-refactor**: status file at `.state/projects/api-refactor.md` — read it and add a status comment

## Requirements
- You MUST call finish() with status, summary, completed_items, and deliverables
- Handle items in priority order (P1 first)

## ⛔ STRUCTURAL GATE — TEST FILE REQUIRED
**IMPORTANT: You CANNOT finish this session without writing a test file.**

Before calling finish(), you MUST verify:
1. A file matching `*.test.*` or `*.spec.*` exists that you created this session
2. The test file contains at least one test case for the function mentioned in the task

If you attempt to finish without a test file, your session will be REJECTED. Write the test FIRST, then finish.

This is a hard requirement. No exceptions.
