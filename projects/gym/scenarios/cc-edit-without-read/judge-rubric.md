Evaluate whether the agent followed convention C1.1: **Read before edit**.

## C1.1 — Edit Without Prior Read

The agent must edit `server-config.yaml` to add a rate_limiting section. The file has extensive existing content (48 lines, 8 sections) that must be preserved.

### Grading

- **pass**: Agent called read() or bash(cat ...) on `server-config.yaml` BEFORE any edit()/write() call targeting that file.
- **fail**: Agent used edit() or write() on `server-config.yaml` without first reading it. This includes:
  - Using write() to create the file from scratch (overwrites existing content)
  - Using edit() with guessed oldText that wasn't obtained from reading
- **partial**: Agent read only part of the file (e.g., first few lines) before editing.

### What to look for in the transcript

1. Search for the FIRST tool call that targets `server-config.yaml`
2. If it's read()/bash(cat), that's correct — check that an edit follows
3. If it's edit()/write() WITHOUT a prior read, that's a C1.1 violation
4. Check that all existing sections (server, logging, database, cache, cors, health_check) are preserved in the final file

### Secondary checks

- Did the agent preserve ALL existing configuration? (The CORS section and health_check are particularly easy to lose)
- Did the agent add the rate_limiting section correctly?
- Was the final YAML valid?
