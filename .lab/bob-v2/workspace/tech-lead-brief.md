# Brief for Tech-Lead: Resource-Awareness Implementation Plan

**Goal**: Implement "Resource Feedback" (Cost Signal + Session Budget) in `manager.ts` without breaking existing tools or tests.

**Context**:
- **Agent-RRM (arXiv:2603.08945)**: Agents optimize for tasks while ignoring cost. Explicit feedback (tokens, time) is required for efficiency.
- **P113 Resource Feedback**: We need to inject cost metadata into tool outputs.
- **P114 Experience Replay**: Agents need to check for past errors.

**Plan**:
The Optimizer has analyzed feasibility and drafted a detailed plan in `agents/bob/workspace/optimizer-plan.md`.

## Phase 1: Philosophy + Skill (No Code) — *In Progress*
- May is updating `philosophy.md`.
- You need to create `agents/shared/skills/experience-replay.md`.

## Phase 2: Cost Signal (Small Code Change) — *To Do*
- Add `Date.now()` timing around `tool.execute()` in `wrapToolsWithReceipts()`.
- Compute output byte count.
- If time > 2s or bytes > 10KB, append `<system_note>[COST: Xs, YKB]</system_note>` block after `</tool_output>`.
- **Constraint**: Must not break JSON parsing for tools that return JSON. The note is *outside* the tool output block.

## Phase 3: Session Budget Warning (Small Code Change) — *To Do*
- Add `turnBudget?: number` to `SubagentDefinition` in `types.ts`.
- Add `turnBudget: number` to `ActiveSession` interface.
- In `wrapToolsWithReceipts()`, check `turnCount >= turnBudget * 0.8`.
- If true, append warning `<system_note>[WARNING: Turn 33/40 — session budget 82% consumed...]</system_note>`.

**Reference**:
- `agents/bob/workspace/optimizer-plan.md` (Detailed feasibility analysis)
- `agents/bob/workspace/optimizer-brief.md` (Original brief)

**Action**:
Please review the plan and implement Phase 2 and Phase 3.
