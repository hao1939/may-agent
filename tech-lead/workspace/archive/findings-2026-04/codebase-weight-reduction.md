# Codebase Weight Reduction Findings

**Current weight**: 32066 lines | **Target**: 32000 | **Delta needed**: ≥66 lines (aiming for 100+)

## Finding 1: Experiment file `agents/coach/workspace/exp143/run-experiment.ts` — 1196 lines

This experiment script is a standalone runner not imported by any production code. Only referenced by its own directory and a design doc (`agents/shared/knowledge/experiments/EXP-143/design.md`). If the experiment is complete, the entire file can be removed or archived outside the line-counted tree.

- **File**: `agents/coach/workspace/exp143/run-experiment.ts:1-1196`
- **Lines removable**: ~1196
- **Severity**: Low risk — standalone script, no imports from src/
- **Action**: Confirm experiment is concluded, then delete or move to an archive outside the counted tree.

## Finding 2: Deprecated constants and fields in `manager-utils.ts`

Three deprecated items with no functional purpose:

- `RESTORED_MAX_TURNS_FALLBACK` — always 0, deprecated (`manager-utils.ts:158`)
- `guardRedirectCount` field — deprecated, type compat only (`manager-utils.ts:235`)
- `opBudget` field in `RunOptions` — deprecated, always 0 (`manager-utils.ts:263`)

**Lines removable**: ~6 (definitions + doc comments)
**Action**: Remove deprecated fields and update any trivial references.

## Finding 3: Unused re-exports in `index.ts`

Two exports from `src/lib/index.ts` have zero consumers outside their defining modules:

- `WorkflowBlocked` — re-exported at `index.ts:50`, defined at `workflow.ts:146`. Zero imports from app/ or test/.
- `extractChangedFiles` — re-exported at `index.ts:66`, defined at `workflow-utils.ts:71`. Zero imports from app/ or test/.

**Lines removable**: ~2 (re-export lines) + potentially the implementations if truly dead.
**Action**: Grep confirm zero usage, remove re-exports. If implementations also have no internal callers, remove those too (~30 lines).

## Finding 4: Verbose tool descriptions in `manager-agents-tool.ts`

`manager-agents-tool.ts` (581 lines) contains 16 inline `description` fields with multi-line prose strings for the agents/subagents tool schema. These descriptions are duplicated in the system prompt injected to agents (visible in the user's tool definitions above).

- **File**: `manager-agents-tool.ts:100-170` (schema descriptions)
- **Lines reducible**: ~20-30 by shortening descriptions
- **Severity**: Low — cosmetic, but contributes to weight
- **Action**: Trim verbose descriptions to single-line summaries.

## Finding 5: Comment density in large files

| File | Lines | Comment lines | % |
|------|-------|--------------|---|
| `manager.ts` | 2481 | 238 | 9.6% |
| `may.ts` | 1247 | 102 | 8.2% |
| `evaluator.ts` | 986 | 82 | 8.3% |
| `cron.ts` | 1126 | 76 | 6.7% |

Not a primary target, but `manager.ts` has 238 comment lines — some may be stale/redundant.

---

## Summary

| Finding | Lines removable | Risk |
|---------|----------------|------|
| exp143 runner | ~1196 | Low (standalone) |
| Deprecated fields | ~6 | Low |
| Unused re-exports | ~2-30 | Low |
| Verbose descriptions | ~20-30 | Low |
| **Total** | **~1224-1262** | |

**Recommended priority**: Finding 1 alone exceeds the 100-line target by 10x. Start there.

## Follow-up

- Verify exp143 experiment status before deletion (check with coach agent).
- Audit `WorkflowBlocked` and `extractChangedFiles` for dynamic/string-based usage before removing implementations.
