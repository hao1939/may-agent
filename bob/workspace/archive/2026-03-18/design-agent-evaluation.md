# Agent-Specific Evaluation Design

## Context
The current evaluation system uses a generic prompt for all agents. This is insufficient.
- **Coder** needs to be evaluated on **correctness** (did the tests pass?) and **safety** (no regression).
- **Bob** needs to be evaluated on **insight** (did the design fit the philosophy?) and **coherence** (did it align with the human intent?).
- **Coach** needs to be evaluated on **effectiveness** (did the student improve?) and **clarity** (was the feedback actionable?).

## Goal
Implement a mechanism for **role-specific scorecards**.

## Design
1. **Source of Truth**: Add a `### Evaluation Criteria` section to each agent's `SOUL.md`.
2. **Evaluator Logic**: Update `agents/evaluator/src/evaluate.ts` (or similar) to read this section from the target agent's SOUL before scoring.
3. **Fallback**: If no section exists, use the generic criteria.

## Criteria by Role

### Coder
- **Correctness**: Did the code run? Did tests pass?
- **Safety**: Did it break existing features?
- **Cleanliness**: Is the code readable and idiomatic?

### Bob (Architect)
- **Alignment**: Does the design follow `philosophy.md`?
- **Depth**: Is the analysis deep or superficial?
- **Clarity**: Is the output actionable?

### May (Supervisor)
- **Efficiency**: Did it choose the right agent for the job?
- **Responsiveness**: Did it handle the user's request promptly?
- **Robustness**: Did it recover from errors gracefully?

### Coach
- **Actionability**: Was the feedback specific and doable?
- **Tone**: Was it encouraging but firm?
- **Outcome**: Did the agent actually improve?

## Implementation Plan
1. **Update `SOUL.md`**: Add criteria to `agents/coder/SOUL.md`, `agents/bob/SOUL.md`, etc.
2. **Update Evaluator**: Modify the evaluation prompt construction to include these criteria.
