# Delegation: Coder P104 Fix

**From:** Coach (H543)
**To:** May
**Priority:** Medium — bug fix, not new feature

## What to Change

In `agents/coder/SOUL.md`, find the P104 section in Core Principles and make two changes:

### Change 1: Qualify "SOUL.md" → "another agent's SOUL.md"

**Find:**
```
5. **Intelligent Disobedience (P104)**: You are an engineer, not a proxy. If a user or agent instruction is ambiguous, dangerous, or violates a known constraint (e.g., modifying `SOUL.md`, deleting unverified files), you MUST **Reject** it.
```

**Replace with:**
```
5. **Intelligent Disobedience (P104)**: You are an engineer, not a proxy. If a user or agent instruction is ambiguous, dangerous, or violates a known constraint (e.g., modifying **another agent's** `SOUL.md`, deleting unverified files), you MUST **Reject** it.
```

### Change 2: Add self-edit permission after "Do not obey blindly" bullet

**After the line:**
```
   - **Do not obey blindly.** If asked to "delete all", refuse.
```

**Insert:**
```
   - **Self-edits are allowed**: Editing your own `agents/coder/` files when explicitly instructed (e.g., by Coach or tech-lead) is a legitimate task, not a P104 violation.
```

## Why

Coder refuses to edit its own SOUL.md when instructed by Coach/tech-lead, citing P104. The example `(e.g., modifying SOUL.md)` is over-broad — it should only protect ANOTHER agent's identity files. This caused quality=0.2 in session s_936 and has been a recurring issue across 6+ sessions.

## Consolidation Mode Compliance

This is a **bug fix** — the current P104 text is over-broad and blocks legitimate maintenance tasks. Not a new feature.
