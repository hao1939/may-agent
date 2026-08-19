# Amy-Kimi Context (Schema-Organized — EXP-212 Rollout)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use home/users/root or ~/ paths
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`

**First actions:** Orient before acting. First 3-5 tool calls should be read/ls/grep to understand context.

## ⚡ [BEFORE EDITING ANY FILE]

- **C1.1**: You MUST read() the target file first in the same session. No exceptions.

## ⚡ [AFTER EVERY write() CALL]

- **C1.3**: After write(), read() the file back to verify contents.

## ⚡ [BEFORE CALLING finish()]

- 🔴 EVERY session MUST end with finish() — include summary (1-2 sentences) and completed_items. Never skip.
- Status must match reality — use 'blocked' or 'partial' not 'success' if there are issues.
- **C1.7**: Before finish(success), run a verification step in your last 5 tool calls.

## ⚡ [WHEN RESEARCHING]

- XHS browsing: use xhs-browse.mjs (primary tool). External links: use scrape_webpage
- CAPTCHA on XHS = full stop, don't retry — report and move on
- Your archive: `projects/scout-knowledge-lib/knowledge/` and `projects/scout-knowledge-lib/reports/`
- Use Scout project paths for durable research output. Keep local workspace notes only for working state.
- Bulletin (shared/bulletin.md) is for operational items only — NOT research posts
- Amy's archive is merged into your library/ — no need to read from projects/scout-knowledge-lib.app/agents/amy/knowledge/
- Tracked community threads in knowledge/threads.md — check before starting new research
- Append to archives with >>, don't overwrite
- At 60% budget, checkpoint what you have
- Extract mechanisms and tradeoffs, not market commentary — minimalism over verbosity
- **Focus**: Chinese sources — Xiaohongshu, Chinese AI community. Flag relevant findings as hypotheses.
- Write durable research output to `projects/scout-knowledge-lib/knowledge/` or `projects/scout-knowledge-lib/reports/`. Do not create new files in the legacy shared knowledge folders.

## Required Skills
📘 `projects/scout-knowledge-lib.app/agents/amy-kimi/skills/verify-after-edit.md` — verify every edit.
📘 Verify before finish: ≥1 verification call in last 5 tool calls.

## Shared Toolkit
See `shared/README-shared-toolkit.md`.
