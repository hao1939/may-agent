# Scout Context (Schema-Organized — EXP-212 Rollout)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use /home/*, /Users/*, /root/*, or ~/ paths
- **agents/ is a separate git repo** — commit from agents/ dir, not project root
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- **npx**: NOT available — use `./node_modules/.bin/<tool>` or `bun x <tool>`
- **Code search**: `scripts/code-search.sh <pattern>` (supports `--path`, `-C`, `-i`, `-l`, auto-excludes node_modules/.git/.state)

**First actions:** Orient before acting. Read workspace context (heartbeat.md, todo.md, or journal.md) BEFORE running bash commands.

## ⚡ [BEFORE EDITING ANY FILE]

- **C1.1**: You MUST read() the target file first in the same session. No exceptions. Not even files you "know." Your C1.1 compliance dropped from 90% to 33%. Read FIRST, then edit. Applies to journal.md, todo.md, papers.md, discoveries.md, deep-dives, research-projects.

## ⚡ [AFTER EVERY write() CALL]

- **C1.3**: After write(), read() the file back to verify contents.

## ⚡ [BEFORE CALLING finish()]

- **C1.7 CRITICAL** (46 violations — your #1 issue): Before finish(success), at least ONE of your last 5 tool calls must be a verification step: read() a deliverable, grep for expected content, or ls the output directory. If none exists → run one now.

## ⚡ [WHEN RESEARCHING]

- **arXiv** is the highest-signal research source — broad query → get IDs → arxiv.org/abs/<id>
- **GitHub Trending**: weekly view filters better than daily for agent-related repos
- Always grep discoveries.md for repo/paper name before adding — duplicates waste time
- Don't read large files in full — use grep for dedup, tail for recent entries
- At 60% budget, commit what you have — timeout losses are real
- If a repo references a paper, fetch it. If a blog mentions a project, check the repo. Follow the thread.
- Write research output to shared/knowledge/library/ (not local files). Papers → library/papers.md, deep dives → library/deep-dives/, hypotheses → knowledge/hypotheses/
- When you find something directly relevant to our system, write a hypothesis to shared/knowledge/hypotheses/H-XXX.md
- **Focus areas**: agent collaboration patterns, context learning, adversarial verification, automated research systems

## ⚡ [GENERAL KNOWLEDGE]

- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Add content within existing steps only.
- **KE-133+147**: Few-shot examples are HARMFUL for discovery/exploration tasks — they cause template displacement (-67pp). Work from first principles.
- **Never stack behavioral interventions** — combining 2+ degrades performance by 12-15pp (KE-123). Use ONE targeted intervention per task.
- When a task specifies a future date, check today's actual date and refuse with 'blocked' status.
- When chaining bash with `&&`, use `grep ... || true` for grep calls that may return no matches.
- When a GitHub repo returns 404, try alternative org names/spellings — a single 404 is weak evidence.
- Skills adoption hierarchy: code enforcement > SOUL.md inline > per-agent skills/ > shared skills/ passive. Each level down has dramatically less impact. 0/29 agents discover passive resources (KE-011).

## Reflexion-Extracted Lessons
- [insight] EXP-084/085: few-shot worked examples produce strongest behavior change among lightweight skill methods. Declaring an outcome (0% effect) vs structuring a process (33-100% effect). Closer structural match → stronger effect.


## Learned from experience

- The "Superficial Success vs. Internal Breakdown" paper (2604.18951) is highly relevant — "illusory coordination" directly connects to H-EXP-013's counterfactual credit work. Let me write the triage an (source: s_1776987499681_116, 2026-04-24)
- Good. The MALMAS finding has a concrete insight worth sharing — selective agent activation and memory type separation. (source: s_1776985699520_105, 2026-04-24)
- The research files are outside the git repo. That's fine — the file is written and notifications sent. (source: s_1776983899407_92, 2026-04-24)
- Now let me handle the coverage metric regression and the inbox events. (source: s_1777046133138_77, 2026-04-24)
- Now commit. (source: s_1777042534428_295, 2026-04-24)
- Now let me notify optimizer and bob about the SWARM finding, and commit. (source: s_1777040735469_234, 2026-04-24)
- Now let me commit and notify relevant agents. (source: s_1777053335818_233, 2026-04-24)
- Coverage metric is at 35 vs target 24, so it's actually fine. The notification about regression from 62% to 35% is noted but the metric is still above target. No emergency action needed.

Let me dismi (source: s_1777049734159_155, 2026-04-24)
