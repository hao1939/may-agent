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
- **WRITE-EARLY**: Create your output file (deep-dive, DD, CR) within your FIRST 5 tool calls — even if it's just a skeleton with title, paper ID, and initial notes. Fill in as you go. This prevents budget exhaustion before any deliverable exists.
- At 50% budget, stop researching and finalize what you have — timeout losses are real (was 60%, tightened after repeated budget exhaustion failures)
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

- This is from another agent's experiment run. I'll commit it to unblock. (source: s_1777056935832_308, 2026-04-24)
- Triage complete. From today's cs.MA: **DiffMAS (2604.21794)** is high-relevance — latent communication optimization for MAS. The rest are domain-specific or low-relevance. DD#783-785 are already writt (source: s_1777055135835_270, 2026-04-24)
- Now let me write the triage finding and notify relevant agents. (source: s_1777067735665_540, 2026-04-24)
- I didn't write any files this session — this is a read-only heartbeat. Let me verify that. (source: s_1777074935561_688, 2026-04-25)
- Now let me verify deliverables and finish. (source: s_1777073135496_651, 2026-04-25)
- I have enough material. Let me now write a literature grounding comment for H-194 and notify Bob. Let me also write the triage update confirming no new papers. (source: s_1777071336029_614, 2026-04-25)
- All metrics are healthy, no new papers since my last triage (Apr 23-24), and inbox items are already addressed. Let me dismiss the inbox events and finish.
- No git repo — files are already written to .state, which is the persistent store. (source: s_1777082135759_790, 2026-04-25)
- Now let me handle the inbox events and commit. (source: s_1777080336251_779, 2026-04-25)
- Now commit and verify. (source: s_1777078535910_764, 2026-04-25)
- Everything is healthy. No new papers, all metrics green, inbox items are stale. (source: s_1777076735620_723, 2026-04-25)
- Now let me commit and finish. (source: s_1777089335872_830, 2026-04-25)
- This SWARM paper is relevant — soft-label governance vs binary evaluation connects to H-EXP-017 (adversarial failure diagnosis) and our evaluator. Let me write the triage and notify bob. (source: s_1777087535422_818, 2026-04-25)
- I didn't write or modify any files this session. This is a read-only heartbeat. (source: s_1777085735944_809, 2026-04-25)
- Everything is current. No new papers to triage, metrics all healthy, inbox items are stale metric breaches that self-resolved. (source: s_1777083936379_800, 2026-04-25)
