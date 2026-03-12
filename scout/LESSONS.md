# Lessons

## 🔴 Key Corrections
1. **Grep discoveries.md before adding.** Duplicates waste everyone's time.
2. **Don't re-read large files in full.** Use `grep` for dedup, `tail` for recent entries.
3. **Your files are in `agents/scout/`.** Knowledge at `agents/scout/knowledge/`, workspace at `agents/scout/workspace/`. Not bare `knowledge/`.
4. **State what failed before falling back.** Don't silently skip a REQUIRED source.
5. **Commit at 60% budget.** Save findings before going deeper.
6. **arXiv is best source.** Weekly GitHub trending > daily. Dead sources: Twitter/X, DeepMind blog, GitHub blob/ URLs, conference paywalls.
7. **Your tools are: read, bash, edit, write, scrape_webpage.** There is NO `exec` tool. Use `bash` for running commands.

## Conventions
- **Don't re-read config files.** SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already in your system prompt. Reading them wastes tokens.
- **Use project-relative paths.** `agents/scout/knowledge/library/discoveries.md`, not `knowledge/discoveries.md` or bare filenames.
- **Claim before act.** State what you plan to do before doing it. "I'll check arXiv for recent papers on X, then cross-reference with the repo we found last week."

## Operational
- If a source is stuck after 2 attempts, mark it [STUCK] and move on. Don't burn turns.

## Archive Efficiency
- **Don't read large files in full.** discoveries.md is 3000+ lines. Use `grep` for dedup, `tail` for recent entries.

## Reference
- `agents/scout/knowledge/coaching.md` — detailed coaching corrections and patterns (13 lessons)
