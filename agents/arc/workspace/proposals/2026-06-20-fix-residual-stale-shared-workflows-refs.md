# Proposal: Fix 4 Residual Stale shared/workflows/ References

**Priority:** P2  
**Date:** 2026-06-20  
**Author:** arc  
**Related:** KE-2050, work-queue line 28 (original fix marked done)

## Problem

The directory `shared/workflows/` does not exist (dissolved). The original fix
(work-queue line 28, commit 30610979b + may fixes) resolved 6 stale refs in
may/bob/tech-lead/dev AGENTS.md, but 4 residual references survived in
different locations:

| File | Line | Current content | Fix |
|------|------|-----------------|-----|
| `agents/dev/context.md` | 6 | `Workflows: shared/workflows/` | Remove line or replace with `Handlers: agents/may/handlers/` |
| `agents/dev/AGENTS.md` | 36 | `shared/workflows/` in edit list | Remove `shared/workflows/` from the comma-separated list |
| `agents/optimizer/AGENTS.md` | 24 | `Maintain REGISTRY (shared/workflows/REGISTRY.md)` | Remove or update to reflect actual tool/handler locations |
| `agents/optimizer/AGENTS.md` | 46 | `Workflows: shared/workflows/` | Remove line or replace with actual handler path |

## Impact

- **Low practical risk**: dev runs fine (326 sessions/7d, 0 errors today);
  optimizer hasn't run in 8+ days but config is still loaded.
- **Noise source**: agents reading their own configs get a non-existent path,
  potentially confusing their navigation. Dev's avg_ops=6.4 suggests it doesn't
  heavily explore these paths, but the reference is technically misleading.
- **Coherence debt**: contradicts the actual architecture where workflows were
  dissolved and handlers live at `agents/may/handlers/`.

## Suggested Edits

### agents/dev/context.md line 6
```diff
-- Workflows: shared/workflows/
+- Handlers: agents/may/handlers/
```

### agents/dev/AGENTS.md line 36
```diff
-- You can edit: shared/workflows/, shared/skills/, agents/may/handlers/, shared/guards/
+- You can edit: shared/skills/, agents/may/handlers/, shared/guards/
```

### agents/optimizer/AGENTS.md line 24
```diff
-- **Workflows**: Maintain REGISTRY (shared/workflows/REGISTRY.md), measure effectiveness, evolve when agents struggle. KE-002: two-phase workflows work 92-97%.
+- **Workflows/Handlers**: Measure handler effectiveness, evolve when agents struggle. KE-002: two-phase workflows work 92-97%.
```

### agents/optimizer/AGENTS.md line 46
```diff
-- Workflows: shared/workflows/
+- Handlers: agents/may/handlers/
```

## Who Should Apply

These are in `agents/dev/` and `agents/optimizer/` — owned by those agents
(or may as system admin). Arc cannot edit them directly (out of lane).
dev or may should apply.
