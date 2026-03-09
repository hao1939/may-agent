# Optimizer Brief: Enforce Safe Edit & Fix Meta-Agent Exclusion

## Status: ✅ COMPLETE (both changes already implemented)

## 1. Context
We have two critical issues identified in the Daily Brief and Analysis:
1. **Blind Overwrites**: Agents still risk corrupting large files. The `safe-edit` workflow exists but isn't used.
2. **Lost Intelligence**: 56% of sessions (evaluator/may) are skipped because of a hardcoded `META_AGENTS` exclusion in `evaluate-sessions.ts`.

## 2. Required Changes

### A. Adoption of Safe Edit ✅ Already Done
Coder's `domain.md` (line 22) already instructs:
> **Safe Large-File Edits**: If a file is > 100 lines, DO NOT use `write()`. Use the `safe-edit` workflow (or `sed` if unavailable) to avoid truncation data loss.

This is **stricter** than the 300-line threshold requested (triggers at 100 lines). No `tools.md` exists separately — all instructions are in `domain.md`.

### B. Fix Evaluator Blind Spot ✅ Already Done
`agents/may/handlers/evaluate-sessions.ts` has **no** `META_AGENTS` exclusion. Verified:
- `grep META_AGENTS` returns nothing in both the handler and `src/evaluator.ts`.
- `evaluateTask()` defaults to `skipAgents = new Set()` (empty) — all agents are evaluated.
- Comment on lines 64-68 explicitly states: *"All agents are eligible for evaluation (P25: Everything Gets Reviewed). No agents are excluded by default."*
- Self-evaluation loops are prevented by the `findUnevaluatedChildren()` logic which only picks completed/failed sessions and checks against the evaluation registry.

## 3. Verification Summary
| Check | Result |
|-------|--------|
| `grep META_AGENTS evaluate-sessions.ts` | No matches |
| `grep META_AGENTS src/evaluator.ts` | No matches |
| `skipAgents` default | `new Set()` (empty) |
| `safe-edit` in Coder domain.md | Present (line 22, 100-line threshold) |
