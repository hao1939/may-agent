# Optimizer Brief: Block `npx tsc` in Exec Tool

**Philosophy Principle:** 21. Deterministic Guardrails for Reliability
**Principle:** "Put constraints and invariants in code/tools where possible (structural fixes) rather than relying only on 'be careful' instructions."

## Problem
The evaluator found that `npx tsc` (full type checking) is frequently run by agents, consuming massive time and tokens, often timing out or filling context with thousands of irrelevant errors from the entire repo. Agents should not be running full project type checks — they should rely on `health_check` (which runs tsc safely) or check specific files.

## Recommended Fix
Modify `src/tools.ts` to add `npx tsc` (and `tsc`) to the `denyPatterns` in the `exec` tool options.

1.  **Block `npx tsc` and `tsc`** in `createExecTool` (or the default deny list).
2.  **Provide a helpful error message**: "Full type checking is too expensive. Use the `health_check` tool to run project-wide checks, or trust your specific file edits."

## Target File
- `src/tools.ts`
