---
name: agent-growth
description: Agent growth lifecycle management — fork, verify, promote experimental agents.
version: 1.0.0
tools: []
---

# Agent Growth Skill

This skill allows an agent (typically the `coach`) to execute the agent growth
cycle: fork, verify, promote.

It provides tools to manage the lifecycle of experimental agents in the
`.lab/` directory.

## Tools

### `fork_agent(source: string, dest: string)`
Creates a copy of an agent in the `.lab/` directory.
- `source`: Name of the existing agent (e.g., "coder")
- `dest`: Name for the new experimental agent (e.g., "coder-v2")
- Automatically updates `agent.json` name
- Copies memory by default (can be cleared manually if needed)
- Registers the new agent with the running system

### `verify_agent(agent: string, task: string, expected?: string)`
Runs a verification task on an agent and returns the result.
- `agent`: Name of the agent to test
- `task`: The prompt/instruction to send
- `expected`: Optional specific success criteria to check
- Returns: `{ success: boolean, output: string, score: number }`

### `promote_agent(source: string, target: string)`
Promotes changes from an experimental agent back to the live agent.
- `source`: The experimental agent (e.g., "coder-v2")
- `target`: The live agent to update (e.g., "coder")
- Copies: SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md, knowledge/, skills/
- Does NOT copy: workspace/, memory, sessions
- Deregisters and deletes the source agent after promotion

### `discard_agent(agent: string)`
Discards an experimental agent.
- `agent`: The experimental agent to delete
- Deregisters and deletes the directory
- Logs the discarded experiment to the parent's growth log

## Usage

```javascript
// 1. Fork
await fork_agent("coder", "coder-v2");

// 2. Modify (using standard edit tools)
await edit("agents/.lab/coder-v2/LESSONS.md", ...);

// 3. Verify
const result = await verify_agent("coder-v2", "Fix the bug in test.ts");
if (result.success) {
  // 4. Promote
  await promote_agent("coder-v2", "coder");
} else {
  // 5. Discard
  await discard_agent("coder-v2");
}
```
