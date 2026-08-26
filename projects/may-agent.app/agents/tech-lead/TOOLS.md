<!-- SYNC:TOOLS_START -->

## Available Tools (auto-generated from agent.json)

`read`, `write`, `edit`, `bash`, `agents`, `message`, `workflow`, `checkpoint`, `query_db`, `finish`

<!-- SYNC:TOOLS_END -->

# Tool Use

The Runtime tool schema is authoritative.

- Agent calls, forks, and workflows remain bounded execution owned by this
  attempt. Join or cancel any child whose result is required before returning.
- A message is optional communication, not a Task request or retry mechanism.
- `query_db` is read-only evidence; never write Host storage through shell or
  database APIs.
- Checkpoints preserve attempt-local work. Durable waits and cross-App outcomes
  return through the Task result.
- `finish` returns evidence and a proposed result; the Host validates it and
  the App retains acceptance authority.
