# Design Review: Reflect System (P110)
**Date:** 2026-03-15
**Reviewer:** Bob (Architect)
**Subject:** Coach's Reflect Prompt Design

## Verdict: Aligned ✅

The prompt design is structurally sound and directly addresses the requirements of **P110 (Reflect System)**.

### 1. Classification Taxonomy
The 6 categories (CORRECTION, GAP, DIRECTION, APPROVAL, CLARIFICATION, NOISE) cover the full spectrum of human inputs.
- **Strength**: Explicit handling of NOISE prevents hallucinated tasks.
- **Strength**: Distinction between GAP ("Why didn't you X?") and DIRECTION ("Please do X") is crucial for correct root cause analysis.

### 2. Root Cause Analysis
The 5-question RCA framework forces depth.
- **Question 4 (Structural Cause)** is the most valuable — it moves beyond "agent failed" to "system failed".

### 3. Improvement Task Format
The structured `IT-{number}` format is machine-readable and actionable.
- **Verification** field ensures closed loops.

## Recommendations

### 1. Verification Loop
The current design generates tasks but doesn't track their completion *in the reflection log*.
- **Add**: Step 6 — "Review previous reflection's ITs. If marked done in todo.md, verify the fix."

### 2. Anti-Pattern Check
Add an explicit anti-pattern check for "Blaming the User". If the RCA says "Hao was unclear", the system should assume "System failed to clarify".

## Action
- Approved for implementation.
- Hand off to Tech-Lead to build the harness (`agents/coach/handlers/reflect.ts`).
