# Context Learning Project — Progress Update

**Date**: 2027-09-28 | **Status**: Active (revived from archive)

## What was done this session

1. **Resolved npx-availability blocker**: Created `environment/bin/npx` fake script that simulates npx being unavailable (exit 127 with error message). When PATH is prepended with this bin/, agents attempting `npx` will fail, while `node_modules/.bin/prettier` still works correctly.

2. **Created treatment scenario**: `reflexion-npx-recovery-treatment` — identical to baseline but with `context_injection` field containing a reflexion-style lesson telling the agent to use node_modules/.bin/ directly.

3. **Added .prettierrc**: Ensures consistent formatting expectations across runs.

4. **Updated task.md**: Clarified that bin/ is prepended to PATH.

## Experiment Status

| Step | Status | Notes |
|------|--------|-------|
| 1. Build scenarios | ✅ DONE | Both baseline + treatment exist |
| 2. Run baseline (5x) | ⬜ NEXT | Need gym runner integration |
| 3. Extract lesson | ✅ DONE | Using human-authored lesson for treatment (control); LLM extraction is Step 3b |
| 4. Run treatment (5x) | ⬜ | After baseline |
| 5. Analyze results | ⬜ | Compare npx-attempt rates |

## Blockers for Step 2

The gym runner needs to:
- Set `PATH="$(pwd)/bin:$PATH"` before running agent commands in this scenario
- Record transcript to a file for success_criteria.js to check npx usage

**Option A**: Add a `setup_script` field to scenario.json that gym runner executes before the agent.
**Option B**: Have the task.md instruct the agent to cd into env and prepend PATH themselves.
**Option C**: Use scenario.json `environment_vars` field if supported.

## Next session priorities
1. Check gym runner docs for PATH/env customization support
2. Run 5 baseline sessions manually or via gym
3. Collect transcripts and measure npx attempt rate
