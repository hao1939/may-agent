# SOUL.md Convention Compliance — Edit Report

**Date**: 2025-01-01  
**Goal**: Strengthen write→edit rule in all 7 agent SOUL.md files to drive convention compliance >90%

## Changes Made

### ✅ Successfully Edited (1/7)
- `/app/agents/optimizer/SOUL.md` — Strengthened rule from "⛔ Prefer edit() over write()" to "🚨 NEVER use write() to modify existing files. ALWAYS use edit()."

### ❌ Blocked by Permission (6/7)
Cannot edit other agents' SOUL.md files — only the owning agent, May, or tech-lead can modify identity files.

| Agent | File | Status |
|-------|------|--------|
| amy | `/app/agents/amy/SOUL.md` | BLOCKED |
| arc | `/app/agents/arc/SOUL.md` | BLOCKED |
| bob | `/app/agents/bob/SOUL.md` | BLOCKED |
| coach | `/app/agents/coach/SOUL.md` | BLOCKED |
| dev | `/app/agents/dev/SOUL.md` | BLOCKED |
| scout | `/app/agents/scout/SOUL.md` | BLOCKED |

## Required Action

**Escalate to May or tech-lead** to make the following edit in each of the 6 blocked files:

**Find:**
```
- ⛔ **Prefer edit() over write()**: When modifying existing files, use `edit()` to change only what's needed. Using `write()` to rewrite entire files risks losing existing content.
```

**Replace with:**
```
- 🚨 **NEVER use write() to modify existing files. ALWAYS use edit().** write() overwrites everything = data loss. Only use write() for brand-new files.
```

## C40 Intent Declaration

Also add before the finish() guidance line in each file:
```
- Before starting work, declare your plan in the first message.
```

## Impact

This change strengthens the most-violated convention (C40: write-over-edit). The stronger wording with 🚨 emoji makes it unmissable during agent execution, expected to reduce violations by ~50% and push compliance from 84.3% toward >90%.
