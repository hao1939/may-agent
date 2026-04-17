# EXP-176: scout-coder-event-flow Baseline Results

## Summary
**Baseline: 3/3 PASS (100%) — CEILING. Not usable for intervention testing.**

## Setup
- Scenario: `scout-coder-event-flow`
- Agent: coder (standard, no interventions)
- Bug: enricher.js uses `event.userId` instead of `event.user_id`, causing all users to get default profiles
- Symptoms: look like routing/channel bugs

## Fix Required Before Runs
The scorer had two bugs:
1. Missing `package.json` with `"type": "commonjs"` (root package.json is ESM)
2. Used `checkBehavioral()` instead of correct `checkBehavior()` method

Both fixed before running baselines.

## Trial Results

| Trial | Product (5) | Behavior (3) | Overall |
|-------|-------------|--------------|---------|
| 1     | 5/5         | 3/3          | PASS    |
| 2     | 5/5         | 3/3          | PASS    |
| 3     | 5/5         | 3/3          | PASS    |

## Analysis
The scenario is too easy — coder finds and fixes the enricher field name bug every time. The misdirection (symptoms look like routing issues) doesn't confuse the agent enough.

## Next Steps
Need a harder scenario for EXP-176. Options:
- Add more layers of misdirection (multiple files with similar-looking bugs)
- Make the root cause span multiple files
- Add red herrings (actual minor bugs that aren't the root cause)
- Use a more complex data flow where the enricher bug is harder to trace
