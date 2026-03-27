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
| `src/evaluator.ts` | `evaluateTask()`, `evaluateSession()`, `extractFailureChains()`, `extractUsage()` |
| `src/compaction.ts` | Context compaction for long-running sessions |
| `src/skills.ts` | `parseFrontmatter()`, `loadSkillsFromDirs()`, `formatSkillsForPrompt()` |
| `src/overflow.ts` | Context overflow detection and progress extraction |
| `src/index.ts` | Re-exports everything public |

## Key Types

```typescript
interface SubagentDefinition {
  name: string;
  description: string;
  domain: string;
  systemPrompt?: string;
  systemPromptFiles?: string[];
  workspace?: string;
  knowledgeDir?: string;
  skillsDirs?: string[];
  projectRoot?: string;
  tools: AgentTool[];
  model: Model<any>;
  apiKey?: string;
  timeoutMs?: number;
  maxTurns?: number;
  memoryLimit?: number;
  compaction?: boolean | CompactionOptions;
  persistent?: boolean;
}

interface TaskResult {
  sessionId: string;
  status: "done" | "error";
  lastAssistantText: string | null;
  messages: AgentMessage[];
  duration: string;
  outputDir: string;
  error?: string;
  turnsUsed?: number;
  maxTurns?: number;
}

interface SessionInfo {
  sessionId: string;
  agent: string;
  task: string;
  status: "running" | "done" | "error" | "interrupted" | "idle";
  startedAt: number;
  endedAt?: number;
  runtime: string;
  outputDir: string;
  error?: string;
  parentSessionId?: string;
}
```

## SubagentManager API

```typescript
class SubagentManager {
  constructor(opts: { persistDir: string })
  register(def: SubagentDefinition): void
  run(name: string, task: string, opts?: RunOptions): string
  resumeAgent(name: string): { resumed: SessionInfo | null; interrupted: SessionInfo[] } | null
  status(): SessionInfo[]
  listAgents(): Array<{ name, description, domain }>
  progress(sessionId: string, limit?: number): AgentMessage[]
  result(sessionId: string): TaskResult
  cancel(sessionId: string): void
  send(sessionId: string, message: string): Promise<void>
  steer(sessionId: string, message: string): "steered" | "queued"
  subscribe(sessionId: string, fn: (e: AgentEvent) => void): () => void
  waitFor(sessionId: string): Promise<TaskResult>
  waitForIdle(sessionId: string): Promise<void>
  createTool(opts?): AgentTool
  getAgentDefinition(name: string): SubagentDefinition | undefined
}
```

## Testing

- Framework: vitest
- Run all: `npx vitest --run`
- Run one: `npx vitest --run test/<file>.test.ts`
- Type check: `npx tsc --noEmit`

## Patterns

- All tools return `{ content: [{ type: "text", text }], details?: object }`
- Manager uses `RegistryStore` for persistence (`registry.json`)
- Session messages stored as JSONL in `.state/sessions/<id>/session.jsonl`
- History archived to `.state/sessions/history/<id>/`
- Memory entries appended to `.state/memory/<agent>.jsonl`
- Evaluations saved to `evaluations` table in `.state/may.db` (SQLite)
- Skills discovered via `SKILL.md` files with YAML frontmatter
- Workflows are `.ts` files with `name`, `description`, `execute(ctx)` exports
