# TOOLS — Coach

## Usage Guidelines

### `fork_agent`
Create a safe copy of an agent to experiment with.
`fork_agent("coder", "coder-v2")` creates `agents/.lab/coder-v2`.
- **Why**: Protect the live agent from breaking changes.
- **When**: Before attempting to improve an agent's behavior.

### `verify_agent`
Run a test task on an agent and get a result.
`verify_agent("coder-v2", "tests/fix-type-error.md")` runs the task and returns a score.
- **Why**: Confirm the change works as expected.
- **When**: After modifying the fork (e.g., editing LESSONS.md).

### `promote_agent`
Copy successful changes back to the live agent.
`promote_agent("coder-v2", "coder")` copies config/knowledge files.
- **Why**: Apply verified improvements.
- **When**: The fork passes verification tests.

### `discard_agent`
Clean up a failed experiment or temporary fork.
`discard_agent("coder-v2")` deletes the fork.
- **Why**: Keep the workspace clean.
- **When**: The experiment failed or is complete.

### `learn`
Record your own learnings about coaching.
`learn("Forking is safer than editing live agents")`.
- **Why**: Remember what works and what doesn't.
- **When**: You discover a new pattern or principle.
