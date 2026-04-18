# Design: Mechanism C — Conversation State

**Status**: Draft for Review
**Date**: 2026-03-15
**Author**: Bob
**Context**: P146 Passive Context Primacy

## 1. Analysis & Decisions

### Scope: May-Only (The Interface Layer)
- **Decision**: `conversation-state.md` is exclusively for **May**.
- **Reasoning**: May is the interface layer. Other agents (Coder, Scout) receive context via delegation briefs. Broadcasting this file to all agents violates **P111 Context Pollution** and increases token cost (N agents x M tokens). May filters and forwards relevant context.

### Content: The "RAM" of the Relationship
- **Structure**:
  1.  **The Stack**: What are we actually trying to do? (Nested goals).
  2.  **The Wait**: What are we waiting for? (Human input, external events).
  3.  **The Vibe**: Human's current mode (e.g., "Debug Mode - fast & terse" vs "Explore Mode - chatty").
  4.  **The Facts**: Recent immutable decisions (e.g., "Use SQLite, not Postgres").
- **Anti-Pattern**: Do NOT duplicate `todo.md`. Todo is for *tasks*; State is for *context*.

### Update Mechanism: Dual-Trigger
- **Primary**: **Post-Session Hook**. The `extract_directives` skill (Mechanism A) should have a sibling output: updating `conversation-state.md`.
- **Secondary**: **Explicit Skill**. May can call `update_state` during a long session if the focus shifts dramatically.
- **Principle**: **P114 Experience Replay**. The state file IS the "experience" of the conversation, crystallized.

### Staleness: Rolling Window + Explicit Clear
- **Policy**:
  - **Focus/Wait**: Overwritten on every update.
  - **Decisions**: Rolling window (Last 5).
  - **History**: Last 3 session summaries.
- **Decay**: If `Current Focus` changes, `The Wait` must be cleared.

### Integration: The Context Hierarchy
- **`directives.md`** = **ROM** (Permanent Constitution). "Always use TypeScript."
- **`conversation-state.md`** = **RAM** (Transient Context). "Fix the P82 bug right now."
- **`todo.md`** = **Disk** (Work Queue). "Task #123."

## 2. Artifact Template (`agents/may/conversation-state.md`)

```markdown
# Conversation State
*Auto-updated. Do not edit manually unless correcting errors.*

## 🎯 Current Focus (The Stack)
- **Primary**: [High-level goal, e.g., "Fix P82 Handshake"]
- **Immediate**: [Current step, e.g., "Debugging sign_tool in manager.ts"]
- **Context**: [Why we are doing this, e.g., "Silent failures in production"]

## ⏳ Pending Human Input
- [Question or blocker waiting for Hao, e.g., "Shall we revert commit X?"]
- *Status*: [Blocked / Asynchronous]

## 🌡️ Interaction Mode
- **Tone**: [e.g., Concise, Technical, No-Fluff]
- **Constraint**: [e.g., "Stop proposing new features, focus on fix"]

## 📝 Recent Decisions (Last 5)
- [YYYY-MM-DD]: [Decision, e.g., "Reverted to v1.0 auth protocol"]
- [YYYY-MM-DD]: [Decision, e.g., "Abandoned feature Y"]

## 📚 Session Memory (Last 3)
- **[YYYY-MM-DD HH:MM]**: [1-line summary]
- **[YYYY-MM-DD HH:MM]**: [1-line summary]
- **[YYYY-MM-DD HH:MM]**: [1-line summary]
```

## 3. Implementation Plan
1.  **Tech-Lead**: Create the file `agents/may/conversation-state.md` with the template.
2.  **Coach**: Update `extract_directives` skill to *also* extract state into this format.
3.  **May**: Add `conversation-state.md` to `context_files` in `agent.json`.

## 4. Principles Applied
- **P146 Passive Context Primacy**: Put state in the file, don't make May query for it.
- **P111 Context Pollution**: Keep it scoped to May.
- **P42 Minimalism**: Only 5 recent decisions, 3 sessions.
