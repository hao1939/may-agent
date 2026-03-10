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
| `skills/agent-coordination/` | How to delegate work using the `agents` tool (call, send, list, peek, cancel) |
| `skills/knowledge-sharing/` | How agents share discoveries and reference each other's knowledge |
| `skills/error-handling/` | Error escalation, retry protocols, validation patterns |
| `skills/file-safety/` | Read-before-write, truncation awareness, file integrity |
| `skills/patterns/` | Proven multi-agent interaction patterns (implement-review-commit, research, scraping) |

## Historical Docs

`may-agent-docs/` — Design docs, proposals, daily briefs. Historical reference, not actively loaded.
