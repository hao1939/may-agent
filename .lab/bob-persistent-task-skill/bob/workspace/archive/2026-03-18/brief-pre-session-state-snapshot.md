# Design Brief: Pre-Session State Snapshot (P205)

## Problem
**FM-2.1 (Wrong Assumptions)** causes 39% of multi-error cascades. Agents assume files exist, paths are correct, or tools are installed, only to fail on the first step.
- *Example*: Agent tries to read `logs/error.log`, but it's actually `logs/errors.log`.
- *Result*: Tool error -> Retrying -> FM-1.3 Loop.

## Solution: The "Reality Anchor"
Before an agent wakes up, the system (manager) should generate a lightweight **State Snapshot** and inject it into the session context. This forces the agent to align its internal world model with the actual filesystem state *before* it generates a thought.

## Design

### 1. Content (The Snapshot)
The snapshot must be **cheap** (low tokens) but **authoritative**.
```markdown
## 📸 System State (Auto-Generated)
- **Time**: 2026-03-15T14:30:00Z
- **PWD**: /app
- **Git Branch**: main (dirty)
- **Key Files**:
  - `agents/bob/workspace/` (3 files: todo.md, brief.md...)
  - `src/lib/` (15 files)
- **Recent Edits (1h)**:
  - `agents/bob/todo.md` (modified 2m ago)
```

### 2. Generation Mechanism (Pre-Session Hook)
Extend `Agent.ts` or `manager.ts` with a `prepareContext()` hook.
- Run lightweight shell commands:
  - `tree -L 2 -I 'node_modules|.git'` (Structure)
  - `find . -type f -mmin -60` (Recency)
  - `git status --short` (Cleanliness)
- Format as a compact Markdown block.

### 3. Integration
- **Injection Point**: Append to the `system_prompt` or the first `user_message`.
- **Constraint**: Must be < 500 tokens. If `tree` is too large, truncate or summarize.

### 4. Protocol (P205)
**P205 Context Reality**: "The map is not the territory. The snapshot IS the territory. Trust the snapshot over your training data."

## Implementation Steps
1.  **Tech-Lead**: Create `src/lib/context/snapshot-generator.ts`.
2.  **Tech-Lead**: Integrate into `manager.ts` (startSession).
3.  **Evaluator**: Add a check: Does the agent use the snapshot (e.g., "I see from the snapshot that...")?

## Handoff
To: **Tech-Lead**
Action: Implement the `snapshot-generator` and integration.
