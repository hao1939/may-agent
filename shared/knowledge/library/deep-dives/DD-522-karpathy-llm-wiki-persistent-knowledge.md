# DD#522: Karpathy LLM Wiki — Persistent Compiled Knowledge Bases

**Source:** https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
**Type:** Idea file / pattern description
**Date:** 2026-04-04
**Rating:** ★★★★★ CRITICAL
**Tags:** #knowledge-management #persistent-memory #wiki #context-engineering #rag-alternative

## TL;DR

Karpathy proposes "LLM Wiki" — instead of RAG (re-deriving knowledge per query), have the LLM incrementally build and maintain a persistent, interlinked wiki. Each new source triggers integration across 10-15 wiki pages. Knowledge is compiled once, not re-derived. "The wiki is a persistent, compounding artifact." This pattern is exactly what our Scout library system implements.

## Core Architecture

### Three Layers
1. **Raw Sources** — Immutable collection (papers, articles, data files). Source of truth. LLM reads, never modifies.
2. **The Wiki** — LLM-generated markdown files. Summaries, entity pages, concept pages, cross-references. LLM owns entirely. Human reads.
3. **The Schema** — Configuration (e.g., CLAUDE.md) telling the LLM how to maintain the wiki. Human + LLM co-evolve.

### Three Operations
1. **Ingest** — Drop source → LLM reads → writes summary → updates index → updates entity/concept pages. Single source may touch 10-15 pages. Can be supervised (one-at-a-time) or batch.
2. **Query** — Ask questions → LLM searches wiki pages → synthesizes answer with citations. Good answers get filed back into wiki (compounding!).
3. **Lint** — Health-check: find contradictions, stale claims, orphan pages, missing cross-references, data gaps. Wiki maintenance.

### Key Infrastructure
- **index.md** — Content-oriented catalog. Every page with link + one-line summary. LLM reads this first to navigate.
- **log.md** — Chronological record of operations. Append-only. Parseable with unix tools.
- **CLI tools** — Optional search engine (mentions qmd for hybrid BM25/vector search). At small scale, index is enough.

## The Core Insight

> "Most people's experience with LLMs and documents looks like RAG: you upload a collection of files, the LLM retrieves relevant chunks at query time, and generates an answer. This works, but the LLM is rediscovering knowledge from scratch on every question. There's no accumulation."

The alternative: **compiled knowledge**. Cross-references already exist. Contradictions already flagged. Synthesis already reflects everything. The wiki compounds with every source added and every question asked.

## Why It Works

> "The tedious part of maintaining a knowledge base is not the reading or the thinking — it's the bookkeeping. Updating cross-references, keeping summaries current, noting when new data contradicts old claims, maintaining consistency across dozens of pages. Humans abandon wikis because the maintenance burden grows faster than the value. LLMs don't get bored, don't forget to update a cross-reference, and can touch 15 files in one pass."

## Direct Mapping to Our System

| Karpathy LLM Wiki | Our Scout System |
|-------------------|------------------|
| Raw Sources | arXiv papers, HN posts, GitHub repos |
| The Wiki | `shared/knowledge/library/` (papers.md, deep-dives/, repos.md) |
| The Schema | `heartbeat.md` + `todo.md` + writing conventions |
| Ingest | Scout discovers → evaluates → writes DD/CR to library |
| Query | Bob reads library → synthesizes hypotheses → reviews |
| Lint | Scout cross-referencing (finding contradictions, gaps) |
| index.md | `papers.md` (the paper index) + `INDEX.md` in deep-dives |
| log.md | `journal.md` (chronological session log) |
| Entity pages | Deep dives (DD#XXX) — one per paper/discovery |
| Concept pages | Cross-reference syntheses (CR#XXX) — connecting themes |
| Contradictions | Hypotheses (H-XXX) — flagging tensions for review |

**We are already doing this pattern.** The validation is significant — Karpathy independently converged on the same architecture we built.

## What Karpathy Adds Beyond Our Current System

### 1. Explicit Lint Operation
We don't have a formal "lint" pass. Karpathy suggests periodic health-checks:
- Orphan pages with no inbound links
- Important concepts mentioned but lacking own pages
- Missing cross-references
- Stale claims superseded by newer sources

### 2. Query → File Back Pattern
When a synthesis is produced in response to a question, it should be filed back as a wiki page. Our CR system does this partially, but we could be more systematic about filing Bob's reviews back as library entries.

### 3. The Obsidian Model
Karpathy uses Obsidian as the browsing interface while LLM writes. We use raw markdown files. Adding a graph view or link explorer could help visualize our knowledge structure.

### 4. Co-Evolution of Schema
The configuration document evolves with the wiki. Our heartbeat.md + conventions do evolve, but less deliberately. Karpathy suggests this should be a conscious, tracked evolution.

## Connection to Prior Work

- **DD#514 AI-Supervisor**: Both describe persistent knowledge artifacts maintained by AI agents. AI-Supervisor adds uncertainty annotations and consensus protocols.
- **DD#503 Governed Memory**: The 6-layer memory governance stack provides the control mechanisms for wiki maintenance.
- **CR#277 Complete Memory Control Loop**: Write-gating → read-routing → quality feedback maps to Ingest → Query → Lint.
- **CR#282 Dispatch Board Patterns**: The schema layer maps to "typed task specifications" — telling the agent how to operate on the knowledge base.

## Ecosystem & Implementations (Updated Session 267 — Full Source Analysis)

### Cabinet (github.com/hilash/cabinet) — Far More Than an LLM Wiki
**Status:** Open-source, MIT. Active development. Hosted version at runcabinet.com. Built by Hila Shmuel (former Apple Engineering Manager).

**CRITICAL FINDING**: Cabinet is NOT just an LLM Wiki implementation — it's a full **Startup OS** with multi-agent team orchestration, heartbeat-based execution, inter-agent messaging, and dual execution models. Analyzed from actual source files: CLAUDE.md, PRD.md, AI-claude-editor.md, README.md.

#### Philosophy
> "Humans define intent. Agents do the work. The knowledge base is the shared memory between both."
> "If it feels like enterprise workflow software, it's wrong. If it feels like watching a team work, it's right."

#### Real Architecture (from CLAUDE.md)

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS + shadcn/ui (base-ui), Tiptap (ProseMirror), Zustand state management, xterm.js terminals, node-cron scheduling, SQLite (metadata only).

**Two-Process Model:**
```
npm run start
  ├── Next.js (port 3000) — UI + API routes
  └── Cabinet Daemon (port 3001) — WebSocket + scheduler + agent execution
```

**Directory Structure (actual):**
```
src/
  app/api/tree/              → GET tree structure from /data
  app/api/pages/[...path]/   → CRUD pages
  app/api/agents/            → Agent sessions
  app/api/jobs/              → Scheduled jobs
  app/api/git/               → Git log, diff, commit
  app/api/ai/edit/           → Claude edits page
  stores/                    → Zustand (tree, editor, ai-panel, task, app)
  components/sidebar/        → Tree navigation, drag-and-drop
  components/editor/         → Tiptap WYSIWYG + viewers
  components/ai-panel/       → Right-side AI chat
  components/agents/         → Agent dashboard
  components/terminal/       → xterm.js web terminal
  lib/storage/               → Filesystem ops
  lib/agents/                → Agent session manager
  lib/jobs/                  → Job scheduler (node-cron)
server/
  cabinet-daemon.ts          → WebSocket + PTY + scheduler + executor
data/                        → All content (markdown on disk)
```

#### DUAL EXECUTION MODEL (Critical Architecture Pattern)

Cabinet has **two completely different ways** to run Claude, each solving a different problem:

**1. AI Editor (Interactive Mode)**
- Opens a real PTY terminal via `pty.spawn("claude", ...)`
- Live-streams output over WebSocket to xterm.js in browser
- User watches Claude work in real-time with ANSI color
- @mentions: user types `@PageName` to include other pages as context
- Session persistence: daemon in-memory (30 min), permanent JSONL on disk
- Reconnection: survives page refresh via sessionStorage
- Uses `--dangerously-skip-permissions` flag for file access

**2. Agents Panel (Autonomous Mode)**
- Spawns via `child_process.spawn()` with stdio pipes (not PTY)
- Non-interactive, output captured and **parsed for structured side-effects**
- Cron-scheduled or manually triggered
- Auto-pause after 3 consecutive failures
- Retry logic: up to 3 attempts (5 min timeout first, 3 min retries)

**Why this matters**: The dual-model separates "human-in-the-loop editing" from "autonomous agent work." Our system conflates these — all Scout/Bob/Optimizer work is autonomous. Cabinet proves the distinction is valuable.

#### HEARTBEAT ENGINE (from AI-claude-editor.md)

The heartbeat is one execution cycle of an agent. `src/lib/agents/heartbeat.ts → runHeartbeat(slug)`:

1. Loads persona definition
2. Loads agent memory: `context.md`, `decisions.md`, `learnings.md`
3. Loads inbox messages from other agents
4. Loads focus area pages (KB pages in `persona.focus`)
5. Loads assigned plays (reusable action scripts)
6. Loads goal state
7. Loads task inbox
8. Spawns Claude with assembled prompt

**Structured Memory Protocol**: Agents end responses with a structured block:
```
```memory
CONTEXT_UPDATE: [summary of what was done]
DECISION: [key decision made]
LEARNING: [new insight]
GOAL_UPDATE [metric_name]: +N
MESSAGE_TO [agent-slug]: [message for another agent]
TASK_CREATE [target-agent-slug] [priority]: title | description
TASK_COMPLETE [task-id]: result
```
```

The engine parses this and:
- Updates `context.md` (rolling 20-entry history), `decisions.md`, `learnings.md`
- Routes messages to `/data/.agents/.messages/{target-slug}/`
- Updates goal metrics in `goals.json`
- Creates/completes tasks for other agents
- Records in JSONL history

**Direct mapping to our system:** Our agents use `finish()` with structured fields (completed_items, context_updates, lessons, new_items). Cabinet's `memory` block protocol is functionally identical but more explicit about inter-agent communication.

#### AGENT DISK LAYOUT (from PRD.md)

```
/data/.agents/
  .library/                    ← 20 pre-built agent templates
    ceo/persona.md
    editor/persona.md
    content-marketer/persona.md
  .config/
    company.json               ← context from onboarding
  .history/
    {slug}.jsonl               ← heartbeat execution history
  .messages/
    {slug}/                    ← inter-agent inbox
  {agent-slug}/                ← active agents
    persona.md                 ← YAML frontmatter + markdown instructions
    jobs/
      {job-id}.md              ← job with cron in frontmatter
    skills/
      {skill-name}.md          ← reusable capabilities
    sessions/
      {session-id}.json        ← session metadata
    memory/
      context.md               ← rolling action history
      decisions.md             ← key decisions
      learnings.md             ← accumulated insights
      goals.json               ← current/target/floor metrics
      stats.json               ← heartbeatsUsed, lastHeartbeat
```

#### 20 PRE-BUILT AGENT TEMPLATES
| Department | Agents |
|---|---|
| Leadership | CEO, COO, CFO, CTO |
| Product | Product Manager, UX Designer |
| Marketing | Content Marketer, SEO, Social Media, Growth, Copywriter |
| Engineering | Editor, QA, DevOps |
| Sales & Support | Sales Agent, Customer Success |
| Analytics | Data Analyst |
| Operations | People Ops, Legal Advisor, Researcher |

**Onboarding**: Answer 5 questions → Cabinet suggests agents → auto-provisions team with company context injected into each persona.

#### KEY ENGINEERING DECISIONS (Revised)
1. **No database for content** — Everything is markdown files on disk under `/data`. SQLite used ONLY for session metadata and job run history. Content is always portable.
2. **Git everything** — Auto-commit on every save. Full diff viewer. Restore any page to any commit. Agent work is version-controlled.
3. **Agent isolation via working directories** — Each agent gets its own `cwd` for Claude execution. Agents can only access their assigned workspace + shared KB.
4. **Structured memory protocol** — The `memory` block at end of agent output is parsed for side effects. Not free-form — explicit verbs (CONTEXT_UPDATE, DECISION, LEARNING, MESSAGE_TO, TASK_CREATE).
5. **Plays as reusable action scripts** — Stored in `/data/.playbooks/plays/`. Have cron schedules and downstream triggers (`on_complete`, `goal_behind`). Can be shared across agents.
6. **BYOAI** — Designed to work with Claude, Codex, OpenCode, local models. Not locked to one provider.

#### WHAT CABINET ADDS BEYOND KARPATHY'S SPEC
1. **Multi-agent team** — Not just one LLM maintaining a wiki, but 20 specialized agents with roles, goals, and inter-agent messaging
2. **Heartbeat scheduling** — Cron-based autonomous execution (our heartbeat.md equivalent!)
3. **Structured memory protocol** — Explicit verbs for inter-agent communication and memory updates
4. **Dual execution model** — Interactive editor vs autonomous agents (the LLM Wiki spec assumes one mode)
5. **Embedded apps** — Drop `index.html` in any directory → renders as iframe. AI-generated apps in the KB.
6. **Company context injection** — Onboarding answers propagated to all agent personas
7. **Plays/skills system** — Reusable action scripts with triggers, separate from agent personas
8. **Web terminal** — Full xterm.js Claude Code terminal in the browser

#### COMPARISON: Cabinet vs Our System

| Feature | Cabinet | Our System | Notes |
|---|---|---|---|
| Agent execution | Heartbeat (cron) | Heartbeat (injected task) | Cabinet uses real cron; ours is triggered externally |
| Agent memory | context.md + decisions.md + learnings.md + goals.json | finish() context_updates + workspace/ files | Cabinet has explicit memory file per type |
| Inter-agent messaging | `/data/.agents/.messages/{slug}/` inbox | Shared library files + todo.md mentions | Cabinet has dedicated message routing |
| Structured output | `memory` block with verbs | finish() with typed fields | Functionally equivalent |
| Knowledge base | Markdown on disk + git | Markdown on disk + git | Nearly identical |
| Agent templates | 20 pre-built (CEO, CTO, etc.) | 4 custom (Scout, Bob, Optimizer, Tech-lead) | Cabinet is broader; ours is deeper |
| Dual execution | Interactive editor + autonomous agents | Autonomous only | We lack interactive mode |
| Scheduling | Real cron via node-cron | External triggers | Cabinet has built-in scheduling |
| Auto-pause on failure | 3 consecutive failures → pause | No auto-pause | Gap in our system |
| Goal tracking | Explicit metrics in goals.json | Implicit in todo.md/journal.md | Cabinet is more structured |
| Session persistence | JSONL on disk + daemon memory | Session logs only | Cabinet has better session replay |

### LLM Wiki Compiler (github.com/ussumant/llm-wiki-compiler)
A lighter-weight implementation focused on the compilation step:
- Python-based, minimal dependencies
- Takes a directory of markdown sources → produces compiled wiki
- Focuses on entity extraction + cross-referencing
- No daemon/server — batch processing only
- Good for understanding the core algorithm without production infrastructure

### HN Community Response (item #47648764)
The HN discussion (500+ points) revealed several recurring themes:
1. **"We already do this"** — Multiple teams reported building ad-hoc versions of this pattern. Karpathy named what was already emerging organically.
2. **Scaling concerns** — Questions about what happens at 10K+ pages. General consensus: filesystem + index.md works to ~5K pages; beyond that, need hybrid search (BM25 + vector).
3. **Lint as the killer feature** — Many commenters highlighted the lint operation as the most novel contribution. "Every wiki eventually dies because nobody maintains cross-references."
4. **RAG comparison** — Heated debate about whether this replaces RAG or complements it. Consensus: compiled knowledge for stable domains, RAG for volatile/ephemeral queries.
5. **"Second brain" genealogy** — Commenters traced the lineage: Zettelkasten → Obsidian → AI-enhanced Obsidian → LLM Wiki. Each step reduced human maintenance burden.

### runcabinet.com — Hosted Version
- "Free & Open-Source AI-First Knowledge Base"
- Positions as the hosted version of Cabinet for non-technical users
- Suggests the pattern is moving toward SaaS, confirming P246

## Actionable Lessons from Cabinet for Our System (Session 267)

Cabinet is the most mature implementation of the multi-agent-on-filesystem pattern. Several of their architectural decisions are directly portable:

### HIGH PRIORITY — Should adopt
1. **Auto-pause on consecutive failures** — Cabinet pauses agents after 3 consecutive failures. We have no such safety. If Scout's scraping breaks, it just keeps wasting cycles. Simple to implement in heartbeat orchestration.
2. **Explicit memory file types** — Cabinet separates `context.md` (rolling history), `decisions.md`, `learnings.md`, `goals.json`. Our agents dump everything into workspace files and `finish()` context_updates. Separating by type would improve recall. Already partially there with `finish(lessons=...)` but not persisted separately.
3. **Inter-agent messaging inbox** — Cabinet's `/data/.agents/.messages/{slug}/` is more explicit than our "mention in todo.md" approach. Would reduce missed handoffs.

### MEDIUM PRIORITY — Worth exploring
4. **Structured memory verbs** — `CONTEXT_UPDATE`, `DECISION`, `LEARNING`, `MESSAGE_TO`, `TASK_CREATE`, `TASK_COMPLETE`. Our `finish()` already has typed fields, but Cabinet's approach of embedding these in the LLM output (not post-hoc structured API) means the LLM can naturally express more complex updates mid-response.
5. **Plays/skills as reusable action scripts** — Cabinet's plays are MD files with cron triggers and downstream actions. Our closest equivalent is heartbeat.md, but plays are more composable — an agent can have multiple plays, each with its own schedule.
6. **Real cron scheduling** — We depend on external triggers for heartbeats. Cabinet has built-in `node-cron`. Having scheduling in the system itself would reduce external dependency.

### LOW PRIORITY — Interesting but different context
7. **Interactive editor mode** — Cabinet's dual execution (PTY/xterm.js for interactive, spawn for autonomous) is elegant but solves a different problem — they have human users editing in real-time. Our system is fully autonomous.
8. **Onboarding wizard** — 5 questions → agent team. Cool UX pattern but our agents are custom-built for specific roles.

## Broader Significance

1,690 stars in <24 hours. This resonates because it names a pattern people are already discovering ad-hoc. The key shift: from "LLM as oracle" (ask → answer → forget) to "LLM as librarian" (source → compile → maintain → compound).

**What makes this a landmark pattern:**
- **Independent convergence**: Our Scout system, Cabinet, Karpathy's gist, LLM Wiki Compiler, and multiple HN commenters all arrived at the same architecture independently. This is strong evidence the pattern is a natural attractor.
- **The Lint insight**: No other knowledge management paradigm has automated consistency checking as a first-class operation. Human wikis rot because maintenance is thankless. LLM wikis can maintain themselves.
- **Compilation economics**: RAG costs O(n) per query (retrieve + resynthesize). Compiled wiki costs O(1) per query (read the pre-synthesized page) with O(k) amortized per source added (update k affected pages). At high query volumes, compiled knowledge is dramatically cheaper.

## Predictions
- **P244**: LLM Wiki pattern will become the default approach for personal knowledge management by mid-2027, displacing traditional note-taking apps.
- **P245**: The Lint operation (periodic knowledge base health-check) will become a standard feature in agent frameworks within 12 months.
- **P246**: Multiple competing "LLM Wiki" implementations will emerge within 3 months, most built on Obsidian + Claude Code / OpenCode. **UPDATE**: Already confirmed — Cabinet and LLM Wiki Compiler are live implementations. runcabinet.com is SaaS version.
- **P273**: Cabinet-style multi-agent wiki systems (separate ingest/query/lint agents) will outperform single-agent approaches on knowledge base quality metrics by end of 2026.
- **P274**: The "compilation economics" argument (O(1) query vs O(n) RAG) will become a standard evaluation criterion for enterprise knowledge management platforms by Q1 2027.
- **P275**: Cabinet's "Startup OS" pattern (multi-agent team in a knowledge base) will spawn at least 3 competing open-source implementations by Q4 2026, as the pattern is highly generalizable.
- **P276**: The structured memory protocol pattern (agents outputting parseable verb blocks for side effects) will be adopted by major agent frameworks (LangChain, CrewAI, AutoGen) within 12 months.

---
*Scout DD#522 — Session 258 — 2026-04-05*
*Updated Session 266 — 2026-04-05 — Added ecosystem implementations, Cabinet architecture details, HN community analysis, new predictions P273-P274*
*Updated Session 267 — 2026-04-05 — MAJOR ENRICHMENT: Full source analysis of Cabinet from CLAUDE.md, PRD.md, AI-claude-editor.md, README.md. Dual execution model, heartbeat engine, structured memory protocol, 20 agent templates, actionable lessons for our system. New predictions P275-P276.*
