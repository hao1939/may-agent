# Design: Structured Failure Analysis (MAST)

## Status: Draft
**Date**: 2026-03-09

## Problem
Our failure analysis ("X broke, fix it") is descriptive but not rigorous. It lacks taxonomy. Without classification, we cannot measure progress against *types* of failure (e.g., "Hallucination" vs "Logic Error" vs "Context Lost").

## The OpenClaw Pattern (Reference)
OC Coach uses the **MAST** (Model-Agent-System-Tool) failure classification system (FM-1.x through FM-2.x).

### MAST Failure Codes (Proposed)

| Code | Category | Definition | Example |
|------|----------|------------|---------|
| **FM-1.1** | **System** | Timeout / Crash | Process killed, OOM |
| **FM-1.2** | **System** | Tool Error | `exec` failed, file locked |
| **FM-2.1** | **Agent** | Context Overflow | Tried to read 2MB file |
| **FM-2.2** | **Agent** | Hallucination | Called fake tool, cited fake file |
| **FM-2.3** | **Agent** | Logic Error | Correct plan, wrong execution |
| **FM-2.4** | **Agent** | Scope Violation | Coder tried to run `npm install` |
| **FM-3.1** | **Model** | Instruction Ignore | Explicit "Do Not" ignored |
| **FM-3.2** | **Model** | Loop | Repeated same error >2 times |

## Implementation Plan

### 1. Update Evaluator Rubric
Modify `agents/evaluator/knowledge/criteria.md` to include a required `FailureType` field in the output JSON.
- If PASS: `FailureType: null`
- If FAIL: `FailureType: "FM-2.2"` (enum)

### 2. Update Coach Reporting
Modify `agents/coach/handlers/report-failure.ts` (if exists) or the coach's system prompt to categorize failures using MAST codes.

### 3. Analytics (Optional)
Once we have codes, we can chart failure trends. "Logic Errors down 20%, Hallucinations up 10%."

## Recommendation
Adopting a taxonomy is low-cost and high-value for the meta-loop. It turns anecdotes into data. Start with the evaluator.
