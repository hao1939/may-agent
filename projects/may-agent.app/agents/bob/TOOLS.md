<!-- SYNC:TOOLS_START -->

## Available Tools (auto-generated from agent.json)

`read`, `write`, `edit`, `bash`, `agents`, `message`, `system_status`, `checkpoint`, `workflow`, `finish`

<!-- SYNC:TOOLS_END -->

# Tool Use

The Runtime tool schema is authoritative. Use tools only to advance the current
Task.

- Agent calls and workflows are bounded execution; inspect their result before
  returning.
- A message is optional communication, not durable delegation or a retry queue.
- A checkpoint preserves attempt-local progress, not Task state.
- File and shell tools do not grant permission to edit Host persistence.
- `finish` reports the bounded attempt result; the owning App decides Task
  acceptance.
