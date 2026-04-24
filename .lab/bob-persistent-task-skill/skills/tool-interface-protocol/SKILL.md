---
name: tool-interface-protocol
description: >
  Use tool-interface calls (checkpoint, finish, agents) via their native tool
  interfaces, NEVER via bash. Prevents FM-2.6 (TOOL_INTERFACE_MISUSE) where
  the agent runs `checkpoint` or `finish` as shell commands (exit code 127)
  instead of calling the structured tool. Also reinforces FM-3.3 prevention:
  verify deliverables exist before calling finish().
version: 1.0.0
owner: coach
---

# Tool-Interface Protocol: Native Calls, Not Bash

## When to Apply

Apply this skill **every time you need to save progress or complete a task**.
Specific triggers:

- **When you want to checkpoint**: You have completed a significant step and
  want to save progress. Call `checkpoint()` as a TOOL, not via bash.
- **When you want to finish**: You are done with your task. Call `finish()`
  as a TOOL, not via bash.
- **When you want to call another agent**: Use `agents()` as a TOOL.

**The rule is absolute**: `checkpoint`, `finish`, and `agents` are tool
interfaces. They are NOT shell commands. They do NOT exist in `$PATH`.
Running them via `bash()` will always fail with "command not found" (exit 127).

## Why This Matters

From analysis of 5+ production sessions, bob repeatedly does this:

```
bash("checkpoint --summary 'completed step X'")
→ exit code 127: "checkpoint: command not found"
```

Then retries with variations:
```
bash("checkpoint '{\"summary\": \"...\"}'" )
→ exit code 127 again
```

Each failed attempt wastes a tool call and the progress is never saved.
The correct call takes one tool call and always works.

## Steps

### Step 1: RECOGNIZE which tools are native interfaces

Your tool list includes these native-interface tools:
- `checkpoint` — saves progress mid-session
- `finish` — signals task completion
- `agents` — coordinates with other agents

These tools are called via the **tool interface** (structured parameters),
exactly like `read()`, `write()`, `edit()`, and `bash()`.

### Step 2: USE the correct call syntax

**checkpoint** — save progress:
```
checkpoint({
  summary: "Brief description of what was accomplished",
  data: {
    files_modified: ["path/to/file1", "path/to/file2"],
    decisions: ["key decision 1", "key decision 2"],
    next_steps: ["what to do next"]
  }
})
```

**finish** — complete the task:
```
finish({
  status: "success",
  summary: "What was accomplished",
  deliverables: [
    { path: "path/to/file", description: "What changed" }
  ]
})
```

**agents** — call/send to other agents:
```
agents({
  action: "message",
  agent: "tech-lead",
  message: "Please implement X"
})
```

### Step 3: NEVER run these as bash commands

These are all WRONG and will always fail:
- ❌ `bash("checkpoint ...")`
- ❌ `bash("finish ...")`  
- ❌ `bash("agents ...")`
- ❌ `bash("echo '...' | checkpoint")`

### Step 4: VERIFY deliverables before finish()

Before calling `finish()` with deliverables, verify each file exists and
contains what you claim:

```
read("path/to/claimed/deliverable")  // Confirm it exists and has expected content
→ THEN finish({ deliverables: [{ path: "path/to/claimed/deliverable", ... }] })
```

Never claim a file as a deliverable without reading it back first.

## Assertions

1. The agent NEVER calls `bash()` with `checkpoint`, `finish`, or `agents`
   as the command — these are always called as native tool interfaces.

2. Before every `finish()` call that lists deliverables, the agent has a
   `read()` or `bash("cat ...")` output from this session confirming each
   deliverable file exists and contains the claimed content.

3. When a tool call fails with "command not found" (exit 127), the agent
   recognizes this means it tried to use a native tool via bash and
   immediately switches to the correct tool interface — it does NOT retry
   via bash with different arguments.

## Anti-Patterns

### AP-1: Bash Habit ("Everything runs in the shell")
**Pattern**: Agent treats all operations as shell commands. When it needs to
checkpoint, it runs `bash("checkpoint --summary '...'")`. Fails with exit 127.
Agent then tries different argument formats, all still via bash. All fail.

**Cost**: 2-5 wasted tool calls per occurrence. Progress is never saved.

**Fix**: Recognize that `checkpoint`, `finish`, and `agents` are structured
tool interfaces, not CLI commands. Call them directly.

### AP-2: Phantom Deliverable ("I wrote it, trust me")
**Pattern**: Agent calls `finish({ deliverables: [{ path: "workspace/report.md" }] })`
but never actually wrote `workspace/report.md`, or wrote it to the wrong path.

**Cost**: Task appears complete but deliverable is missing. Downstream agents
or reviewers find nothing.

**Fix**: Step 4 — read back every deliverable before claiming it in finish().
