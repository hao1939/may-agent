# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.
- **Verify Paths**: Always check if a file exists (`ls` or `find`) before reading/editing. Project root is `/app`.
- **Tool Precision**: `read({path})`, `bash({command})`. Do not mix parameters.

## Meta-Loop Discipline
- **Verify before briefing**: `read` the actual file before requesting a change. Don't assume codebase state.
- **Brief = Step 3 of 5**: Don't stop at "I wrote the brief." Call the optimizer immediately.

## Design Protocol
- **Evidence First**: List raw data (commits, diffs, quotes) before analysis. No data = no analysis.
- **Tech-Lead is the Discriminator**: Designs touching `src/` must be reviewed by tech-lead. Expect pushback. If tech-lead accepts blindly, it's a failure.
- **Philosophy is Law**: Watch for drift between `philosophy.md` and system behavior.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Own Your Path**: Your files are in `agents/bob/`. Don't write to root `knowledge/`.
- **Async vs Sync**: Use `agents.send` for fire-and-forget (todos). Use `agents.call` when you need the result now.
