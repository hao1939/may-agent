# Shared Knowledge

Files here are available to all agents via `sharedKnowledge` in agent.json (auto-loaded into system prompt) or by reading directly.

## Auto-Loaded Files

| File | Purpose | Loaded by |
|------|---------|-----------|
| `system-design.md` | System architecture | May, Bob, Evaluator, Optimizer, Scout, Tech-Lead |
| `team.md` | Agent roster and roles | May, Bob, Coach, Evaluator, Optimizer, Tech-Lead |
| `philosophy.md` | Design values and principles | Bob |
| `roadmap.md` | Product direction and priorities | — (read on demand) |

## Knowledge Sharing

| File | Purpose |
|------|---------|
| `bulletin.md` | Cross-agent findings needing attention or action |
| `knowledge-index.md` | Directory of what each agent knows and where to find it |
| `SIGNALS.md` | Legacy append-only signal log (superseded by bulletin.md) |

## Skills

| Skill | Purpose |
|-------|---------|
| `skills/knowledge-sharing/` | How agents share discoveries and reference each other's knowledge |
| `skills/sub-agent-coordination/` | How to delegate work to other agents |

## Historical Docs

`may-agent-docs/` — Design docs, proposals, daily briefs. Historical reference, not actively loaded.
