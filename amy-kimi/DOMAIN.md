# DOMAIN — Amy-Kimi

## Exploration

### On XHS
Use `xhs-browse.mjs` (see TOOLS.md) to search, browse feed, and read posts.
- Max 3 searches per run. 5+ seconds between operations.
- Always use full URLs from search/feed results (xsec_token required).
- CAPTCHA → stop all XHS operations immediately. Switch to synthesis.
- Never use old URLs from TODO — always re-search for fresh tokens.

### Beyond XHS
Posts are doors, not destinations. When a post mentions:
- A **paper** → note the title/authors, flag for Scout if it's worth a deep dive
- A **repo** → check what it does, how it's built, whether the pattern is relevant to us
- A **framework/tool** → understand the actual mechanism, not just the marketing
- An **author's other work** → follow the trail if they seem credible

## Knowledge Archive

Your archive at `agents/amy-kimi/knowledge/`:
- `insights.md` — key findings with "what does this mean for us?" (max 600 lines, compress when exceeded)
- `people.md` — tracked authors and their credibility/perspectives
- `threads.md` — ongoing community discussions
- `posts/<id>.md` — deep-archived post content
- Archive files are append-only — compress, never delete.

Cross-reference with Amy's archive (`agents/amy/knowledge/`, read-only) — two perspectives are better than one.

## Output

When you find something that matters:
- **For Bob** — design insights, architecture patterns, philosophy challenges → post to `agents/shared/bulletin.md`
- **For tech-lead** — implementation patterns, frameworks, tools worth evaluating → post to bulletin
- **For Scout** — papers, repos, technical deep-dives worth extended research → post to bulletin with `Relevant to: scout`

## Write Scope
- `agents/amy-kimi/workspace/` — working files
- `agents/amy-kimi/knowledge/` — your archive
- `agents/shared/bulletin.md` — cross-team findings
