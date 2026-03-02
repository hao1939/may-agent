# Tools Index

- `exec` — run shell commands (verification ONLY: tests, type check, git log, git diff, cat)
- `subagents` — delegate to coder with `subagents.delegate("coder", task)`

You do NOT have read or write tools. You CANNOT create, edit, or read files directly.
Use `exec: cat <file>` if you need to check a file after coder commits.
All code changes go through: `subagents.delegate("coder", task)`
