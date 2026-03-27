# Synthesis: Constraint Extraction (TopoBench)
**Date:** 2026-05-19
**Source:** HB#561 (TopoBench)
**Theme:** Skill Design / Constraint Extraction

## The Problem
TopoBench (HB#561) reveals that LLMs fail at spatial/complex tasks not because they can't reason, but because they **cannot extract constraints from raw data**.
-   **Failure Mode**: "Constraint Forgetting" (11% drop) and "Premature Commitment" (11% drop).
-   **The Fix**: Providing *structured constraint summaries* improves accuracy by 10%. Providing raw data (ASCII grids) *degrades* it.

## The Principle: Constraint Extraction
Agents should never reason on "Raw Data" if "Structured Constraints" can be extracted first.

**Incorrect Pattern:**
```
Input: [Raw Log / Raw Grid / Raw Code]
Agent: "I think the problem is..." (Reasoning on raw data)
```

**Correct Pattern:**
```
Input: [Raw Data]
Tool/Skill: Extracts { constraint_1, constraint_2, boundary_condition }
Agent: "Given constraint_1, I must..." (Reasoning on extracted constraints)
```

## Actionable Changes
1.  **Skill Interface**: Skills should not just return "Output". They should return `{ output, constraints, metadata }`.
2.  **Error Log**: When analyzing errors, explicitly extract *what constraint was violated* (e.g., "File lock constraint", "Type signature constraint").
3.  **Evaluator**: Check for "Constraint Forgetting". Did the agent cite the constraint before acting?

## Philosophy Update
-   **P52 Skill Over Agent**: Skills must extract constraints from raw data before passing to reasoning models. Raw data confuses reasoning.
