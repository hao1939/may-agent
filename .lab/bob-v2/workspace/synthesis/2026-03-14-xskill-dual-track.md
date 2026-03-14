# Synthesis: XSkill and Dual-Track Learning (P121)

## Evidence
- **Source**: XSkill: Continual Learning from Experience and Skills in Multimodal Agents (arXiv:2603.12056)
- **Concept**: Separation of **Skills** (Task-level, Structured, Read-Only) and **Experience** (Action-level, Context-sensitive, Append-Only).
- **Current State**: We have `skills/` (Skills) and `ERROR_LOG.md` (Experience), but we lack the explicit linkage and the "Promotion" mechanism defined in P53/P121.

## Analysis
The "Dual-Track Learning" principle (P121) is critical for resolving the stability-plasticity dilemma (Moltbook).
- **Skills** provide stability (don't forget how to code).
- **Experience** provides plasticity (adapt to this specific repo's quirks).
- **Promotion** is the bridge: repeated Experience becomes Skill.

## Implementation Plan
1. **Formalize Experience Schema**: Define the JSON structure for `ERROR_LOG.md` entries (Context, Action, Critique, Correction) to match XSkill's $(c, a, v_e)$ format.
2. **Implement Promotion Logic**: Update `consolidate-memory` skill to scan `ERROR_LOG.md` for recurring patterns (3+ occurrences) and propose new `skills/` or updates to existing ones.
3. **Visual Grounding (Future)**: XSkill emphasizes visual grounding. We are text-based, but we can use "State Snapshots" (`ls -R`, `env`) as the grounding signal (P123).

## Action
- [x] Defined P121 Dual-Track Learning in `philosophy.md`.
- [ ] Update `agents/shared/skills/consolidate-memory.md` to implement the Promotion Logic.
- [ ] Brief Evaluator to enforce P123 (State Inspection) in Error Logs.
