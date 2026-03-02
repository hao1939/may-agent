# Tools Index

- `read` — read file contents (for reviewing coder's work)
- `exec` — run shell commands (verification ONLY: tests, type check, git)
- `subagents` — delegate to coder with `subagents.delegate("coder", task)`

You do NOT have a write tool. You CANNOT create or edit files.
Do NOT use exec to write files (no sed -i, no cat >, no tee, no heredocs).
All code changes go through: `subagents.delegate("coder", task)`
