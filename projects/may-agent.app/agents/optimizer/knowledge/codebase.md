# Codebase Quick Reference

Key files for structural fixes:
- `src/manager.ts`: resolveSystemPrompt() builds system prompts, createTool() schema
- `src/tools.ts`: createExecTool() with denyPatterns/echoCwd/stripRedundantCd, createReadTool(), createWriteTool()
- `src/evaluator.ts`: evaluateTask() (task-tree evaluation), extractFailureChains(), extractUsage()
- `src/persistence.ts`: Session/memory storage, registry, archival
- `run/may.ts`: Agent registration, model assignment, tool wiring, post-task evaluation trigger
- `agents/shared/team.md`: Shared team knowledge — roster, runner design, model assignments (included in agent prompts)
- `agents/*/knowledge/domain.md`: Per-agent instructions (hot-reload per session)
- `agents/*/knowledge/lessons.md`: Accumulated lessons from evaluations

## Evaluation data

Each `.state/evaluations/<sessionId>.json` has:
- `agent` — which agent (coder, qa, etc.)
- `efficiency`, `quality` — per-agent scores (0.0–1.0)
- `verdict` — good/acceptable/needs_improvement
- `issues` — specific problems from evaluator
- `failureChains` — auto-extracted error→recovery sequences
- `usage` — token counts, cost, turns
- `overall` — task-level scores

Use `read` tool to examine actual code when needed.
