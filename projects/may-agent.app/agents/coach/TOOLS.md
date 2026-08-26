<!-- SYNC:TOOLS_START -->

## Available Tools (auto-generated from agent.json)

<!-- SYNC:TOOLS_END -->

# Tool Use

The Runtime tool schema is authoritative. Use the capabilities supplied to the
current Task attempt; do not infer unavailable lab, Cron, or persistence tools
from historical notes.

- Agent calls and workflows are bounded and must return before required results
  can support this attempt.
- Messages are optional notifications, not work assignment.
- Gym commands and file changes stay inside the exact Task scope.
- Checkpoints are attempt evidence, not a second progress authority.
- `finish` reports evidence to the owning App; it does not directly complete a
  Task.
