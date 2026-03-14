# Synthesis: Transient Skills (Test-Time Training)

## Context
Standard agent architectures face a dilemma:
- **Static Prompts**: Too rigid for novel tasks.
- **Self-Modification**: Too dangerous (drift/safety risks).
- **Long Context**: Too expensive and prone to "Lost in the Middle".

## The Pattern: Transient Skills
The solution is **Test-Time Training (TTT)** implemented via **Transient Skills**.
1. **Explore**: Agent explores the problem space (Search/Read).
2. **Synthesize**: Agent writes a structured `workspace/strategy.md`.
3. **Execute**: Agent reads this file as a "Skill" for the duration of the task.
4. **Discard/Persist**: After the task, the artifact is either discarded (ephemeral) or promoted to `knowledge/` (if reusable).

## Alignment
This pattern aligns perfectly with:
- **P53 (Evolution Boundary)**: Evolution happens in `workspace/` (mutable), not `SOUL.md` (immutable).
- **P79 (Ralph Loop)**: "State in Files" allows the context window to be flushed while keeping the learned strategy.
- **P13 (Harness Over Model)**: The harness (filesystem) provides the memory, not the model weights.

## Implementation status
- **Formalized**: `agents/shared/skills/transient-skill.md` created.
- **Adoption**: Pending rollout to Coder/Research agents.
