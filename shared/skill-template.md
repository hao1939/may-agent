# Skill Template

This template defines the standard structure for all skills. Adhering to this format ensures skills are **token-efficient** (second-order knowledge) and **robust** (failure-aware).

## Structure
Every skill file in `agents/*/skills/*.md` must follow this structure:

```markdown
# [Skill Name]

## 1. Purpose
One sentence describing what this skill achieves.

## 2. When to Use
Bulleted list of specific triggers or conditions.
- Condition A
- Condition B

## 3. How to Execute
Step-by-step instructions. Focus on *mechanism*, not just steps.
1. Step 1...
2. Step 2...

## 4. Failure Modes (Critical)
What commonly goes wrong? How do you recover?
- **Failure**: [Description]
  - **Fix**: [Recovery Action]
- **Failure**: [Description]
  - **Fix**: [Recovery Action]

## 5. Contrastive Examples (Optional but Recommended)
Show, don't just tell.
- **GOOD**: [Example of correct usage]
- **BAD**: [Example of incorrect usage]
```

## Principles
- **Abstraction > Memorization**: Don't record a specific failure trace. Extract the *general rule* that prevents it.
- **Failure-First**: The "Failure Modes" section is the most valuable part. It encodes hard-won experience.
- **Constraint-Aware**: Skills must not violate `SOUL.md` or `philosophy.md`.
- **Atomic**: One skill, one file. Keep it focused.
