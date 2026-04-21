# Design: CLI Workflow/Handler Execution

**Status:** Proposal
**Date:** 2026-04-22
**References:** [core-principles.md](core-principles.md) (P10: simple first)

## Problem

No way to run a handler or workflow directly. Debugging requires: change code → commit → restart → trigger event → wait → query DB → guess. Each cycle takes minutes. 

We need: run it, see what happens. Same code path as production.

## Design

### `--run-handler <name>`

Run a cron handler once. Same code path as when the cron timer fires.

```bash
may-agent --run-handler project
may-agent --run-handler heartbeat       # may's heartbeat
may-agent --run-handler metrics-snapshot
```

Internally:
1. Load the handler the same way cron does (import, create, call)
2. Build real HandlerContext with real RuntimeCtx (same DB, same bus, same paths)
3. Call the handler function
4. Print what happened (logs go to stdout)
5. Exit

This is NOT a simulation. It runs the real handler with real side effects. Same as production — just triggered from CLI instead of timer.

### `--run-workflow <name> [input]`

Run a workflow directly. Same code path as when a handler launches it.

```bash
may-agent --run-workflow coach-heartbeat
may-agent --run-workflow project "project: agents/bob/workspace/projects/reviewer-effectiveness\nagent: bob\ngoal: see project file"
```

Internally:
1. Load the workflow module (dynamic import, same as run-workflow handler)
2. Build real WorkflowContext with real RuntimeCtx
3. Call `workflow.execute(ctx)`
4. Print result
5. Exit

### `--dry-run` modifier

Don't call the LLM. Build the prompt, print it, exit.

```bash
may-agent --run-workflow coach-heartbeat --dry-run
```

This shows exactly what the agent would see — metrics, projects, alerts, heartbeat.md — without spending tokens. For debugging prompts.

Implementation: `ctx.runAgent` in dry-run mode prints the prompt and returns a dummy result instead of calling the LLM.

## Implementation

### Entry point (src/app/may.ts)

```typescript
const RUN_HANDLER = (() => {
  const idx = process.argv.indexOf("--run-handler");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const RUN_WORKFLOW = (() => {
  const idx = process.argv.indexOf("--run-workflow");
  return idx !== -1 ? { name: process.argv[idx + 1], input: process.argv[idx + 2] } : null;
})();

const DRY_RUN = process.argv.includes("--dry-run");
```

### Handler execution (~30 LOC)

```typescript
if (RUN_HANDLER) {
  // Same setup as loadAgentHandlers but for one handler
  const rtx = buildRuntimeCtx({ bus, persistDir, projectRoot, agentsRoot, agentName: "may" });
  const ctx = { ...rtx, manager, ... };  // full HandlerContext
  
  // Find and load the handler
  const handlerPath = findHandler(agentsRoot, RUN_HANDLER);
  const mod = await import(handlerPath);
  const fn = mod.create(ctx, cronEntry);
  
  // Run it
  await fn();
  process.exit(0);
}
```

### Workflow execution (~30 LOC)

```typescript
if (RUN_WORKFLOW) {
  const rtx = buildRuntimeCtx({ bus, persistDir, projectRoot, agentsRoot, agentName: "may" });
  const wf = await loadWorkflow(RUN_WORKFLOW.name);
  
  const ctx: WorkflowContext = {
    ...rtx,
    task: RUN_WORKFLOW.input ?? "",
    agent: "may",
    runAgent: DRY_RUN 
      ? async (agent, prompt) => { 
          console.log(`\n=== DRY RUN: ${agent} ===\n${prompt}\n=== END ===\n`);
          return { sessionId: "dry", status: "done", lastAssistantText: "(dry run)", messages: [], duration: "0s", outputDir: "", turnsUsed: 0 };
        }
      : async (agent, prompt) => manager.callAgent(agent, prompt),
    summarize: (r) => r?.lastAssistantText ?? "",
    done: (s) => ({ type: "done", summary: s }),
    escalate: (r) => ({ type: "escalate", reason: r }),
  };
  
  const result = await wf.execute(ctx);
  console.log("\nResult:", result.type, result.summary ?? result.reason);
  process.exit(0);
}
```

## Usage Examples

```bash
# Debug: what does coach's heartbeat prompt look like?
may-agent --run-workflow coach-heartbeat --dry-run

# Debug: what does the project handler see?
may-agent --run-handler project

# Run a specific project workflow
may-agent --run-workflow project "project: agents/bob/workspace/projects/reviewer-effectiveness\nagent: bob\ngoal: see project file"

# Run a heartbeat for real (same as cron trigger)
may-agent --run-workflow may-heartbeat
```

## What This Replaces

| Today | After |
|-------|-------|
| Change → commit → restart → trigger event → wait → query DB | `--run-workflow X --dry-run` → see prompt instantly |
| Guess why handler didn't fire → check logs → check cron.json | `--run-handler project` → see output directly |
| Deploy to test → wait 30 min for heartbeat | `--run-workflow coach-heartbeat` → runs now |
| Query truncated DB task field | `--dry-run` shows full prompt on stdout |

## Total: ~60 LOC in src/app/may.ts

Same code path as production. No mocking. No simulation. Just a different trigger.
