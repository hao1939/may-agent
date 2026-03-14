# Design: Inter-Agent Handoff Protocol (The Cache Layer)

## Context
We recently established **P72 Memory as Architecture**, identifying three layers of agent memory:
1. **I/O (Context)**: The active, hot context of the current session. Expensive, ephemeral.
2. **Cache (Handoff)**: The structured artifacts passed *between* agents.
3. **Memory (Storage)**: The long-term persistence (files).

Currently, we lack a formal standard for Layer 2 (Cache). Agents often dump entire file contents into the chat (polluting Layer 1) or vaguely point to "the file" without specifics.

## The Problem: "Context Dumping"
When Agent A calls Agent B, Agent A often pastes 500 lines of code into the prompt.
- **Cost**: Burns tokens.
- **Drift**: The pasted code is a snapshot, not truth. If B edits the file, A's context is stale.
- **Confusion**: B doesn't know *why* it has the code.

## The Solution: The Handoff Object
A standardized JSON structure passed in the `task` argument of `agents.call(agent, task)`.

### Structure
Instead of free text, the `task` string should follow a schema (or at least a rigorous convention).

```json
{
  "intent": "Why am I calling you?",
  "pointers": [
    {
      "path": "agents/coder/target.ts",
      "line_start": 10,
      "line_end": 50,
      "note": "The function to refactor"
    }
  ],
  "constraints": [
    "Do not change the function signature",
    "Must pass existing tests"
  ],
  "artifact_location": "agents/bob/workspace/handoffs/request-id.md"
}
```

### Protocol Rules

1. **Pointer over Payload**: Never paste file content if a path works. The recipient must `read` the truth from disk.
2. **Explicit Intent**: The recipient must know *why* they are reading the file.
3. **Artifact Return**: The result isn't "I done it" in chat. It is "I wrote the result to `path`".

## Implementation Plan
1. **Define Convention**: Update `agents/shared/best-practices.md` with the "Handoff Protocol".
2. **Pattern**: "Write-Handoff-Read".
   - Caller writes context to a temp file (if complex) or defines clear paths.
   - Caller sends pointer.
   - Callee reads pointer, does work, writes result.
   - Callee returns pointer to result.

## Philosophy Check
- **P1 Simplest Thing**: JSON overhead might be too much for simple chats.
- **Refinement**: The *principle* is "Pointer over Payload". The *implementation* can be natural language, but must follow the structure.

**Revised Standard (Natural Language)**:
"I need you to [intent]. Context is in [path]. Constraints are [X, Y]. Write output to [out-path]."

This is sufficient. We don't need a rigid JSON schema yet (P9 Explore Then Harden). We need a *behavioral* standard.

## Action
Update `agents/shared/best-practices.md` with the "Pointer Protocol".
