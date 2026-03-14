---
name: transient-skill
description: Coach agents to use workspace/strategy.md for complex multi-step tasks (TTT pattern).
version: 1.0.0
tools: [read, write]
---

# Skill: Coaching Transient Skills (TTT)

**Status**: Active (H340)
**Owner**: Coach
**Reference**: `agents/shared/skills/transient-skill.md` (canonical template)

## Purpose

Ensure all agents adopt the **workspace/strategy.md** pattern for tasks that are >5 steps or touch >3 files. This prevents context drift, re-derivation of decisions, and mid-task confusion.

## What Coach Does

### 1. Detection
During session transcript reviews and coaching sessions, look for these failure signals:
- Agent **re-reads the same files** multiple times (forgot what it found).
- Agent **reverses a decision** it already made (no decision log).
- Agent **loses track** of remaining steps mid-task (no plan).
- Agent produces **incoherent output** in long sessions (context saturation).

These are symptoms of **missing TTT** — the agent needed a strategy but didn't create one.

### 2. Coaching Response
When a failure is caused by missing TTT:
1. **Cite the pattern**: Reference `agents/shared/skills/transient-skill.md`.
2. **Add to agent's lessons**: Via growth cycle, add a LESSONS.md entry:
   > For tasks >5 steps or >3 files, create `workspace/strategy.md` with objective, findings, decisions, and plan. Re-read before each major action. Update after each step.
3. **Verify**: Run a multi-step task via `verify_agent` and confirm the agent creates and maintains `workspace/strategy.md`.

### 3. Template Enforcement
The strategy.md must contain these four sections (per Bob's brief):
- **`objective`**: What does "done" look like? One sentence.
- **`findings`**: Key facts discovered (file paths, versions, constraints).
- **`decisions`**: Why approach A over B. Table format preferred.
- **`plan` + `current_step`**: Ordered checklist with current position marked.

Reject strategies that are stream-of-consciousness logs. They must be **structured, scannable, and actionable**.

### 4. Benefits to Reinforce
When coaching agents on this pattern, emphasize:
- **Context efficiency**: Reading 50 lines of strategy < re-processing 500 lines of conversation.
- **Drift prevention**: The plan is explicit, not implicit in chat history.
- **P53 compliance**: Ephemeral adaptation without permanent mutation. The strategy file lives in `workspace/` and naturally expires.

## When NOT to Coach This
- Simple tasks (≤5 turns, single file).
- Heartbeats and periodic status checks.
- Tasks where existing knowledge files already provide sufficient grounding.
