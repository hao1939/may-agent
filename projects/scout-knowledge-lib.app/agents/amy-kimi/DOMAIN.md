# DOMAIN — Amy-Kimi

## Exploration

### On XHS (xhs-browse.mjs)
Use `xhs-browse.mjs` via bash (see TOOLS.md) to search, browse feed, and read posts.
- Max 3 searches per run. 5+ seconds between operations.
- Always use full URLs from search/feed results (xsec_token required).
- CAPTCHA → stop all XHS operations immediately. Switch to synthesis or external links.
- Never use old URLs from TODO — always re-search for fresh tokens.

### Beyond XHS (scrape_webpage)
Posts are doors, not destinations. When a post mentions:
- A **paper** → use `scrape_webpage` to fetch it (arXiv, conference sites)
- A **repo** → use `scrape_webpage` to check what it does, how it's built
- A **framework/tool** → use `scrape_webpage` to read the actual docs, not just the marketing
- An **author's other work** → follow the trail if they seem credible

## Knowledge Archive

Your archive at `projects/scout-knowledge-lib.app/agents/amy-kimi/knowledge/`:
- `insights.md` — your current findings (max 600 lines, compress when exceeded)
- `threads.md` — ongoing community discussions
- `library/posts/` — 1046 archived post analyses (yours + Amy's merged)
- `library/people.md` — your tracked authors
- `library/people-amy.md` — Amy's tracked authors (merged reference)
- `library/openclaw-mentions.md` — your OpenClaw mentions
- `library/openclaw-mentions-amy.md` — Amy's OpenClaw mentions (merged reference)
- `library/amy-insights-current.md` — Amy's latest insights (snapshot)
- `library/amy-journal.md` — Amy's exploration journal (snapshot)
- `library/amy-favorites-manifest.json` — Amy's favorites index
- `library/insights-archive-*.md` — 91 insight archives (yours + Amy's merged)
- `library/deep-dives/` — deep analysis documents
- Archive files are append-only — compress, never delete.

Amy's full archive has been merged into your `library/`. Use `grep` to search across the combined posts and insight archives — no need to read from `projects/scout-knowledge-lib.app/agents/amy/knowledge/`.

## Output

When you find something that matters:
- **For Bob** — design insights, architecture patterns, philosophy challenges → post to `shared/bulletin.md`
- **For tech-lead** — implementation patterns, frameworks, tools worth evaluating → post to bulletin
- **For Scout** — papers, repos, technical deep-dives worth extended research → post to bulletin with `Relevant to: scout`

## Write Scope
- `projects/scout-knowledge-lib.app/agents/amy-kimi/workspace/` — working files
- `projects/scout-knowledge-lib.app/agents/amy-kimi/knowledge/` — your archive
- `shared/bulletin.md` — cross-team findings
