# Gym Result: verify-before-finish
Date: 2026-03-30
Scenario: partial-verification-trap
Agent: coder

## Baseline (without skill)
- Score: 5/6 (exp-223)
- Key observations: Coder fixes the pagination bug and runs tests, but does NOT add an edge case test for the exact-multiple boundary condition. All product checks pass; behavioral check `added-edge-case-test` fails.

## With Skill (text injection via lab fork)
- Score: 5/6 (exp-229)
- Key observations: Skill text was injected into coder's prompt as part of skills/ directory. The skill explicitly tells the agent to "think about edge cases" and "write a small test." Despite this, the coder still did not add an edge case test. Same behavior as baseline.
- Duration: 41s
- Prompt hash: f2f7ac883228

## Comparison: Method #15 Workflow Enforcement (exp-224)
- Score: 6/6 (2/2 runs)
- Key observations: Two-phase workflow structurally forces Phase 2 to review test coverage. Agent reliably adds edge case test under this constraint.

## Verdict: DISPROVEN
- Works when: N/A — did not change behavior in any tested condition
- Fails when: Bug-fix tasks where agent needs to proactively add edge case tests

## Root Cause Analysis
The verify-before-finish skill is **instructional** ("think about edge cases", "add a test"). But the coder's natural behavior is to fix → verify → finish. Adding more text doesn't change the workflow structure. The agent reads the skill, potentially agrees with it, but its execution loop doesn't naturally create a "pause and review coverage" step.

Method #15 (workflow enforcement) works because it **structurally** creates a second phase where the task context changes from "fix the bug" to "review your work for gaps." This context switch is what triggers the desired behavior — not the text of the instruction.

## Broader Insight
This confirms the SOUL.md finding: **text-based instructions have ~0% effect on procedural behavior changes.** Only structural changes to the task flow (workflow phases, explicit pauses, different context framing) change agent behavior reliably.

Skills that are purely instructional (do X before Y) should be considered low-priority for deployment. Skills that can be expressed as structural workflow changes should be prioritized.
