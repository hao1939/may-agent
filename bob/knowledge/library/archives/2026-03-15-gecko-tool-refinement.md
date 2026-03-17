# Synthesis: P200 Tool-Call Refinement (Gecko)

**Date:** 2026-03-15
**Source:** arXiv:2602.19218 (Gecko), arXiv:2602.17037 (Wink)
**Status:** DRAFT

## 1. The Problem: Tool-Call Fragility
Our current tool execution model is "Fire and Pray". The agent generates a tool call, we execute it immediately, and if it fails (syntax error, wrong arguments, safety violation), we burn a turn and return an error.
- **Cost**: Wasted tokens, wasted turns.
- **Risk**: Side effects (partial writes, state corruption) before error.
- **Data**: 30% of agent trajectories exhibit tool misbehaviors (Wink).

## 2. The Solution: Simulation Loop (Gecko Pattern)
Instead of `Generate -> Execute -> Error`, we insert a simulation step:
`Generate -> Simulate (Syntax/Schema/Safety) -> Refine -> Execute`.

This acts as a **Context Gate (P61)** for tool calls.
- **Validity Check**: Is the tool name valid? Are arguments correct types?
- **Safety Check**: Does it violate P53/P61? (e.g., `rm -rf`, `write` to protected path).
- **Refinement**: If invalid, the harness gives immediate feedback *without executing the tool*. The agent corrects the call in the same turn or a "scratchpad" turn.

## 3. The Principle: P200 Tool-Call Refinement
**"Simulate before you Commit."**
No tool call should touch the OS until it is syntactically valid and safety-compliant.
- **Mechanism**: The `ToolClient` (in `manager.ts`) must support a `dry_run` or `validate` mode.
- **Benefit**:
  - **Reliability**: Syntax errors don't crash the task.
  - **Safety**: Malicious/accidental `rm -rf` is caught before execution.
  - **Efficiency**: "Free" refinement turns (simulated) are cheaper than full execution turns.

## 4. Implementation Strategy
1. **Harness Update**: Modify `src/lib/manager.ts` to validate tool calls against schema *before* passing to `tools.execute`.
2. **Feedback Loop**: If validation fails, return a "Virtual Error" to the agent: "Tool call invalid: [Reason]. Please correct." Do not execute.
3. **Safety Integration**: Move `checkProtectedPath` and `checkCommandSafety` into this validation phase.

## 5. Next Steps
- Brief Tech-Lead to implement `validateToolCall(call)` in `manager.ts`.
- Update `philosophy.md` with P200.
