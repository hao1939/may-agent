# Agent Evolution: How to Extend Your Abilities

**Design status**: Draft. This document defines a promotion heuristic, not a
runtime lifecycle. Operational interfaces remain authoritative in
[`agent-convention.md`](../2b-manual/agent-convention.md),
[`skills.md`](../2a-design/skills.md),
[`workflows.md`](../2a-design/workflows.md),
[`workflow-authoring.md`](../2b-manual/workflow-authoring.md),
[`guards.md`](../2a-design/guards.md), and [`sdk.md`](../2a-design/sdk.md).

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

**Where it lives:** `agents/<you>/LESSONS.md` or `agents/<you>/knowledge/`.
Lessons are not auto-loaded. Promote only durable always-on behavior into
`AGENTS.md`.

**Format:**
```markdown
- Always run `bun run bundle` before claiming a fix works — TypeScript compiles but Bun bundling catches more
- When editing project.md, preserve the exact field format `**Field**: value`
```

**Signal to level up:** The lesson is so important that violating it always causes problems.

---

## Level 2: Skill (structured behavioral pattern)

A skill is a lesson with structure: context, principles, actions, anti-patterns.

**Where it lives:** `shared/skills/<name>/SKILL.md`,
`agents/<owner>/skills/<name>/SKILL.md`, or
`projects/<id>.app/agents/<owner>/skills/<name>/SKILL.md`, depending on scope.

**Format:**
```yaml
---
name: verification
description: Use when work products must be verified with tool evidence before completion is claimed.
---
```

Then structured sections: Context, Core Principles, Actions, Anti-patterns.

**How agents access it:** The runtime discovers compact metadata and loads the
full body only for a matching turn; see
[`skills.md`](../2a-design/skills.md). A caller may also select one explicit
primary skill for a turn. Do not copy the full skill into always-on prompt
files.

**Signal to level up:** Repeated evidence shows that the sequence must be
consistent, missing or reordered steps create meaningful risk, and inputs,
outputs, and terminal conditions can be made explicit. Frequency alone is not
enough; a schedule may invoke a skill-bearing session without making the skill
a workflow.

---

## Level 3: Workflow (automated multi-step pattern)

A workflow codifies a stable practice into executable orchestration. It may
have evolved from a skill, but promotion is not automatic: the workflow runtime
must have a repeatable sequence worth enforcing. Agents do not need to remember
the steps because the workflow handles sequencing.

Skills and workflows share discovery, provenance, and evaluation conventions,
but not execution semantics. `SKILL.md` is interpreted per turn; a workflow's
TypeScript module controls a durable run. See
[`workflows.md`](../2a-design/workflows.md).

Workflow execution is synchronous by design. A workflow step waits for its
agent/function/sub-workflow result before the next step runs; this keeps
orchestration simple and auditable.

**Where it lives:** `agents/<agent>/workflows/<name>.ts` or
`projects/<id>.app/workflows/<name>.ts`.

**Interface:**
```typescript
export const name = "implement-and-verify";
export const description = "Code then verify with tests";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const code = await ctx.runAgent(ctx.agent, ctx.task);
  const verify = await ctx.runFunction("verify", async () => {
    const { execSync } = await import("node:child_process");
    return execSync("bun test", { encoding: "utf-8" });
  });
  if (verify.status === "error") return ctx.blocked("Tests failed");
  return ctx.done("Implemented and verified");
}
```

**Invoke from handler:** `ctx.sdk.runWorkflow("implement-and-verify", task)`
**Invoke from agent:** `workflow({ action: "run", name: "implement-and-verify", task })`

**Signal to level up:** Repeated evidence shows a mechanically detectable risk
needs an observable intervention. Judgment-heavy quality rules should remain in
owner context or workflows.

---

## Level 4: Guard (workflow-level detection/intervention)

> **Note:** Guards are a workflow-level pattern, not an infra primitive. The infra runs guard hooks, but workflows choose which guards apply and what intervention mode is appropriate.

A guard runs on workflow step events. It detects mechanical risks, emits
observable signals, and may intervene when justified.

**Where it lives:** Inline in workflow definitions, or `shared/guards/<name>.ts`

**Interface:**
```typescript
export const guard: WorkflowGuard = {
  name: "build-check",
  events: ["step_done"],
  handle(event) {
    if (event.result?.lastAssistantText?.includes("wrote")) {
      return [{ type: "run_step", step: { agent: "qa", task: "Run bun run bundle", label: "build-check" }, reason: "verify build" }];
    }
    return [];
  },
};
```

**Current demand types:**
- `warn` — inject a warning into the next step's task
- `run_step` — inject an additional step
- `block` — stop the workflow immediately; reserve for high-confidence, high-impact risks

**Target guard mode:** `observe` should mean "record a guard signal without
interrupting work." Until the runtime exposes that as a first-class demand,
use no hard block for uncertain detectors and rely on guard-trigger events or
metrics to review the pattern later.

**Default observability:** every guard trigger should emit `guard.triggered`.
A default guard handler should record a small set of guard metrics and attach
trace fields (`sessionId`, `workflowRunId`, `step`) so later review can find
the exact failure chain. Guard-specific logging should be unnecessary unless
the guard needs an exception to the default convention.

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

Common presets are shown below only as examples; `agent.json` and the running
tool loader are authoritative:

| Preset | What it gives |
|--------|---------------|
| `coding` | read + write + edit + bash |
| `agents` | call, fork, list, peek, and cancel agent sessions |
| `workflow` | list/run/resume workflows from within a session |
| `message` | send messages to humans or agents (lightweight) |
| `scrape` | web scraping |
| `cron` | manage cron schedules |
| `checkpoint` | save progress mid-session |
| `system-status` | inspect system health |
| ~~`agent-growth`~~ | *(removed — growth is agent-scope, not infra)* |
| `background-exec` | run long processes in background |
| `claude-code` / `gemini-cli` / `codex` | delegate to external coding agents |
| `finish` | structured session completion |
| `query_db` | Core read-only DB query tool. Loaded for every agent and backed by runtime `getDb()` path resolution. |

### Custom Local Tools (agents/<name>/tools/)

For domain-specific capabilities, create a tool file under the owning global or
app-local agent:

**Where it lives:** `agents/<name>/tools/<name>.ts` or
`projects/<id>.app/agents/<name>/tools/<name>.ts`.

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

Tool discovery and reload behavior are runtime contracts; verify the tool is
present in the agent's actual tool list before relying on it.

---

## Level 6: Handler (reactive scheduled behavior)

A handler is a stateless function that runs on a schedule or in response to events. The cron system calls it — the handler does its work and returns.

**Where it lives:** `agents/<name>/handlers/<name>.ts`

**Interface:**
```typescript
export const create: HandlerModule["create"] = (ctx, entry) => {
  return async (event?) => {
    // Access everything via SDK
    const db = ctx.sdk.getDb();
    const result = await ctx.sdk.runWorkflow("my-workflow", task);
    ctx.sdk.emit("handler.completed", { result }, { owner: "agent:may" });
  };
};
```

**Triggers:** Timer (`intervalMs`), events (`on: ["metric.breach", "session.end"]`), or manual.

---

## The Full SDK + Tool Surface

See [sdk.md](../2a-design/sdk.md) for the canonical AgentSDK and WorkflowSDK interfaces.

### Agent Tools (for LLM sessions — the agent's action surface)

| Tool | What |
|------|------|
| `bash(command)` | Execute shell commands |
| `read(path)` | Read files |
| `write(path, content)` | Create/overwrite files |
| `edit(path, old, new)` | Surgical text replacement |
| `agents` with `action: "call"` | Delegate to another agent and wait |
| `agents` with `action: "fork"` | Start bounded background delegation |
| `message({ to, content })` | Send an asynchronous human or agent message |
| `workflow(action, name, task)` | Run a multi-step workflow |
| `checkpoint(summary)` | Save progress mid-session |
| `finish(summary, deliverables)` | End session with structured output |

---

## Decision Guide: Which Level?

| Situation | Level | Action |
|-----------|-------|--------|
| "I keep forgetting to check X" | 1 Lesson | Add to LESSONS.md |
| "This pattern has 5 steps I always do" | 2 Skill | Write SKILL.md |
| "The runtime must enforce this stable sequence and terminal result" | 3 Workflow | Write workflow .ts |
| "A repeated mechanical risk needs observable intervention" | 4 Guard | Start with observe/warn; block only after validation |
| "I need a new action type that doesn't exist" | 5 Tool | Write `tools/<name>.ts` |
| "This should happen every N minutes / on every event" | 6 Handler | Write handler .ts |
| "I don't know how to handle this" | — Escalate | `sdk.escalate(reason)` |

---

## The Exit Path: Escalate When Stuck

**You always have a way out.** If you don't know what to do, don't guess — escalate.

```typescript
// From a workflow: local terminal result; caller/boundary decides whether to route it.
return ctx.blocked("Can't determine correct approach — need human guidance");

// From handler/agent code: external owner-routed escalation.
ctx.sdk.escalate("Metric breached but fix unclear — need direction");

// From an agent session (via finish tool)
finish({ status: "blocked", reason: "Requirements ambiguous, need clarification" });
```

**When to escalate:**
- You've tried 2+ approaches and all failed
- The task requires information you don't have
- You're unsure whether an action is safe (destructive, irreversible)
- A guard blocked your workflow and you don't understand why
- The project has been waiting >2h with no resolution path

**What happens:** Escalation triggers notification to the target owner (human or
coordinating agent), records the event, and stops the current work cleanly.
The owning project app or owner route is responsible for noticing unresolved
blocked state and following up.

**The principle:** Escalate when the next action crosses an ownership boundary
and cannot be resolved locally. Preserve the blocked evidence and resume
context; do not create escalation noise for ordinary local retries.

---

## Growth: Agent-Scope Concern

Growth (experimentation, iteration, improvement) is an agent's responsibility, not an infra primitive. The infra provides the fundamentals (files, events, metrics) — agents build growth patterns on top.

---

## Project System: Sustained Work

For work that spans multiple sessions, see [projects.md](../2a-design/projects.md).

Project status, task-tree state, and session lifecycle are separate. See
[projects.md](../2a-design/projects.md) and
[task-tree-engine.md](../2a-design/task-tree-engine.md) for the canonical
vocabularies.

---

## Concrete Examples

### "I want agents to always run tests after code changes"

**Level 3 (Workflow):** put the test and evidence gate in the owning coding
workflow. Use a guard only to detect a repeated, mechanically identifiable
omission.

### "I want a daily research scan"

**Level 6 (Handler or app schedule):** an owning app schedule emits a canonical
event to its workflow handler. A standalone global agent may use an agent-owned
handler when no project app owns the behavior.

### "Implement then verify is our default flow"

**Level 3 (Workflow):** `agents/dev/workflows/implement-and-verify.ts` or
`projects/<id>.app/workflows/implement-and-verify.ts`. Each workflow has one
owner; copy and diverge when another owner needs different policy.

### "Never commit secrets to git"

**Level 4 (Guard):** a high-confidence secret detector emits
`guard.triggered`; blocking is justified only at a boundary where the match is
reliable and the impact is severe.

### "Check if project is stalled and re-launch"

**Project owner loop:** the app emits `project.owner.requested`; the owner
reviews current project/task state and either assigns work, records an exact
wait, escalates across an owner boundary, or emits `project.owner.reviewed`.
