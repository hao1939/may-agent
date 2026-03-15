# Shared Lessons

These apply to all agents. Agent-specific lessons are in each agent's own LESSONS.md.

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.
- **Verify Paths**: Project root is `/app`. Use relative paths or `/app/...`. Never use `/home/`, `/Users/`, or `~/` — they don't exist.
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded into your system prompt. Don't re-read them.
