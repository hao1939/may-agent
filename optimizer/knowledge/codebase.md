# Codebase Quick Reference

Key files for structural fixes:
- `src/manager.ts`: resolveSystemPrompt() builds system prompts, createTool() schema
- `src/tools.ts`: createExecTool() with denyPatterns, createReadTool(), createWriteTool()
- `run/may.ts`: Agent registration, model assignment, tool wiring
- `src/evaluator.ts`: evaluateSession(), maintainAgent()
- `src/persistence.ts`: Session/memory storage

Use `read` tool to examine actual code when needed.
