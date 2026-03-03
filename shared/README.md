# Shared Knowledge Library

**Owner: optimizer**

Curated knowledge about the agent system — architecture, team, patterns. Organized
by topic, not by consumer. See the [Knowledge Library section in system-design.md](system-design.md#shared-knowledge-library) for the design rationale.

## How It Works

1. **This directory is the source of truth** — versioned docs about the system
2. **Agents include relevant docs** in their system prompt via `systemPromptFiles`
3. **Any agent can browse** the full library at `agents/shared/` when it needs more context
4. **The library evolves** through normal work — optimizer updates docs, design reviews identify gaps

## Documents

### Architecture
- **[system-design.md](system-design.md)** — Conceptual model: what agents are, collaboration patterns, design principles, optimization loop, fix hierarchy, knowledge library design, session lifecycle

### Team
- **[team.md](team.md)** — Concrete roster: agents, models, tools, turn limits, workflows, automation, structural constraints

### Reviews
- **[system-design-review.md](system-design-review.md)** — Historical review of system-design.md against the codebase, with findings and status tracking

## Inclusion

| Agent | system-design | team | Why |
|-------|:---:|:---:|-----|
| May | ✓ | ✓ | Coordinates the team, needs full picture |
| Evaluator | ✓ | ✓ | Scores agents, needs to understand roles and constraints |
| Optimizer | ✓ | ✓ | Improves agents, needs to understand architecture |
| Coder | — | — | Works on specific tasks independently |
| QA | — | — | Reviews code independently |

All agents can `read agents/shared/` during a session if they need additional context.
