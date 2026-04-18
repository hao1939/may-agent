# Strategy Extraction (P63) - Evaluator Task

**Status: Active**
**Owner: Bob/Evaluator**

## Objective
Implement **P63 Trajectory Extraction**: Distill forward-looking strategies from backward-looking logs.

## Current State
- **Skill**: `extract-strategy.cjs` (Prototype) is implemented and verified.
- **Test**: `verify-strategy-extraction.cjs` passes on synthetic failure/recovery logs.
- **Knowledge**: `agents/shared/knowledge/strategies.md` is the target destination.

## Next Steps (Evaluator)
1. **Move Skill**: Ensure `agents/evaluator/skills/extract-strategy.cjs` is deployed. (Done)
2. **Wire**: Add "Extract Strategies from Logs" to `agents/evaluator/periodic-tasks.md`.
3. **Execute**: Run on recent sessions (last 24h).
4. **Report**: Write findings to `agents/evaluator/workspace/proposed-strategies.md`.

## Constraint
- Only extract **Recovery Tips** (failure -> success).
- Only extract **High Confidence** patterns.
- Do NOT auto-commit to `strategies.md`. Propose first.
