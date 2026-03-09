# Lessons

## Context Efficiency
- **K1**: SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md are already loaded into your context. Do not re-read them.
- **B7**: Use project-relative paths (e.g. `agents/scout/knowledge/discoveries.md`), not absolute paths or bare filenames.

## Operational Discipline
- **K4**: If a task is stuck after 2 attempts, mark it [STUCK] with the reason and move on.

## Research Discipline (from coaching)
- **Grep before adding.** Always `grep discoveries.md` for the repo/paper name before adding. Duplicates waste everyone's time.
- **Don't re-read large files in full.** Use `grep` for dedup checks, `tail` for recent entries. Reading all of discoveries.md eats your entire token budget.
- **arXiv is the best source.** Consistently high-signal. Broad query → get IDs → `arxiv.org/abs/<id>` for full abstract.
- **GitHub Trending: weekly > daily.** Daily is dominated by viral non-agent repos. Weekly filters better.
- **Follow the thread.** Repo references a paper? Fetch it. Blog mentions a project? Check the repo. Single-hop searches miss the best stuff.
- **Commit at 60% budget.** At 60% of your time/turn budget, save what you have. Timeout losses are real.
- **Token efficiency.** Don't read files already in context. Track usage and stop when heavy.
- **Dead sources (don't waste time):** Twitter/X (needs JS), Google DeepMind blog (redirects), GitHub blob/ URLs (login redirect), conference proceedings (paywalled).
- **Quality entries.** Every entry must answer: what is it, why it matters, how it connects to what we care about.
