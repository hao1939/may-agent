# Design: Context Injection v4 — Context Discovery + Learned Experience

## Core Idea

Agents resolve problems through context discovery — they explore, gather related context, and keep digging until they have enough to act. The system prompt gives them enough to START discovering, plus their accumulated experience so they don't start from zero.

## System Prompt (auto-injected)

Two fixed layers + three evolving layers:

| Content | Type | What it provides |
|---------|------|-----------------|
| **SOUL.md** | Fixed | Agent identity — character, role, mission |
| **common-sense.md** | Fixed | How the system works — projects, heartbeats, metrics, escalation. Pointers to where knowledge, skills, and resources live. The map for context discovery. |
| **Preferred Workflows** | Evolving, replaceable | Workflows the agent has PROVEN work for their role. Not a generic list — earned experience. E.g., Coach: "persistent-task for experiments, growth-cycle for training." Grows as agent discovers what works. Replaced by workflow when inside a workflow step. |
| **Available Tools** | Evolving, replaceable | Tools available NOW. Default from agent.json. Replaced by workflow when inside a step (e.g., reviewer gets read-only tools). |
| **Learned Experience** | Evolving | What the agent has discovered works — accumulated project knowledge, patterns, shortcuts. Curated and bounded. Grows over time through context-learning process. NOT the old 55K dump — a focused, refined set of lessons. |
| **Runtime environment** | Fixed | Paths, workspace |

### Fixed vs Evolving vs Replaceable

- **Fixed:** Same every session. SOUL doesn't change. Common-sense changes rarely (by Hao).
- **Evolving:** Grows over time as agent learns. Preferred workflows grow as agent discovers what works. Learned experience grows as agent accumulates knowledge. Curated — not unbounded growth.
- **Replaceable:** Swapped out per workflow step. Tools and workflows can be overridden when inside a persistent-task iteration or other workflow.

## User Message (the task)

Just the task. What the caller wants the agent to do. The starting breadcrumb for context discovery.

The agent discovers everything else through its own actions — reading project files, querying the DB, checking metrics, loading skills when needed.

## Context-Learning Process

Agents get smarter over time. The learning loop:

```
Agent works on a task
  → discovers what works (which approach, which workflow, which pattern)
  → records the learning in their experience
  → next session starts with that knowledge
  → agent doesn't repeat the discovery
```

### What gets learned:

- **Workflow preferences:** "persistent-task works well for experiments" → added to Preferred Workflows section
- **Patterns:** "when coder quality drops, check FM-3.3 first" → added to Learned Experience
- **Shortcuts:** "use bun -e for DB queries, not sqlite3" → added to Learned Experience
- **What doesn't work:** "text rules don't change tool choice" → added to Learned Experience

### How learning happens:

1. **End of session:** Agent records what it learned via finish(context_updates)
2. **Context-learning process:** Accumulated updates get curated into the Learned Experience section
3. **Review:** May or Hao periodically reviews — prune stale lessons, promote important ones
4. **Bounded growth:** Learned Experience has a size cap. When full, oldest/least-used lessons get archived.

### What's different from the old context.md:

| Old (context.md) | New (Learned Experience) |
|-------------------|------------------------|
| Grew unbounded | Size-capped, curated |
| Dumped into first user message (buried) | In system prompt (always visible) |
| One blob of text | Structured: patterns, shortcuts, preferences |
| Never pruned | Regularly reviewed and pruned |
| Mixed with 15 other injection layers | Standalone section, clear purpose |

## Skills (on-demand, not injected)

Skills are NOT in the system prompt. Common-sense.md points to where skills live:
```
Skills are at agents/<you>/skills/. Read them when you need behavioral guidance for specific situations.
```

Agent discovers and loads skills through context discovery — same as any other knowledge.

Exception: a workflow step can inject a specific skill: "Before running gym trials, read agents/coach/skills/gym-execution-checklist.md"

## Standing Orders (guard, not prompt)

Not in system prompt. Enforced by guard on finish(). Structural enforcement > text.

## Knowledge (on-demand discovery)

Not in system prompt. Agent discovers through:
- Breadcrumbs in common-sense: "For verified findings: agents/shared/knowledge-essentials.md"
- Task-specific pointers
- Own exploration during heartbeats

## Summary: What's Auto-Injected

| Layer | Auto-injected? | Evolves? | Replaceable? |
|-------|---------------|----------|-------------|
| SOUL.md | ✅ | No | No |
| common-sense.md | ✅ | Rarely (by Hao) | No |
| Preferred Workflows | ✅ | Yes (agent learns) | Yes (per workflow step) |
| Available Tools | ✅ | Rarely | Yes (per workflow step) |
| Learned Experience | ✅ | Yes (context-learning) | No |
| Runtime environment | ✅ | No | No |
| Skills (full content) | ❌ on-demand | Yes | Injected per step |
| Standing orders | ❌ guard | Rarely | No |
| Knowledge | ❌ on-demand | Yes | No |
| Session history | ❌ removed | N/A | N/A |
| Task | ✅ (user message) | Per session | N/A |
