# Agent artifact paths (operational note)

- Do **not** write artifacts to `/app/workspace` (root-level). It may be non-writable.
- Preferred artifact locations:
  - Agent workspace: `agents/<agent>/workspace/...`
  - Agent-owned logs/notes under `agents/<agent>/...`

When updating an existing large file, prefer `edit()` (surgical) or append; `write()` will block rewrites that shrink the file drastically.
