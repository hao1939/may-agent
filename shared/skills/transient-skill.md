---
name: transient-skill
description: Generate structured ephemeral artifacts for complex tasks (Test-Time Training pattern).
version: 1.0.0
tools: [read, write]
---

# Skill: Transient Skill (Test-Time Training)

**Status**: Active
**Owner**: Bob (design), Tech-Lead (implementation)

## 1. Purpose

Generate a structured, ephemeral artifact (`workspace/strategy.md`) that serves as a **temporary skill** for the duration of a complex task. The agent reads this artifact as grounding context — reducing hallucination and improving context efficiency over raw conversation history.

This implements **Test-Time Training (TTT)**: ephemeral adaptation that lasts for the task, not permanent mutation. It is Evolution without Mutation (P53).

## 2. When to Use (Trigger Conditions)

Use this skill when the task meets **any** of these criteria:

- **Multi-step strategy**: Task requires 5+ coordinated steps with dependencies between them.
- **Deep codebase navigation**: Task touches 3+ files or requires understanding cross-file relationships.
- **Long-running context**: Task will consume >15 turns, risking context window saturation.
- **Novel problem**: No existing knowledge file or skill covers this domain.
- **Decision-heavy**: Task involves multiple branching choices where you need to track what was decided and why.

**Do NOT use** for:
- Simple read-verify-edit tasks (≤5 turns).
- Tasks where an existing knowledge file already covers the domain.
- Heartbeats, status checks, or other periodic tasks.

## 3. How to Execute

### Step 1: Generate the Strategy

Create `workspace/strategy.md` with this structure:

```markdown
# Strategy: [Task Title]

## Objective
[One sentence: what does "done" look like?]

## Key Findings
[Bulleted list of facts discovered during initial investigation.
Update this section as you learn more.]
- Finding 1: ...
- Finding 2: ...

## Decision Log
[Record every non-trivial choice and why. This prevents re-deriving decisions.]
| # | Decision | Rationale | Alternatives Rejected |
|---|----------|-----------|-----------------------|
| 1 | ...      | ...       | ...                   |

## Current Plan
[Ordered list of remaining steps. Check off completed items.
This is the "what to do next" reference.]
- [x] Step 1 (completed)
- [ ] Step 2 (next)
- [ ] Step 3
```

**Naming**: Use `workspace/strategy.md` for the primary artifact. For domain-specific maps, use descriptive names: `workspace/map.md`, `workspace/glossary.md`, `workspace/dependency-graph.md`.

### Step 2: Read Before Every Major Action

Before each significant step, re-read the strategy:

```
read("workspace/strategy.md")
```

This is the core mechanism — the strategy acts as a **compressed, structured context** that is cheaper to re-read (50 lines) than re-processing conversation history (500+ lines).

### Step 3: Update As You Go

After completing a step or making a discovery:
1. Check off completed steps in **Current Plan**.
2. Add new findings to **Key Findings**.
3. Record decisions in **Decision Log**.

Use surgical edits (sed or targeted write), not full-file rewrites.

### Step 4: Dispose or Consolidate

When the task is done:
- **Dispose**: The strategy file stays in `workspace/` and is naturally cleared. No action needed.
- **Consolidate**: If the strategy revealed a **reusable pattern** (solved the same problem type 3+ times), use the `consolidate-memory` skill to promote the insight to `knowledge/`.

## 4. Why This Works

- **Reduces Hallucination**: The agent grounds itself in self-generated, verified facts — not drifting conversation context.
- **Improves Context Efficiency**: Reading a 50-line strategy.md costs ~100 tokens. Re-processing 500 lines of conversation costs ~1000+ tokens and is less reliable.
- **Prevents Re-derivation**: The Decision Log stops the agent from reconsidering decisions it already made, which is a common failure in long sessions.
- **P53-Aligned**: The artifact is ephemeral — it adapts the agent's behavior for this task without mutating persistent identity files (SOUL.md, knowledge/).

## 5. Contrastive Examples

### GOOD: Strategy as Structured Reference

```markdown
# Strategy: Refactor session compaction

## Objective
Replace inline compaction in manager.ts with a standalone compactSession() function.

## Key Findings
- Compaction logic is at lines 1200-1280 of manager.ts
- It depends on summarizeMessages() from utils.ts
- There are 3 test files covering compaction behavior

## Decision Log
| # | Decision | Rationale | Alternatives Rejected |
|---|----------|-----------|-----------------------|
| 1 | Extract to src/compaction.ts | Keeps manager.ts focused | Inline refactor (too coupled) |
| 2 | Keep existing test files | They already cover the logic | New test file (redundant) |

## Current Plan
- [x] Read existing compaction logic
- [x] Create src/compaction.ts with extracted function
- [ ] Update manager.ts imports
- [ ] Run tests, verify no regressions
```

### BAD: Stream-of-Consciousness Log

```markdown
# Notes
- looked at manager.ts, it's big
- found some compaction stuff around line 1200 maybe
- tried to extract it but got an error
- going to try again
- ok I think it works now but not sure
- need to check tests later
```

The good example is **structured, scannable, and actionable**. The bad example is a raw log that provides no orientation and forces the agent to re-derive decisions.
