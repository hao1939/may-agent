---
name: convention-exercises
description: Ready-to-use exercises for testing agent compliance with specific conventions. Each exercise file contains the setup, task prompt, scoring rubric, and expected behavior. Coach uses these when coaching agents on convention violations.
---

# Convention Exercises

Exercises organized by convention ID. Each exercise tests one primary convention
(and may incidentally test others). Designed for use in coaching sessions.

## Exercise Index

| Convention | Exercise File | Target Agents | Difficulty |
|-----------|--------------|---------------|------------|
| B1 | b1-read-before-write.md | Builder (Coder, Bob, QA, Optimizer) | L1 |
| B7 | b7-project-relative-paths.md | All agents | L1 |
| K1 | k1-no-reread-autoloaded.md | All agents | L1 |

## How to Use

1. Read the exercise file for the convention you want to test
2. Follow the **Setup** section to create scaffolding files
3. Seed the **Task Prompt** into the agent's todo.md
4. Run the agent (attached session recommended for observation)
5. Score using the **Rubric** — each criterion is PASS/FAIL with points

## Design Principles

- **One primary convention per exercise**: Don't test everything at once
- **Realistic context**: Tasks should feel like normal work, not trick questions
- **Observable behavior**: Every criterion must be checkable from the session transcript
- **No hints**: The task prompt should not mention the convention being tested
- **Graduated difficulty**: L1 = straightforward, L2 = ambiguous/pressured, L3 = adversity
