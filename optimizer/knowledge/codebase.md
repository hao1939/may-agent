# Codebase Reference for Optimizer

## System Prompt Assembly (the key leverage point)

In `src/manager.ts`, `resolveSystemPrompt()` builds the system prompt:

```
sections = []
1. systemPromptFiles contents (domain.md, tools/INDEX.md, etc.)
2. lessons.md from knowledgeDir (auto-loaded)
3. skills from skills/ directories
4. memory entries from .state/memory/<agent>.jsonl
5. workspace path
6. output path
```

**This is where structural fixes go.** If you want every agent to know its cwd at session start, add it as a section here. If you want to inject available file listings, add it here.

## Exec Tool (src/tools.ts)

```typescript
export function createExecTool(cwd?: string): AgentTool {
  // cwd is passed by the runner — it's PROJECT_ROOT
  // Commands run in this directory
  // No input validation on commands currently
}
```

**Leverage point:** You can propose input guards (reject `find /`), output augmentation (auto-prepend cwd to first exec output), or wrapper behavior.

## Runner (run/may.ts)

Registers all 5 agents with their configs. Key constants:
- `PROJECT_ROOT` — resolved from `import.meta.url`
- `AGENTS_ROOT` — `PROJECT_ROOT/agents`
- Each agent gets specific tools, model, systemPromptFiles, knowledgeDir

**Leverage point:** The runner can inject runtime-resolved data into agent definitions (e.g., set `systemPrompt` to include resolved paths).

## Evaluation Data

`.state/evaluations/<sessionId>.json` — JSON with:
- `efficiency` (0-1), `quality` (0-1)
- `total_tool_calls`, `productive_calls`, `wasted_calls`
- `verdict`: "good" | "acceptable" | "needs_improvement"
- `usage.cost`, `usage.totalTokens`, `usage.turns`

## Session Transcripts

`.state/sessions/history/<sessionId>/session.jsonl` — one AgentMessage per line:
```json
{"role":"user","content":[{"type":"text","text":"..."}],"timestamp":1234}
{"role":"assistant","content":[{"type":"text","text":"..."},{"type":"toolCall","name":"exec","args":{...}}],"timestamp":1235}
```

Look for: repeated tool calls with the same error, `find /` patterns, reading the same file twice, long sequences of failed attempts.

## Agent Knowledge

`agents/<name>/knowledge/domain.md` — core instructions (read by systemPromptFiles)
`agents/<name>/knowledge/lessons.md` — accumulated lessons (auto-loaded by resolveSystemPrompt)

## Current Test Count: 249 tests across 19 files
