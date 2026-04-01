# Pattern: Transient Skill (Test-Time Training)

**Status:** Imported (DeepMind/Stanford/UNC)
**Domain:** Knowledge Management / Execution
**Related Principles:** P53 (Evolution Boundary), P11 (File System as Memory)

## The Context
Complex tasks often require strategies that are too specific to be useful as general skills.
- **Example**: "Refactor the legacy `auth.ts` module while preserving backward compatibility with `v1` tokens."
- **Problem**: This is a one-off task. Writing a permanent skill for it pollutes `skills/`. Relying on conversation history risks "Lost in the Middle" errors.

## The Pattern
Create a **Transient Skill** — a temporary strategy document that acts as a "soft weight update" for the duration of the task.

1.  **Generate**: At the start of a complex task, write `workspace/strategy.md`.
2.  **Structure**:
    - **Objective**: What is the definition of done?
    - **Key Findings**: What did we learn from initial exploration?
    - **Decision Log**: What choices have we made and why?
    - **Current Plan**: The checklist of next steps.
3.  **Use**: Before every major action, re-read `workspace/strategy.md`. Update it as you learn.
4.  **Discard/Crystallize**:
    - **Default**: Delete it when the task is done.
    - **High Value**: If the strategy proved generalizable, distill it into a permanent skill in `skills/`.

## Why It Works
- **Test-Time Training (TTT)**: This implements TTT by updating the agent's *context* (the strategy file) rather than its weights.
- **External Memory**: It offloads the "state of the plan" from the LLM's context window to the file system.
- **Drift Prevention**: The strategy file acts as an anchor, preventing the agent from drifting away from the original goal.

## When to Use
- **Multi-step tasks** (>5 steps).
- **Cross-file changes** (>3 files).
- **Ambiguous tasks** requiring exploration and decision-making.

## Template (`workspace/strategy.md`)
```markdown
# Strategy: [Task Name]

## Objective
- [ ] Goal 1
- [ ] Goal 2

## Key Findings
- [Discovery 1]
- [Discovery 2]

## Decision Log
- [YYYY-MM-DD] Decided to use X because Y.

## Current Plan
1. [ ] Step 1
2. [ ] Step 2
```
