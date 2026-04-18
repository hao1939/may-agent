# Surface Fragility Ratings

Based on historical rejection and regression data, these config surfaces have known fragility levels:

## Risk Ratings

| Surface / File Type | Fragility | Evidence |
|---------------------|-----------|----------|
| prompt.md edits | **HIGH** | 3/4 past edits caused regressions |
| context.md additions | LOW | 0/5 past edits caused regressions |
| heartbeat structure (step reorder/rename) | **CRITICAL** | KE-008: every structural change caused regression |
| Test file modifications | **HIGH** | Edits to test files frequently break assertions |
| Config file edits (tsconfig, package.json) | MODERATE | 2/6 past edits caused build failures |

## How To Use This

1. **Before editing any file**, check its fragility rating above.
2. **HIGH/CRITICAL surfaces**: Verify your changes by reading the file back and running tests BEFORE moving on.
3. **LOW surfaces**: Normal workflow is fine.
4. **When you have a choice** of where to make a change, prefer LOW-fragility surfaces over HIGH ones.
5. **After editing a HIGH-fragility file**, re-run the relevant verification step to catch regressions immediately.
