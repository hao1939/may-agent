# may-agent Codebase Reference

## File Map

| File | Purpose |
|------|---------|
| `src/types.ts` | `SubagentDefinition`, `SessionInfo`, `TaskResult` |
| `src/manager.ts` | `SubagentManager` — register, run, waitFor, createTool |
| `src/persistence.ts` | `RegistryStore`, session JSONL, memory, archival |
| `src/tools.ts` | `createReadTool`, `createWriteTool`, `createExecTool`, `createLearnTool`, `createHealthCheckTool`, `createValidateWorkflowTool` |
| `src/workflow.ts` | `WorkflowContext`, `WorkflowResult`, `WorkflowEvent`, `WorkflowInterrupted` |
| `src/workflow-tool.ts` | `createWorkflowTool()` — list/run actions |
| `src/evaluator.ts` | `evaluateSession()`, `maintainAgent()`, `UsageSummary` |
| `src/skills.ts` | `parseFrontmatter()`, `loadSkillsFromDirs()`, `formatSkillsForPrompt()` |
| `src/index.ts` | Re-exports everything public |

## Key Types

```typescript
interface SubagentDefinition {
  name: string;
  description: string;
  domain: string;
  systemPrompt?: string;        // takes precedence if set
  systemPromptFiles?: string[];  // loaded + concatenated
  workspace?: string;
  knowledgeDir?: string;         // auto-loads lessons.md
  skillsDirs?: string[];         // scanned for SKILL.md
  tools: AgentTool[];
  model: Model<any>;
  apiKey?: string;
  timeoutMs?: number;
  memoryLimit?: number;          // default 20
}

interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;
  messages: AgentMessage[];
  duration: string;
  outputDir: string;
  error?: string;
}
```

## SubagentManager API

```typescript
class SubagentManager {
  constructor(opts: { persistDir: string })
  register(def: SubagentDefinition): void
  run(name: string, task: string): string              // returns sessionId
  resume(): SessionInfo[]                               // restart recovery
  status(): SessionInfo[]                               // all sessions
  listAgents(): Array<{ name, description, domain }>
  progress(sessionId: string, limit?: number): AgentMessage[]
  result(sessionId: string): TaskResult | null
  cancel(sessionId: string): void
  send(sessionId: string, message: string): boolean     // inject user message
  steer(sessionId: string, message: string): "steered" | "queued" | "not_running"
  subscribe(sessionId: string, fn: (e: AgentEvent) => void): (() => void) | null
  createTool(): AgentTool                               // single "subagents" tool
  waitFor(sessionId: string): Promise<TaskResult | null>
}
```

## Testing

- Framework: vitest
- Run all: `npx vitest --run`
- Run one: `npx vitest --run test/<file>.test.ts`
- Type check: `npx tsc --noEmit`
- Currently: 184 tests across 11 files

## Patterns

- All tools return `{ content: [{ type: "text", text }], details?: object }`
- Manager uses `RegistryStore` for persistence (`registry.json`)
- Session messages stored as JSONL in `.state/sessions/<id>/session.jsonl`
- History archived to `.state/history/<id>/`
- Memory entries appended to `.state/memory/<agent>.jsonl`
- Skills discovered via `SKILL.md` files with YAML frontmatter
- Workflows are `.ts` files with `name`, `description`, `execute(ctx)` exports
