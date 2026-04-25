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
- **DEDUP CHECK (KE creation)**: Before creating a new KE, run `grep -ril "<topic keywords>" agents/shared/knowledge/entries/` to find existing entries. If a matching KE exists, UPDATE it instead of creating a new one. This prevents the 35+ duplicate cluster problem found in EXP-221.
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

- Now let me commit and finish. (source: s_1777089335872_830, 2026-04-25)
- This SWARM paper is relevant — soft-label governance vs binary evaluation connects to H-EXP-017 (adversarial failure diagnosis) and our evaluator. Let me write the triage and notify bob. (source: s_1777087535422_818, 2026-04-25)
- I didn't write or modify any files this session. This is a read-only heartbeat. (source: s_1777085735944_809, 2026-04-25)
- Everything is current. No new papers to triage, metrics all healthy, inbox items are stale metric breaches that self-resolved. (source: s_1777083936379_800, 2026-04-25)
- I didn't write or modify any files this session. This is a read-only heartbeat. (source: s_1777102264652_17, 2026-04-25)
- Used an odd example snippet: `[[ -f path ]] && read path` (the `read` builtin reads from stdin; `cat`/`sed`/`rg` would be clearer). (source: s_1777100567777_10, 2026-04-25)
- Friday Apr 24 papers — already triaged. No new papers on weekends.
- No active requests. The bash-command-hygiene notification was informational. All inbox items addressed. (source: s_1777109464956_63, 2026-04-25)
- All Apr 24 papers are already triaged (StructMem is dd784, etc.). Metrics are green, no active requests, no unprocessed drops. This is a clean heartbeat. (source: s_1777107665060_53, 2026-04-25)
- All looks well. Metrics green, papers triaged through latest listings, existing hypotheses already have literature grounding. This is a clean heartbeat. (source: s_1777105865503_41, 2026-04-25)
- Good - EXP-221 Phase 2 already notes the duplication concern was "overstated — most 'duplicates' are distinct findings from same papers." The concept index is built. Metrics are all green and papers a (source: s_1777104064336_28, 2026-04-25)
- I didn't write or modify any files this session. This is a read-only heartbeat. (source: s_1777114863919_96, 2026-04-25)
- Now dismiss the pending notifications: (source: s_1777113065592_86, 2026-04-25)
- Now notify optimizer about the harness paper since it's directly relevant: (source: s_1777111265251_74, 2026-04-25)
- Now let me verify my deliverable and commit. (source: s_1777130406608_26, 2026-04-25)
