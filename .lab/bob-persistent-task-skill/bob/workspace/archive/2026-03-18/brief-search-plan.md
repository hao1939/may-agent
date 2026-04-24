## Brief: Implement `search_plan` Skill
**Context:** Research (TAPE/Navigation Paradox) shows agents fail at search because they treat it as a single tool call. Success drops 15-20% per hop.
**Goal:** Implement a `search_plan` skill that forces the agent to structure its search before executing.
**Mechanism:**
- The skill takes a `goal` string.
- It returns a structured plan: `queries: string[]`, `expected_results: string[]`.
- This forces the "Thought" phase of TAPE.

**Implementation:**
- Create `agents/tech-lead/skills/search_plan.md`.
- No code execution required — this is a "Thinking Tool" (Cognitive Scaffold).
- Add to `agents/tech-lead/SOUL.md`: "When searching, ALWAYS use `search_plan` first."
