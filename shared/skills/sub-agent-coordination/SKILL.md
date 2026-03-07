---
name: sub-agent-coordination
description: Use when you need to delegate work to other agents, run workflows, or check the status of running tasks.
---

# Sub-Agent Coordination

You have two tools for delegation: `subagents` (direct control) and `workflow` (orchestrated sequences).

## Core Concept: Context Isolation
Sub-agents start with **zero context**. They do not see your conversation history.
- **Explicitly pass** all file paths, constraints, and background info in the `task` string.
- **Define the output** location clearly (e.g., "Write analysis to `workspace/analysis.md`").

## Tools

### `subagents`
Directly manage agent sessions.

| Action | Usage |
|---|---|
| `run` | **Async Start.** Returns `{ sessionId }` immediately. Use for parallel work. |
| `delegate` | **Blocking Start.** Waits for completion. Returns full output. Use when you need the result now. |
| `status` | Check state (`running`, `completed`, `failed`). |
| `progress` | Read recent logs (`limit` messages). |
| `result` | Get final output of a completed session. |
| `cancel` | Terminate a running session. |
| `steer` | Inject a message into a running session to correct course. |
| `trace` | View session hierarchy. |

**Parameters:**
- `agent`: Agent name (required for run/delegate).
- `task`: Detailed instruction string (required for run/delegate).
- `mode`: `"detached"` (survives restart) or `"attached"` (default).
- `sessionId`: Target session ID.

### `workflow`
Run pre-defined multi-agent sequences.

| Workflow | Description |
|---|---|
| `implement-and-review` | Coder implements → QA reviews → Retry on failure. **Mandatory for code changes.** |
| `design-review` | Bob reviews a design document. |

## Patterns

### 1. Fire-and-Forget (Async)
Start work and continue. The manager notifies you when it's done via a `[task-complete]` message. **Do not poll.**

```javascript
subagents.run({
  agent: "bob",
  task: "Review agents/amy/design.md against philosophy.md. Write findings to workspace/review.md"
});
```

### 2. Blocking Delegation (Sync)
Use when you cannot proceed without the result.

```javascript
const result = subagents.delegate({
  agent: "scout",
  task: "Find the latest documentation for Puppeteer 23"
});
// execution pauses here until scout finishes
```

### 3. Code Implementation (Workflow)
**Never** delegate code changes directly to `coder`. Use the workflow to ensure QA.

```javascript
workflow.run({
  name: "implement-and-review",
  task: "Update agents/amy/agent.json to add 'browser' tool. Allow access to 'google.com'."
});
```

### 4. Long-Running / Survivable (Detached)
Use `mode: "detached"` for tasks that should survive if *you* (the caller) restart.

```javascript
subagents.run({
  agent: "optimizer",
  task: "Analyze last 50 sessions for efficiency patterns",
  mode: "detached"
});
```

### 5. Steering
Correct a sub-agent that is drifting without killing the session.

```javascript
subagents.steer({
  sessionId: "s_12345",
  message: "Stop analyzing the database. Focus only on the API layer."
});
```

## Agent Directory

| Agent | Domain | Trigger When |
|---|---|---|
| `bob` | **Design/Philosophy** | You need architectural review, alignment checks, or meta-analysis. |
| `coder` | **Implementation** | **Do not call directly.** Use `workflow: implement-and-review`. |
| `qa` | **Quality/Testing** | **Do not call directly.** Use `workflow: implement-and-review`. |
| `optimizer` | **System Improvement** | You identify a recurring failure pattern or inefficiency. |
| `scout` | **Research** | You need external info (docs, libraries, patterns) not in your knowledge. |
| `amy` | **Social Intelligence** | You need specific XHS/social media context. |
| `tech-lead`| **Architecture** | You need to decompose a large feature into smaller tasks. |
| `coach` | **Training** | You need to run a training exercise for another agent. |
| `evaluator`| **Scoring** | You need to score a completed session (meta-loop). |

## Critical Rules

1.  **NO Polling.** The system delivers `[task-complete]` notifications automatically. Dispatch and wait.
2.  **NO Direct Code.** Always use `implement-and-review` for code changes.
3.  **NO Empty Context.** Imagine the sub-agent just woke up. Tell them *everything* (files, goal, constraints).
4.  **NO Infrastructure Work.** Do not ask agents to check if the server is running. Ask them to *think*.
