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
