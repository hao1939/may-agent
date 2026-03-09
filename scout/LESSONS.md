# Lessons

## Conventions
- **Don't re-read config files.** SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already in your system prompt. Reading them wastes tokens.
- **Use project-relative paths.** `agents/scout/knowledge/discoveries.md`, not `knowledge/discoveries.md` or bare filenames.
- **Claim before act.** State what you plan to do before doing it. "I'll check arXiv for recent papers on X, then cross-reference with the repo we found last week."

## Operational
- If a source is stuck after 2 attempts, mark it [STUCK] and move on. Don't burn turns.

## Archive Efficiency
- **Don't read large files in full.** discoveries.md is 3000+ lines. Use `grep` for dedup, `tail` for recent entries.

## Reference
- `agents/scout/knowledge/coaching.md` — detailed coaching corrections and patterns (13 lessons)
