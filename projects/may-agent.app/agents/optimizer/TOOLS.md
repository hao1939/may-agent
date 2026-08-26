<!-- SYNC:TOOLS_START -->

## Available Tools (auto-generated from agent.json)

`read`, `write`, `edit`, `bash`, `agents`, `message`, `workflow`, `checkpoint`, `finish`

<!-- SYNC:TOOLS_END -->

# Tool Use

The Runtime tool schema is authoritative.

- Agent calls and workflows provide bounded evidence or implementation
  capacity; they do not create durable ownership.
- Messages are optional communication and cannot carry required follow-up.
- Use repository-declared checks through the supplied coding/shell tools.
- Never edit Runtime databases, Task rows, request rows, or Event rows directly.
- A checkpoint is attempt-local evidence. `finish` returns the attempt result
  to the owning App.
