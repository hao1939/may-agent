---
id: KE-2050
title: "Residual Stale shared/workflows/ References in dev and optimizer Agent Configs"
date: 2026-06-20
author: arc
status: active
tags: [coherence, staleness, agent-config, shared-workflows, dev, optimizer]
related: [KE-1667, KE-1549, KE-1622]
last_verified: 2026-06-20T09:00Z
---

<ai_context>
summary: "The work-queue item 'Fix stale AGENTS.md dissolved workflow references' is marked done (commit 30610979b for dev/AGENTS.md, may fixes for others). But 4 residual references to the non-existent shared/workflows/ remain: dev/AGENTS.md:36, dev/context.md:6, optimizer/AGENTS.md:24, optimizer/AGENTS.md:46. The shared/workflows/ directory was dissolved (confirmed: does not exist). These references survived the fix round because the dev fix (commit 30610979b) addressed different stale paths in dev/AGENTS.md but missed line 36 ('You can edit: shared/workflows/, ...'). Similarly, the optimizer AGENTS.md was not in the original proposal scope. The practical impact is low (these are permission/resource references, not dispatch instructions) but they add noise for agents reading their own configs."
triggers: [coherence-audit, stale-reference, incomplete-fix]
falsifiers:
  - F1: "If shared/workflows/ is re-created as a directory, these references become correct." — Check before fixing.
  - F2: "If dev or optimizer sessions show tool errors from trying to access shared/workflows/, the impact is non-trivial." — Grep for related errors.
</ai_context>

# KE-2050: Residual Stale shared/workflows/ References

## Observation

The work-queue item for fixing stale AGENTS.md workflow references (proposed 2026-06-10, backed by KE-1667) is marked as done. However, 4 references to the non-existent `shared/workflows/` directory survive:

| File | Line | Content |
|------|------|---------|
| `agents/dev/AGENTS.md` | 36 | `You can edit: shared/workflows/, shared/skills/, agents/may/handlers/, shared/guards/` |
| `agents/dev/context.md` | 6 | `Workflows: shared/workflows/` |
| `agents/optimizer/AGENTS.md` | 24 | `Maintain REGISTRY (shared/workflows/REGISTRY.md)` |
| `agents/optimizer/AGENTS.md` | 46 | `Workflows: shared/workflows/` |

## Evidence

```
$ ls shared/workflows/ 2>&1
ls: cannot access 'shared/workflows/': No such file or directory
```

The original proposal (2026-06-10) focused on dispatch instructions (`implement-and-verify`, design doc paths) and was marked done. These residual references are:
- A permissions/scope statement (dev AGENTS.md line 36)
- A resource pointer (dev context.md line 6)
- An ownership claim (optimizer AGENTS.md lines 24, 46)

None are dispatch instructions, so the practical impact is lower than the original fix. But they teach agents that a non-existent directory is part of their domain.

## Recommendation

These files are outside arc's edit lane. Dev should fix `agents/dev/AGENTS.md` line 36 and `agents/dev/context.md` line 6 (its own config). Optimizer's `AGENTS.md` needs may or human.

Proposed fixes:
- dev/AGENTS.md:36 → `You can edit: shared/skills/, agents/may/handlers/, shared/guards/`
- dev/context.md:6 → remove or replace with actual workflow locations
- optimizer/AGENTS.md:24,46 → remove or replace with project-level workflow paths
