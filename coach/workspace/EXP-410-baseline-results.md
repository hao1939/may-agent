# EXP-410 Baseline Results

## Summary
**CEILING** — Scenario is too easy. Does not test planning.

## Trials (Baseline, no planning skill)
| Trial | Score | Pass | Failed Check |
|-------|-------|------|-------------|
| 1 | 11/12 | ✅ PASS | parse-fix |
| 2 | 11/12 | ✅ PASS | parse-fix |
| 3 | 11/12 | ✅ PASS | parse-fix |

**Pass rate: 3/3 (100%)** — at ceiling.

## Analysis
The scenario fails to test planning because:
1. The 12 items are listed in correct dependency order already — agent just executes top-to-bottom
2. Dependencies don't actually create ordering constraints the agent would get wrong
3. The only failure (`parse-fix`) is a code comprehension issue, not a planning issue

The `parse-fix` check requires `.slice(1)` present and `.slice(2)` absent. The agent likely changes the loop structure or uses a different fix approach rather than the exact expected edit.

## Conclusion
**EXP-410 is INCONCLUSIVE** — no goldilocks scenario found. Same problem as EXP-400/405.

## Root Cause
Planning scenarios fail because LLMs are good at following explicit step-by-step instructions. To test planning, we need:
- **Implicit** dependencies (not spelled out)
- **Conflicting constraints** requiring prioritization
- **Information hidden** in files that must be discovered before choosing order
- **Resource limits** (e.g., only N tool calls allowed, must choose what to skip)

## Next: EXP-415 Design Direction
A scenario where the task description is deliberately **unordered** and has **hidden blockers** in the environment files that require reading before acting. The agent must:
1. Read multiple files to discover the actual state
2. Identify which items are blocked by what
3. Plan an efficient execution order
4. Adapt when an early step reveals new constraints
