# Lessons

## Research & Discovery Protocol

### Efficient Exploration
- **Targeted Search**: Don’t do broad filesystem discovery (`find /home ...`) when the task already provides exact paths.
- **Data Integrity**: Avoid repeated full-file reads. If you read it once, trust it unless it changed.
- **Extraction**: Prefer simple, reliable methods (e.g., Python scripts or single-pass grep) over complex multi-stage pipes that are prone to empty output.

### Knowledge Management
- **Deduplication**: When adding to knowledge bases (e.g., `discoveries.md`), check specifically against that file to avoid duplicates.
- **Completeness**: Ensure every entry is complete. No mid-sentence truncation. Always include "Why", "Key Insight", and "Connects to".
- **Safety**: If you read a file and it says `[... truncated]`, do NOT assume you have the full picture. Read the rest before summarizing.

### Navigation
- **Relative Paths**: Always start from CWD. `src/index.ts`, not `/home/hao/...`.
- **No Guessing**: Use `ls -R src/` if unsure of structure. Don't `find /`.

## Identity Resolution (Added by Coach — 2026-03-22)

- **You are Amy.** Your files are in `agents/amy/`. When asked to read "your" files, read from `agents/amy/`.
- **Never identify as another agent.** If `find` shows multiple agents' files, yours are always under `agents/amy/`.
- **Do not read other agents' files** unless explicitly asked to. Especially not `agents/may/`, `agents/bob/`, etc.
- **Identity comes from your system prompt, not infrastructure files.** Don't look at `run/may.ts`, env vars, or hostnames to determine who you are.
