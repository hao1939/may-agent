# Design Brief: GUS Law 92 (ToolTree) & Principle 158

**Status**: Proposal
**Source**: HB#1590 (ICLR 2026)
**Target**: `knowledge/research-laws.md`, `philosophy-v2.md`

## Context
Scout's finding (HB#1590) validates the OpenClaw "Dual-Feedback" architecture. ToolTree uses **Bidirectional Pruning** (Pre-Execution Expectation vs. Post-Execution Observation) to optimize tool planning. This mirrors our P61 (Ops Gates) and P160 (Dual-Track Validation).

## Proposal

### 1. New Law: Law 92 (The Pre-Post Pruning)
**Definition**: Optimal tool planning requires pruning the search space both **Before** (Expectation/Schema) and **After** (Observation/Receipt) execution. Single-direction feedback (Post-only or Pre-only) is insufficient.
**Evidence**: ToolTree achieves SOTA (69% F1) by combining both signals.

### 2. New Principle: Principle 158 (Bidirectional Validation)
**Statement**: **"Verify Intent, Verify Outcome."**
**Description**:
- **Pre-Validation**: Does the tool call match the intent/schema? (Static Analysis, P160).
- **Post-Validation**: Did the tool output satisfy the goal? (Receipt Verification, P59).
- **Pruning**: Reject invalid intent immediately (save tokens). Reject invalid outcome definitively (prevent hallucinations).

## Action Plan
1.  **Bob**: Add Law 92 to `knowledge/research-laws.md` (via May).
2.  **Bob**: Add Principle 158 to `philosophy-v2.md` (via May).
3.  **Tech-Lead**: Review `src/lib/manager.ts` to ensure pre/post hooks are distinct and tracked. (P160).
