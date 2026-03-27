---
name: agent-coordination
description: Use when you need to delegate work to other agents. Covers the `agents` tool (call, send, list, peek, cancel) and best practices for inter-agent cooperation.
version: 1.0.0
tools: [agents]
---

# Agent Coordination

You have one tool for delegation: `agents`.

## Core Concept: Context Isolation
Agents start with **zero context**. They do not see your conversation history.
- **Explicitly pass** all file paths, constraints, and background info in the task/message string.
- **Define the output** location clearly (e.g., "Write analysis to `workspace/analysis.md`").

## The `agents` Tool

| Action | Usage |
|---|---|
| `call` | **Blocking.** Runs an agent to completion and returns the result. Use when you need the result to continue. |
| `send` | **Fire-and-forget.** Creates a tracked request in the DB for the target agent. They see it in their next heartbeat. Use for "do this, I don't need the result now." |
| `list` | Show available agents and running sessions. |
| `peek` | Read recent messages from a running session. |
| `cancel` | Terminate a running session. |

**Parameters:**
- `agent`: Agent name (required for `call`, `send`).
- `task`: Detailed instruction string (required for `call`).
- `message`: Todo item to send (required for `send`).
- `sessionId`: Target session ID (required for `peek`, `cancel`).
- `limit`: Max messages to return (for `peek`, default: 20).

## Patterns

### 1. Blocking Delegation (call)
Use when you cannot proceed without the result.

```json
{ "action": "call", "agent": "scout", "task": "Find the latest Puppeteer 23 docs. Write summary to workspace/puppeteer-23.md" }
```
Execution pauses until Scout finishes and returns the result.

### 2. Async Todo (send)
Use for work you don't need to wait on. The target agent picks it up on their next heartbeat.

```json
{ "action": "send", "agent": "bob", "message": "Review agents/amy/design.md against philosophy.md. Write findings to workspace/review.md" }
```
Returns immediately. Bob will process this when his heartbeat fires.

### 3. Monitoring
Check on a running session or cancel it.

```json
{ "action": "peek", "sessionId": "s_12345", "limit": 10 }
{ "action": "cancel", "sessionId": "s_12345" }
```

## Agent Directory

| Agent | Domain | When to Use |
|---|---|---|
| `bob` | **Design/Philosophy** | Architectural review, alignment checks, meta-analysis. |
| `tech-lead` | **Architecture** | Decompose large features into tasks, drive implementation. |
| `optimizer` | **System Improvement** | Recurring failure patterns, efficiency analysis. |
| `scout` | **Research** | External info (docs, libraries, patterns) not in your knowledge. |
| `amy` | **Social Intelligence** | XHS/social media context. |
| `coach` | **Training** | Training exercises for other agents. |

## Critical Rules

1. **Prefer `call` for work you need now.** It blocks, but you get the result directly.
2. **Use `send` for independent work.** The agent picks it up on their next heartbeat. Don't wait for it.
3. **No empty context.** Imagine the agent just woke up. Tell them *everything* (files, goal, constraints).
4. **One task per call/send.** Don't bundle unrelated work into a single request.
