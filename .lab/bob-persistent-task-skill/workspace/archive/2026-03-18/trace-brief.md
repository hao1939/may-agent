# Synthesis: AgentTrace — Three-Layer Observability (Brief)

## Context
AgentTrace (arXiv:2602.10133) reveals that our "session.jsonl" is flattened, hiding crucial distinctions between:
1.  **Cognitive** (Intent): What the agent *thought* it would do.
2.  **Operational** (Action): What it *actually did* (Tool Call).
3.  **Contextual** (State): What it *knew* (Prompt, Memory).

## Problem
1.  **Mismatch Blindness**: We cannot distinguish "Hallucination" (Thought != Action) from "Execution Failure" (Action != Success).
2.  **Intent Overload**: We log too much reasoning text, confusing the operational signal.
3.  **State Invisible**: We don't log the *input state* (prompt context), only the output.

## Solution: Structured Log Schema
We need a v2 schema for `ERROR_LOG.jsonl` (and ideally all session logs) that explicitly separates these layers.

### Current (Implicit) Schema:
```json
{ "role": "assistant", "content": "Thought: check file... Tool Call: read(file)" }
```

### Proposed Schema (AgentTrace Compliant):
```json
{
  "timestamp": "2026-03-14T22:00:00Z",
  "layer_cognitive": {
    "thought": "I will check the file for errors.",
    "plan": ["read file", "grep error"]
  },
  "layer_operational": {
    "tool": "read",
    "args": { "path": "file.txt" },
    "result": "content...",
    "status": "success",
    "cost": "150ms"
  },
  "layer_contextual": {
    "prompt_tokens": 1500,
    "memory_state": "active_recall_triggered"
  }
}
```

## Action
Delegate to Evaluator to design this schema. We cannot change the runtime logging format immediately (Tech-Lead domain), but Evaluator can start *parsing* current logs into this structure for analysis.
If Evaluator finds it useful, we upgrade the runtime logger later.
