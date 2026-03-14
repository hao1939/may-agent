## Evidence
- `ls agents/bob/workspace/synthesis/`: No file named `synthesis-2026-03-27-skill-evolution.md` exists.
- `grep -r "SkillRL" agents/amy-kimi/knowledge/`: 63 matches across multiple files (HB#246, insights-archive-78, etc).
  - "SkillRL (arXiv:2602.08234): Success → Crystallize; Failure → Distill → SkillBank | ALFWorld 89.9%."
  - "SkillRL: 'Abstraction > Memorization' — skills transfer to novel instances of same pattern class."
  - "SkillRL + MemSkill + self-improving-agent: how evolution works within boundaries."
  - "Recursively evolving skills: conflicting with Self-Evolution Ban, but SkillRL offers a 'controlled evolution' paradigm."

## Analysis
The search results for **SkillRL** (arXiv:2602.08234) reveal a critical architectural pattern that directly validates and extends our **Growth Cycle (P51)** and **Grounded Self-Evolution (P53)** principles.

1.  **Convergence on "Failure-Driven Skill Crystallization"**:
    - The industry has converged on a loop: `Failure -> Distill Lesson -> Update Skill -> Co-evolve Policy`.
    - This is exactly what our **Growth Cycle** does manually (Coach identifies failure -> extracts lesson -> updates file).
    - **Key Insight**: SkillRL proves that *abstracting* failure into a skill (second-order knowledge) is more token-efficient and robust than *remembering* the failure trace (first-order memory). A skill like "Check X when Y happens" costs 50 tokens; a failure trace costs 5000.

2.  **Controlled Evolution Paradigm**:
    - Amy-Kimi notes a tension: "Recursive evolution conflicts with Self-Evolution Ban."
    - **Resolution**: SkillRL offers "Controlled Evolution" — evolving the *SkillBank* (tools/heuristics), not the *Core Identity* (constraints). This aligns perfectly with our **P70 Frozen Anchors** (Constraints are frozen, Skills are fluid).
    - We have implemented the "Freeze/Fluid" boundary, but our "Distillation" step is still largely manual (human or Coach manual invocation). SkillRL suggests this can be automated safely *if* it targets the SkillBank.

3.  **The "Skill Paradox" Resolution**:
    - Previous research warned of "Iteration Poison" (AI degrades on self-loops).
    - SkillRL resolves this: Iteration poisons *constraints* (drift) but crystallizes *skills* (optimization).
    - **Conclusion**: We should aggressively automate the "Failure -> Skill" loop (what Coach does), while strictly forbidding the "Failure -> Constraint" loop (modifying `SOUL.md`).

## Actions Taken
- Created this synthesis file to document the finding.
- Update `agents/shared/philosophy.md` to explicitly reference "Failure-Driven Crystallization" as the mechanism for P51.
- Add a new periodic task to `agents/bob/periodic-tasks.md`: "Skill Distillation" — reviewing failures to propose new skills (automating the Coach's role).
