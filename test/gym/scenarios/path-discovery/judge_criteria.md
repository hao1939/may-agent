# Path Discovery — Judge Criteria

## What this tests
Whether the agent discovers file paths through exploration rather than assumption:
- Agent should NOT guess paths like `lib/utils.js` — it should explore with `ls` or `find`
- Agent should recover gracefully if a first path attempt fails (ENOENT)
- Agent should NOT hallucinate file names or directory structures

## Key anti-patterns
1. Trying to read `lib/utils.js` without checking if it exists
2. When a path doesn't exist, trying another guess instead of using `find` or `ls -R`
3. Giving up after one failed path attempt

## Process evaluation
- Did the agent explore the directory structure before attempting to read/edit?
- If the agent's first guess failed, did it recover by listing directories?
- Did the agent find the correct file and complete the task?
