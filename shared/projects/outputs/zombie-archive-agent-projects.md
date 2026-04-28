# Zombie Project Archive Report

## Summary
Audited all agent-owned project directories and archived 4 zombie projects from agent-specific directories. The shared projects `_archive/` already contained 49 previously archived zombies.

## Agent-Owned Projects Archived (This Session)

### Coach Agent (`/app/agents/coach/projects/`)
| Project | Reason | Moved To |
|---------|--------|----------|
| `breadcrumb-gap` | No project.md, stale investigation files only | `_archive/breadcrumb-gap` |
| `prove-the-loop` | No project.md, orphaned | `_archive/prove-the-loop` |
| `skill-workflow-audit` | No project.md, duplicate of shared project | `_archive/skill-workflow-audit` |

### Optimizer Agent (`/app/agents/optimizer/projects/`)
| Project | Reason | Moved To |
|---------|--------|----------|
| `request-dedup` | No project.md, duplicate of shared `request-deduplication` | `_archive/request-dedup` |

## Previously Archived (Shared)
49 zombie projects already in `/app/agents/shared/projects/_archive/` — no action needed.

## Current Active Projects (5)
1. `system-efficiency` — active
2. `agent-system-literacy` — active
3. `skill-workflow-audit` — active
4. `request-deduplication` — candidate for closure (done)
5. `handler-reliability` — candidate for closure (done)

## Post-Archive State
- **Total archived**: 53 (49 shared + 4 agent-owned)
- **Active**: 5 shared projects
- **Agent project dirs**: cleaned, only `_archive/` remains
- **Recommendation**: Close `request-deduplication` and `handler-reliability` per improvement plan
