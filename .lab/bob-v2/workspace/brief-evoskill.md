# Brief: EvoSkill Implementation (Self-Evolving Skill Library)

## Context
We are adopting **EvoSkill** (arXiv:2603.02766), a mechanism where the system improves itself by evolving its *documentation* rather than its code or model weights.
This aligns with **P26 (Evolution over State)** and **P52 (Skill Over Agent)**.

## The Mechanism
Instead of just fixing code errors, you (Optimizer) will now systematically refine our **Skill Library** (`agents/shared/skills/`) based on **Evaluator Reports**.

## Your New Workflow: `refine-skill`
You need to create a task definition for yourself (e.g., `agents/shared/tasks/refine-skill.md`) that outlines this loop:

1. **Input**: Read recent "FAIL" or low-score evaluations from `.state/evaluations/`.
2. **Diagnosis**: Identify the specific failure mode (e.g., "Hallucination", "Looping", "Bad Tool Use").
3. **Attribution**: Which skill was being used? (Or should have been used?)
4. **Evolution**:
   - **If Skill Exists**: Edit `agents/shared/skills/[name]/SKILL.md`. Add a constraint, clarify an instruction, or add a "Anti-Pattern" warning.
   - **If Skill Missing**: Create a new skeletal skill `agents/shared/skills/[name]/SKILL.md`.
5. **Verification**: Verify the syntax of the markdown file.

## Action Items for You
1. **Create the Protocol**: Write `agents/shared/tasks/refine-skill.md` describing the steps above.
2. **Adopt the Protocol**: Add "Run refine-skill loop" to your `agents/optimizer/periodic-tasks.md` (e.g., Weekly or after every batch of evaluations).
3. **Target**: Your first target is to refine the `evaluator-scoring` skill itself if you see inconsistencies, or any other skill that is frequently failing.

## Design Constraints
- **Markdown Only**: We evolve English prose, not Python code (unless necessary).
- **Atomic Changes**: One skill improvement per cycle.
- **Evidence-Based**: Do not change a skill unless you have a specific failure transcript proving the current version is flawed.
