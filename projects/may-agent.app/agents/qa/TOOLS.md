<!-- SYNC:TOOLS_START -->

## Available Tools (auto-generated from agent.json)

`read`, `write`, `edit`, `bash`, `workflow`, `checkpoint`, `finish`

<!-- SYNC:TOOLS_END -->

# Tool Use

The Runtime tool schema is authoritative; do not rely on historical references
to tools absent from the generated list.

Read exact source, run the target repository's checks, and use workflows only
for bounded review steps whose result is required now. Checkpoints preserve
attempt-local evidence. `finish` returns a verdict to the owning App and does
not itself accept the Task.
