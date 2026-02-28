# May Agents

Agent configurations for the [may-agent](https://github.com/hao1939/may-agent) system.

Each agent has its own directory with:
- `knowledge/domain.md` — agent identity, role, and domain expertise
- `knowledge/lessons.md` — evaluator-generated feedback (auto-managed)
- `tools/INDEX.md` — available tools manifest
- `workflows/` — workflow recipes (`.ts` files)
- `workspace/` — working directory for the agent

## Agents

| Agent | Role | Model |
|-------|------|-------|
| **may** | Supervisor — plans, delegates, reviews | Opus 4.6 |
| **coder** | Implementation — writes code, tests | Opus 4.6 |
| **reviewer** | Independent review — different perspective | GPT-5.2 |
| **evaluator** | Session evaluation — scores, patterns, workflows | GPT-5.2 |

## Why a Separate Repo?

Agent configs evolve independently from the library code:
- The evaluator modifies `lessons.md` and creates new workflows automatically
- Agents may update their own knowledge files
- Config changes shouldn't create noise in the library's git history
- Different deployment environments may use different agent configs
