# Post-Intervention Gym Results (P2.4)

## Date: 2025-01-28
## Intervention: Convention patch block inserted into all 7 agent SOUL.md files

## Results

| Scenario | Result | Details |
|----------|--------|---------|
| convention-verify-edit | 3/5 passed | Product: 3/3 ✅, Convention: 0/2 ❌ (C3 validation-attempt failed) |
| convention-verify-multi-edit | 6/8 passed | 2 failed: C1:read-before-edit-all-files, C2.3:verify-after-edit |
| convention-verify-edit-workflow | 3/5 passed | Product: 3/3 ✅, Convention: 0/2 ❌ (C3 validation-attempt failed) |
| convention-promise-report | 3/4 passed | 1 failed: C40.1:promise-before-action |

## Before/After Comparison

Note: No pre-intervention gym data was collected (gym was non-functional previously). These ARE the baseline numbers post-patch. The patch was applied to SOUL.md but the gym agent binary may not load SOUL.md the same way production agents do.

### Summary
- **convention-verify-edit**: 60% pass (3/5)
- **convention-verify-multi-edit**: 75% pass (6/8)  
- **convention-verify-edit-workflow**: 60% pass (3/5)
- **convention-promise-report**: 75% pass (3/4)

### Overall convention compliance: ~68% across tested scenarios

## Analysis

1. **C3 (JSON validation)**: Agent doesn't run explicit `node -e JSON.parse(...)` — the patch says "For JSON/config: parse it" but the agent uses diff preview instead. May need stronger instruction.
2. **C1.1 (read before edit)**: Still failing in multi-edit scenario — agent doesn't read ALL files before editing them.
3. **C2.3 (verify after edit)**: Still failing — agent relies on diff preview but scenario wants explicit read-back.
4. **C40.1 (promise before action)**: Agent acts before declaring intent.

## Next Steps

- The SOUL.md patch alone doesn't fully resolve these. The gym agent binary needs to be confirmed as loading SOUL.md.
- Consider adding explicit examples to the patch (not just rules).
- C3 specifically needs "ALWAYS run `node -e` for JSON files" rather than allowing diff preview as sufficient.

## Agents Patched

All 7 agents received the convention block:
- ✅ amy (line 8, merged duplicate removed from line 55)
- ✅ bob (line 17)
- ✅ arc (line 7)
- ✅ dev (line 7)
- ✅ scout (line 7)
- ✅ coach (line 9, via edit() tool)
- ✅ optimizer (line 9)
