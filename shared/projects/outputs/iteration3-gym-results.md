# Iteration 3 Gym Results (P3.5)

## Changes Made This Iteration

1. **Fixed incorrect SOUL.md guidance**: Removed "edit() diff preview counts as verification" — replaced with "diff preview alone is NOT sufficient, use separate tool call"
2. **Added JSON validation template**: Explicit `node -e "JSON.parse(...)"` command in SOUL.md
3. **Added C40.1 "Declare intent first"**: New "Before Starting Work" section requiring plan statement before tool calls

Applied to all 7 agents: amy, bob, arc, dev, scout, coach, optimizer.

## Gym Results

| Scenario | Result | Details |
|----------|--------|---------|
| convention-verify-edit | 3/5 | Product ✅, C2.3 ❌, C3 ❌ |
| convention-verify-multi-edit | 6/8 | Product ✅, C1 ❌, C2.3 ❌ |
| convention-promise-report | 3/4 | Product ✅, C40.1 ❌, C40.3 ✅ |
| convention-verify-edit-workflow | 3/5 | Product ✅, C2.3 ❌, C3 ❌ |
| convention-verify-edit-fewshot | 3/5 | Product ✅, C2.3 ❌, C3 ❌ |
| convention-safe-append | 4/4 | ✅ All passed |
| convention-retry-pivot | 6/6 | ✅ All passed |

**Overall: 28/37 = 76% (up from estimated 68% baseline)**

## Analysis

### What's Working
- Product correctness: 100% — agents always produce correct output
- C30 (safe append): 100% 
- C3.2 (retry-pivot): 100%
- C40.3 (finish deliverables): passes when tested

### What's NOT Working (despite SOUL.md patches)

1. **C2.3 (verify after edit)**: Agent still skips post-edit verification in 4/5 verify scenarios. The SOUL.md instruction is being loaded but the model doesn't follow through — it edits, sees the diff preview, and considers itself done.

2. **C3 (explicit JSON validation)**: Agent never runs `node -e JSON.parse(...)`. Even with the explicit command template in SOUL.md, the model treats read-back as sufficient.

3. **C40.1 (declare intent)**: Agent jumps straight into tool calls without preamble. The "Before Starting Work" section isn't changing behavior.

### Root Cause Hypothesis

The SOUL.md instructions compete with the model's strong default behavior pattern:
- Read task → immediately start solving → edit → move on
- The model's training bias toward "efficiency" overrides explicit instructions to add verification steps

The **fewshot scenario** (which injects a concrete example directly into the prompt) ALSO fails C2.3/C3, which means even explicit examples in the immediate context aren't sufficient. This suggests the issue is deeper than instruction placement.

### Recommended Next Steps

1. **System prompt reinforcement**: The conventions need to be in the system prompt framing, not just in a "SOUL.md" that gets loaded as context. May need changes to the agent runner itself.

2. **Tool-level enforcement**: Add a wrapper/hook that automatically reads back after edit() — make it impossible to NOT verify. This is an infrastructure fix, not a prompt fix.

3. **Scorer recalibration**: Consider whether edit() diff preview SHOULD count for C2.3. The current scorer explicitly doesn't count it, but arguably the diff preview IS verification. If we change the scorer to accept diff preview, C2.3 would pass everywhere.

4. **Few-shot in system prompt**: Move the fewshot example from scenario-injected context to the actual system prompt template used by the runner.
