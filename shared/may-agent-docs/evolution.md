# Agent Evolution: How to Extend Your Abilities

## The Progression

Every agent capability follows the same arc:

```
Experience → Lesson → Skill → Automation → Enforcement
```

Each level is a stronger encoding of knowledge. You move right as confidence grows.

---

## Level 0: Experience (ephemeral)

You do work. Something goes wrong, or you discover a better way.

**Where it lives:** In your session memory. Disappears when the session ends.

**Signal to level up:** You've hit the same pattern 2-3 times.

---

## Level 1: Lesson (persistent knowledge)

Write it down so you don't forget.

**Where it lives:** `agents/<you>/LESSONS.md` (auto-loaded every session)

**Format:**
```markdown
- Always run `bun run bundle` before claiming a fix works — TypeScript compiles but Bun bundling catches more
- When editing project.md, preserve the exact field format `**Field**: value`
```

**Signal to level up:** The lesson is so important that violating it always causes problems.

---

## Level 2: Skill (structured behavioral pattern)

A skill is a lesson with structure: context, principles, actions, anti-patterns.

**Where it lives:** `agents/shared/skills/<name>/SKILL.md`

**Format:**
```yaml
---
name: verification
description: Ensure outputs are verified with tool evidence
version: 1.0.0
tools: [bash, read]
---
```

Then structured sections: Context, Core Principles, Actions, Anti-patterns.

**How agents access it:** Distilled summary in `knowledge/INDEX.md`, full guide read on demand.

**Signal to level up:** The skill should execute automatically, not require the agent to remember.

---

## Level 3: Workflow (automated multi-step pattern)

A workflow codifies a skill into executable orchestration. Agents don't need to remember the steps — the workflow handles sequencing.

**Where it lives:** `agents/shared/workflows/<name>.ts`

**Interface:**
```typescript
export const name = "implement-and-verify";
export const description = "Code then verify with tests";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const code = await ctx.runAgent(ctx.agent, ctx.task);
  const verify = await ctx.runFunction("verify", async () => {
    const { execSync } = await import("node:child_process");
    return execSync("bun vitest --run", { encoding: "utf-8" });
  });
  if (verify.status === "error") return ctx.escalate("Tests failed");
  return ctx.done("Implemented and verified");
}
```

**Invoke from handler:** `ctx.sdk.runWorkflow("implement-and-verify", task)`
**Invoke from agent:** `workflow({ action: "run", name: "implement-and-verify", task })`

**Signal to level up:** Certain steps must ALWAYS happen (safety, quality) — not just when the workflow chooses.

---

## Level 4: Guard (enforcement)

A guard runs on every workflow step regardless of which workflow. It enforces invariants that should never be violated.

**Where it lives:** `agents/shared/guards/<name>.ts`

**Interface:**
```typescript
export const guard: WorkflowGuard = {
  name: "build-check",
  events: ["step_done"],
  handle(event) {
    // After any code-writing step, demand a build check
    if (event.result?.lastAssistantText?.includes("wrote")) {
      return [{ type: "run_step", step: { agent: "qa", task: "Run bun run bundle", label: "build-check" }, reason: "verify build" }];
    }
    return [];
  },
};
```

**Demand types:**
- `block` — stop the workflow immediately (hard invariant violated)
- `warn` — inject a warning into the next step's task
- `run_step` — inject an additional step (e.g., run tests after any code change)

---

## Level 5: Tool (new capability)

A tool gives an agent a new action it can take. Two ways to add tools:

### Tool Presets (agent.json)

Declare standard tool bundles in your agent config:

```json
{
  "tools": ["coding", "agents", "workflow", "scrape", "finish"]
}
```

Available presets:
| Preset | What it gives |
|--------|---------------|
| `coding` | read + write + edit + bash |
| `agents` | call, fork, message, list, peek, cancel other agents |
| `workflow` | list/run/resume workflows from within a session |
| `notify` | send messages to humans or agents (lightweight) |
| `scrape` | web scraping |
| `cron` | manage cron schedules |
| `checkpoint` | save progress mid-session |
| `system-status` | inspect system health |
| `agent-growth` | fork/promote/discard agents |
| `background-exec` | run long processes in background |
| `claude-code` / `gemini-cli` / `codex` | delegate to external coding agents |
| `finish` | structured session completion |

### Custom Local Tools (agents/<name>/tools/)

For domain-specific capabilities, create a tool file:

**Where it lives:** `agents/<name>/tools/<name>.ts`

**Interface:**
```typescript
// Default export must be a factory function
export default async function(opts: { projectRoot: string; agentRoot: string; persistDir: string }) {
  return {
    name: "my-custom-tool",
    label: "My Tool",
    description: "Does something domain-specific",
    parameters: { /* JSON Schema */ },
    async execute(toolCallId: string, params: any) {
      // ... your logic ...
      return { content: [{ type: "text", text: "result" }] };
    },
  };
}
```

Tools are auto-discovered and hot-reloaded. No config changes needed — just create the file.

---

## Level 6: Handler (reactive system behavior)

A handler is a persistent process that reacts to events or time. It doesn't need a workflow trigger — it runs autonomously.

**Where it lives:** `agents/<name>/handlers/<name>.ts`

**Interface:**
```typescript
export const create: HandlerModule["create"] = (ctx, entry) => {
  return async (event?) => {
    // Access everything via SDK
    const db = ctx.sdk.getDb();
    const result = await ctx.sdk.runWorkflow("my-workflow", task);
    ctx.sdk.emit("handler.done", { result });
  };
};
```

**Triggers:** Timer (intervalMs), events (on: ["metric.breach", "session.done"]), or manual.

---

## The Full SDK Surface

Everything an agent or handler can do:

```typescript
interface AgentSDK {
  runAgent(agent, task, opts?)      // Delegate work to another agent
  runWorkflow(name, task, opts?)    // Run multi-step orchestration
  createLLMSession(opts)            // Raw LLM session (evaluation/judgment)
  emit(type, data?)                 // Publish typed event
  getDb()                           // Access shared database
  log(level, msg)                   // Diagnostic logging
  notify(target, msg)               // "human" → Telegram, agent name → inbox
  escalate(target, reason)          // I'm stuck, need help
  paths                             // { persist, root, agents }
}
```

---

## Decision Guide: Which Level?

| Situation | Level | Action |
|-----------|-------|--------|
| "I keep forgetting to check X" | 1 Lesson | Add to LESSONS.md |
| "This pattern has 5 steps I always do" | 2 Skill | Write SKILL.md |
| "Agents should follow this procedure automatically" | 3 Workflow | Write workflow .ts |
| "This must NEVER be violated regardless of workflow" | 4 Guard | Write guard .ts |
| "This should happen every N minutes / on every event" | 5 Handler | Write handler .ts |
| "I don't know how to handle this" | — Escalate | `sdk.escalate("may", reason)` |

---

## The Exit Path: Escalate When Stuck

**You always have a way out.** If you don't know what to do, don't guess — escalate.

```typescript
// From a workflow
return ctx.escalate("Can't determine correct approach — need human guidance");

// From handler/agent code
ctx.sdk.escalate("may", "Metric breached but fix unclear — need direction");

// From an agent session (via finish tool)
finish({ status: "blocked", reason: "Requirements ambiguous, need clarification" });
```

**When to escalate:**
- You've tried 2+ approaches and all failed
- The task requires information you don't have
- You're unsure whether an action is safe (destructive, irreversible)
- A guard blocked your workflow and you don't understand why
- The project has been waiting >2h with no resolution path

**What happens:** Escalation triggers notification to the target (human or coordinating agent), records the event in the escalation log, and stops the current work cleanly. The project handler will detect the blocked state and notify again if unresolved.

**The principle:** It's always better to escalate too early than to proceed with uncertainty. Wasted work from a wrong guess costs more than a 5-minute human clarification.

---

## Growth Cycle: Testing Changes Safely

Before promoting any change to production:

```
1. Fork:    forkAgent(config, "coder", "coder-v2")
2. Edit:    Modify the fork's SOUL.md, workflows, etc.
3. Test:    Run gym scenarios against the fork
4. Decide:  promoteAgent(config, "coder-v2", "coder")  OR  discardAgent(config, "coder-v2")
```

This applies to all levels. Want to try a new lesson? Fork, add it, run scenarios, measure quality.

---

## Project System: Sustained Work

For work that spans multiple sessions:

```
agents/shared/projects/<name>/
  project.md        # Status, owner, plan, milestones
  discussion.md     # Human ↔ agent communication
```

The project handler automatically:
- Scans all projects on every tick
- Launches workflows for active projects with no live session
- Escalates blocked projects after timeout
- Prevents double-launches via in-memory session tracking

**Project lifecycle:** active → (workflow runs) → waiting/blocked → (human input) → active → done → closed

---

## Concrete Examples

### "I want agents to always run tests after code changes"

**Level 4 (Guard):** `agents/shared/guards/auto-test.ts` — injects a test step after any code-writing step.

### "I want a daily research scan"

**Level 5 (Handler):** `agents/scout/handlers/daily-scan.ts` — cron fires every 24h, calls `sdk.runAgent("scout", "scan for new papers")`.

### "Implement then verify is our default flow"

**Level 3 (Workflow):** `agents/shared/workflows/implement-and-verify.ts` — any project can declare `**Workflow**: implement-and-verify`.

### "Never commit secrets to git"

**Level 4 (Guard):** `agents/shared/guards/no-secret-leak.ts` — blocks workflow if step output contains secret patterns.

### "Check if project is stalled and re-launch"

**Level 5 (Handler):** `agents/may/handlers/project.ts` — the project health monitor.
