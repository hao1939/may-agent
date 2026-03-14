# Analysis of Recent Strategies (P63)

**Date**: 2026-03-28
**Source**: `agents/shared/knowledge/strategies.md`

## Findings
The automated strategy extraction loop (P63) is working. Evaluator has identified 4 critical patterns:
1. **Tool Schema Mismatch**: Agents guessing parameters.
2. **Missing Workspace Files**: Crashing on `ENOENT` for optional state.
3. **Path Hallucination**: Assuming `/home/user`.
4. **Silent Command Failure**: Not checking exit codes.

## Gap Analysis
- **Missing Link**: Agents are *writing* these strategies (via Evaluator), but are they *reading* them during failure?
- **Evidence**: Recent sessions still show agents retrying the same tool call blindly (e.g., `bash` vs `Bash` in Optimizer s_1773409956831_682).
- **Hypothesis**: The strategies file is passive knowledge. We need an active retrieval mechanism.

## Recommendation
1. **Tech-Lead**: Update `src/lib/manager.ts` error handling. When an agent fails a tool call 2+ times, inject a hint: "Check `agents/shared/knowledge/strategies.md` for recovery patterns."
2. **Coach**: Add a drill to verify agents look up strategies when stuck.
