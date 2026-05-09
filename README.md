# May Agents

Agent configurations for the [may-agent](https://github.com/hao1939/may-agent) system.

## Structure

Each agent has its own directory:
- `knowledge/domain.md` — role, responsibilities, instructions
- `knowledge/lessons.md` — accumulated lessons from evaluations (auto-managed)
- `knowledge/codebase.md` — project-specific code knowledge (coder, optimizer)
- `tools/INDEX.md` — available tools documentation
- `workflows/` — workflow definitions (May, optimizer)
- `workspace/` — working directory for scratch files

Shared knowledge lives in `shared/`:
- `shared/team.md` — concrete team roster (who, what tools, models, runner design, automation)

## Agents

### Feature Team

| Agent | Role | Model |
|-------|------|-------|
| **may** | Supervisor — delegates, reviews, commits | opus |
| **coder** | Implementation — reads, writes, tests | opus |
| **qa** | Code review — independent quality check | gpt-5.2 |

### Meta Team

| Agent | Role | Model |
|-------|------|-------|
| **evaluator** | Scores agent behavior per task tree | gpt-5.4 |
| **optimizer** | Finds patterns, implements fixes | opus |

## Why a Separate Repo?

Agent configs evolve independently from the library code:
- The optimizer edits domain.md, lessons.md, tools, and workflows
- The evaluator writes lessons from evaluation data
- Config changes shouldn't create noise in the library's git history
- Knowledge hot-reload: changes take effect on next agent session without restart
