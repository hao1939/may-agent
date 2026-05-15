# Finding: Background Skills ≠ Prompt-Injected Information

**Date**: 2026-04-23
**Source**: Post-deployment audit of `diagnosis-before-action` skill

## Key Data

| Condition | Scenario | Pass Rate |
|-----------|----------|-----------|
| Baseline (no skill) | misleading-test-fix | 1/65 (1.5%) |
| Info in task prompt (f1) | misleading-test-fix-f1 | 29/29 (100%) |
| Skill deployed to coder | misleading-test-fix | Still 1/65 at last check (Apr 17) |

## Interpretation

The `diagnosis-before-action` skill was promoted based on EXP-164 where information was injected directly into the task-level prompt (the f1 variant). When deployed as a **background skill** (file in skills/ directory), it shows **no measurable improvement** on the same scenario.

This has major implications for EXP-203 (symptom-based relational bug recognition). The same gap may apply: EXP-168 showed 75% with symptoms in the task prompt, but a background skill may have 0% effect.

## Why This Happens

Background skills sit in context alongside many other files. The agent must:
1. Notice the skill is relevant to the current situation
2. Retrieve the right guidance from it
3. Override its default behavior

With prompt-injected info, steps 1-2 are done for the agent. The skill is already activated.

## Implications

1. **Skill deployment ≠ behavior change** — we need to verify skills post-deployment in the SAME scenario, not just the assisted variant
2. **EXP-203 may need redesign** — if background skills can't trigger recognition, we need a different delivery mechanism (e.g., workflow gate that forces reading the skill, or context.md integration)
3. **All promoted skills need post-deployment verification** — this is likely not unique to diagnosis-before-action

## Action Items

- [ ] Run misleading-test-fix with coder (current production config including deployed skill) N=10 to confirm
- [ ] If confirmed: investigate skill activation mechanisms (when does the agent actually read skills/)
- [ ] Update EXP-203 design with a "skill activation" arm that forces skill reading
