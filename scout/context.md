# Scout Context (Schema-Organized — EXP-212 Rollout)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use /home/*, /Users/*, /root/*, or ~/ paths
- **agents/ is a separate git repo** — commit from agents/ dir, not project root
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- **npx**: NOT available — use `./node_modules/.bin/<tool>` or `bun x <tool>`
- **Code search**: `scripts/code-search.sh <pattern>` (supports `--path`, `-C`, `-i`, `-l`, auto-excludes node_modules/.git/.state)

**First actions:** Orient before acting. Read workspace context (heartbeat.md, todo.md, or journal.md) BEFORE running bash commands.

## ⚡ [BUDGET DISCIPLINE — YOUR #1 FAILURE MODE]

- **Turn 1-3**: Create your output file (DD, CR, or analysis) as a skeleton — title, ID, initial notes. An imperfect file beats no file.
- **At 50% budget**: STOP researching. Write up what you have NOW. Finalize and commit.
- **At 75% budget**: You MUST be in finish() within 2 tool calls. If not, finish(partial) immediately with what you have.

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
- Budget discipline rules are in ⚡ BUDGET DISCIPLINE section above — follow those.
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


## Active Skills


📘 **Baseline-Before-Change**: Read `agents/shared/skills/baseline-before-change/SKILL.md` — verify preconditions before every `edit()`, `write()`, or destructive `bash` command.



## Required Skills
📘 Read `agents/scout/skills/evidence-over-narrative.md` — cite evidence, not assumptions.
📘 Read `agents/scout/skills/find-before-read.md` — search before reading files.
📘 Read `agents/scout/skills/knowledge-dedup-check.md` — check for duplicates before writing.
📘 Read `agents/scout/skills/materialize-findings-concise.md` — concise finding format.
📘 Read `agents/scout/skills/read-before-edit.md` — always read before editing.
📘 Read `agents/scout/skills/search-governance.md` — search protocol governance.
📘 Read `agents/scout/skills/verify-after-edit.md` — verify every edit took effect.
📘 Read `agents/scout/skills/verify-before-finish.md` — **MANDATORY**: before `finish(success)`, your last 5 tool calls MUST include a read/grep/ls verification proving your work is correct.
📘 Read `agents/scout/skills/verify-quantitative-claims.md` — verify numbers before citing.

## Learned from experience

- Friday Apr 24 papers — already triaged. No new papers on weekends.

(cleaned 2026-04-28 — 14 auto-generated entries were session monologue, not durable knowledge)


## When finish() is blocked for verification (EXP-207)

If finish() rejects your verification_evidence:
1. Re-read your actual tool outputs from this session
2. If you genuinely cannot find evidence: call finish(status="partial", next_steps="Verification incomplete — need to re-verify [specific deliverable]")
3. Do NOT invent or rephrase evidence — partial is better than fabricated
4. It is OK to finish with status="partial". This is not failure.

## Shared Toolkit
Shared utilities available at `agents/shared/lib/` — see `agents/shared/README-shared-toolkit.md` for all scripts and library modules (task-validator, iteration-monitor, regression-detector, project-template, session-analyzer, config-validator, workflow-metrics, etc.).
