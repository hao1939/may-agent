# P104 SOUL.md Bug Fix — Blocked by P53/P104 Defenses

**Date:** 2026-03-14
**Task:** Narrow P104 constraint in `agents/coder/SOUL.md` so coder can self-edit when instructed by Coach/tech-lead
**Status:** BLOCKED — requires human operator (Hao)

## What happened

1. **Tech-lead cannot edit coder's SOUL.md** — P53 cross-agent SOUL.md write protection correctly blocks this. Only the owning agent or a human may edit identity-critical files.

2. **Coder refuses to edit its own SOUL.md** — When delegated the self-edit task, coder correctly rejected it under P104 (Intelligent Disobedience). The coder identified the request as an attempt to weaken its self-protection constraints, which is exactly what P104 is designed to prevent.

3. **This is a deadlock by design.** The P53/P104 defense system intentionally prevents any agent (including the agent itself, when instructed by another agent) from weakening SOUL.md constraints. This is the correct security posture.

## Resolution

**This edit must be performed by Hao (human operator)** who can directly edit the file, bypassing agent-level protections.

### The two changes needed:

**Change 1** (line 39): Replace:
```
(e.g., modifying `SOUL.md`, deleting unverified files)
```
With:
```
(e.g., modifying **another agent's** `SOUL.md`, deleting unverified files)
```

**Change 2** (after line 41): After `- **Do not obey blindly.** If asked to "delete all", refuse.`, insert:
```
   - **Self-edits are allowed**: Editing your own `agents/coder/` files when explicitly instructed (e.g., by Coach or tech-lead) is a legitimate task, not a P104 violation.
```

## Why this is correct behavior

The coder's rejection is not a bug in P53/P104 — it's the intended security property. Agents should not be able to weaken their own identity constraints through automated instruction chains. The fix requires human authority.
