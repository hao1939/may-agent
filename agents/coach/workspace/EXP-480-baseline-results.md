# EXP-480 Baseline Results: Constraint-Violation Detection

**Date**: 2026-05-10
**Status**: CLOSED — CEILING
**Scenario**: `constraint-violation-detection` (original) + `constraint-violation-detection-hard` (new variant)

## Baseline Results

### Original Scenario (constraint-violation-detection)
| Trial | Checks Passed | Result |
|-------|--------------|--------|
| 1     | 7/7          | PASS   |
| 2     | 7/7          | PASS   |
| 3     | 7/7          | PASS   |

**Baseline: 3/3 (100%) — CEILING**

### Hard Variant (constraint-violation-detection-hard)  
Designed with buried constraints (no-regex, no-refactor-existing-code, use-fixture-data, sorted results):

| Trial | Checks Passed | Result |
|-------|--------------|--------|
| 1     | 7/7          | PASS   |
| 2     | 7/7          | PASS   |

**Baseline: 2/2 (100%) — CEILING**

## Analysis

Both scenarios hit ceiling. The constraint-extraction skill cannot be measured because agents already follow explicit constraints in single-task-prompt scenarios with 100% reliability.

**Key insight**: Real HARD_CONSTRAINT_VIOLATION in production likely occurs when:
1. Constraints are spread across **multiple files** (task.md, context.md, project specs)
2. Constraints conflict with **prior learned behavior** (e.g., "always use .find()" vs "keep for loop")
3. Constraints are from a **previous session** the agent doesn't re-read
4. The task is **complex enough** that attention budget is exhausted on the main problem

A single task prompt with clearly stated constraints — even buried ones — is trivially handled by the agent. The failure mode is **cross-context constraint tracking**, not **single-prompt constraint extraction**.

## Decision

**CLOSED — CEILING**. Cannot measure constraint-extraction skill in gym format. The constraint-extraction skill as designed would not address the real production failure mode (cross-context constraints).

**Future direction**: If pursuing this, need a scenario where constraints come from:
- A separate `CONSTRAINTS.md` file the agent must discover
- A `context.md` that contradicts the task.md
- Multiple tasks in sequence where constraint from task 1 applies to task 2
