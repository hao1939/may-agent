# Scout — Coaching (Lessons from OpenClaw)

These are patterns learned from Scout's 17+ runs in the OpenClaw system.

## #1 — Grep Before Adding

Always `grep discoveries.md` for the repo/paper name before adding. Duplicates waste everyone's time.

## #2 — Don't Re-read Large Files in Full

Use `grep` for dedup checks, `tail` for recent entries. Reading all of discoveries.md (3000+ lines) eats your entire token budget.

## #3 — arXiv is the Best Source

Consistently high-signal. Broad query → get IDs → `arxiv.org/abs/<id>` for full abstract. Feb 2026 papers use `2602.XXXXX` format.

## #4 — GitHub Trending: Weekly > Daily

Daily is dominated by viral non-agent repos. Weekly view filters better. But direct repo URL search is more reliable for depth.

## #5 — Follow the Thread

If a GitHub repo references a paper, fetch the paper. If a blog mentions a project, check the repo. If an author has multiple relevant papers, follow their work. Single-hop searches miss the best stuff.

## #6 — Commit at 60% Budget

At 60% of your time/turn budget, commit what you have. Timeout losses are real — Scout lost findings multiple times by going too deep without saving.

## #7 — Token Efficiency

discoveries.md will grow large. Don't read it in full for dedup — use grep. Don't re-read files already in context. Track token usage and stop when heavy.

## #8 — Dead Sources (don't waste time)

- Twitter/X — requires JavaScript, blocked via curl
- Google DeepMind blog — redirects, returns single headline
- GitHub blob/ URLs — redirect to login page
- Conference proceedings (AAAI login, AAMAS domain) — not publicly accessible

## #9 — What Makes a Good Discovery Entry

**Bad:** "Found a repo about agents. 500 stars."
**Good:** "SkillOrchestra (2602.19672) — skill-aware multi-agent routing. 22.5% over SOTA RL orchestrators at 700x lower cost. Connects to: our agent delegation could use skill-matching instead of fixed routing."

Every entry must answer: what is it, why it matters, how it connects to what we care about.

## #10 — Source Rotation

Don't hit the same source every run. Rotate between GitHub, arXiv, Reddit, vendor blogs, and HuggingFace. Each has different signal strength at different times.

## #11 — Your Files Are in agents/scout/

Your knowledge files are at `agents/scout/knowledge/`, NOT `knowledge/` or `/home/user/knowledge/`. If a read fails with ENOENT, try the agent-prefixed path. Your workspace is `agents/scout/workspace/`.

## #12 — State What Failed Before Falling Back

When a REQUIRED source fails, state what you tried, what failed, and what fallback you're using — BEFORE presenting results. Don't silently skip a source and pretend everything went fine.

## #13 — Your Write Scope

Your write scope is `agents/scout/knowledge/` and `agents/scout/workspace/`, not `knowledge/` at project root. Always use the full project-relative path: `agents/scout/knowledge/library/discoveries.md`, not just `knowledge/discoveries.md`. Reference files (discoveries, repos, papers, people, reddit) live in `knowledge/library/`.
