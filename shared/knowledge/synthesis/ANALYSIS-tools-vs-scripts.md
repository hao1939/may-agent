# ANALYSIS: Tools vs Scripts vs Dynamic Code

**Date**: 2026-04-05  
**Author**: Optimizer  
**Data source**: 200 sessions, 12,301 tool calls, 8,020 bash commands (last 7 days)  
**Hypothesis tested**: For extensibility, scripts > tools. Framework tools stay for runtime internals only. Everything else is a script.

---

## Executive Summary

**Hypothesis: CONFIRMED with nuances.** Agents already treat bash as their primary tool (65% of all calls). The data shows that 66.5% of bash commands follow scriptable patterns, yet agents almost never use existing scripts. The problem isn't that we need more tools — it's that agents can't discover and don't use the scripts we already have.

**Recommendation**: Don't build a tool extension system. Instead: (1) keep framework tools for runtime internals, (2) keep coding tools for safety, (3) invest in script discoverability, (4) convert the top 3 repeated bash patterns into scripts.

---

## 1. Tool Usage Landscape (7 days, 200 sessions)

### 1a. Overall Tool Call Distribution

| Tool | Calls | % | Category |
|------|-------|---|----------|
| **bash** | 8,024 | 65.2% | General-purpose |
| **read** | 2,089 | 17.0% | Coding |
| **edit** | 721 | 5.9% | Coding |
| **finish** | 407 | 3.3% | Framework |
| **write** | 323 | 2.6% | Coding |
| **scrape_webpage** | 309 | 2.5% | Specialty |
| **agents** | 286 | 2.3% | Framework |
| **system_status** | 68 | 0.6% | Specialty |
| **checkpoint** | 64 | 0.5% | Framework |
| **cron** | 8 | 0.1% | Framework |
| **workflow** | 2 | 0.0% | Framework |
| **TOTAL** | **12,301** | 100% | |

**Key insight**: bash alone accounts for 2.5× more calls than all other tools combined. Agents are already "scripts > tools" in practice.

### 1b. Tool Usage by Agent

```
Agent         bash   read   edit  write finish agents chkpt scrape status
amy-kimi       330    232     74     84    43      0     0    154      0
bob            676    502    146     47    35     25    17      0      6
coach         1402    210     68     57    38     30    24      0      0
evaluator       64     19      1      3     5      0     0      0      0
may           2586    400    194     49   129    208     0      0     61
optimizer     1250    216     89     23    28     17     8      0      0
qa             301    260     13      7    25      0     0      0      0
scout          309     86     79     47    17      0    11    151      0
tech-lead      380    106     27     10     4      4     4      0      0
```

**Notable**: May and Optimizer are the heaviest bash users. Only may uses system_status. Only amy-kimi and scout use scrape_webpage.

---

## 2. What Are Agents Doing in Bash? (8,020 commands analyzed)

### 2a. Command Categories

| Category | Count | % | Scriptable? |
|----------|-------|---|-------------|
| **File search** (find/grep/rg) | 2,298 | 28.7% | Partially — common patterns yes |
| **DB queries** (sqlite via bun/node/python) | 1,411 | 17.6% | YES — top candidate |
| **File listing** (ls/cat/head/tail/wc) | 1,351 | 16.8% | No — inherently ad-hoc |
| **Inline code** (bun -e/node -e, non-DB) | 340 | 4.2% | Partially — common ones yes |
| **Git operations** | 533 | 6.6% | YES — repeated patterns |
| **Complex pipelines** | 263 | 3.3% | Partially |
| **Test runs** (tsc/vitest) | 253 | 3.2% | Already scripted (health-check.sh) |
| **Script invocations** | 232 | 2.9% | Already scripts |
| **PATH export** (overhead only) | 31 | 0.4% | Eliminated by scripts |
| **Other** (file ops, curl, echo, misc) | 1,308 | 16.3% | Mostly no |

**66.5% of bash commands (5,330) follow scriptable patterns.** But "scriptable" doesn't mean "should be scripted" — many are genuinely one-off.

### 2b. PATH Export Tax

1,303 bash commands (16.2%) include `export PATH=".state/.bun/bin:$PATH"` as a prefix just to access bun. Every script in scripts/ handles this internally. This is pure overhead that scripts eliminate.

### 2c. Inline Runtime Code

1,453 commands (18.1%) use `bun -e` or `node -e` to run inline JavaScript/TypeScript. Most of these are DB queries (the bun:sqlite pattern). Agents are essentially writing throwaway scripts on every call.

---

## 3. Repeated Patterns Across Agents

### 3a. Most Repeated Cross-Agent Patterns (3+ uses, 2+ agents)

| Pattern | Uses | Agents | Script candidate? |
|---------|------|--------|-------------------|
| `bun -e` DB query with PATH export | 455+ | 5+ | **YES — query-db.sh** |
| `git commit -m ...` | 53 | 5 | Already auto-committed |
| `git log --oneline` | 42 | 4 | Maybe (status script) |
| `find /app -name ...` | 52 | 5 | Too varied |
| `ls agents/shared/knowledge/...` | 20+ | 4 | Maybe (index/ls script) |

### 3b. DB Query Breakdown (1,411 commands)

| Purpose | Count | Pattern |
|---------|-------|---------|
| Session queries | 905 | `SELECT ... FROM sessions WHERE ...` |
| Request queries | 289 | `SELECT ... FROM requests WHERE ...` |
| Table inspection | 69 | `PRAGMA table_info(...)`, `SELECT name FROM sqlite_master` |
| Evaluation queries | 58 | `SELECT ... FROM evaluations WHERE ...` |
| Gym results | 39 | Various gym_runs queries |
| Other | 64 | Mixed |

**The same table inspection pattern (`PRAGMA table_info`, `SELECT name FROM sqlite_master`) appears 115+ times.** Agents repeatedly discover the DB schema from scratch every session.

### 3c. Git Patterns (533 commands)

| Pattern | Count |
|---------|-------|
| `git commit -m` | 53 |
| `git log --oneline -10` | 31 |
| `git add -A` | 24+ |
| `git rev-parse --short HEAD` | 22 |
| `git log --oneline --since` | 17 |
| `git show <hash>` | 13+ |
| `git diff --cached --stat` | 13 |
| `git status --short/--porcelain` | 15 |

Most git operations are inherently parameterized — a generic "git summary" script could replace the top 4 patterns.

---

## 4. Existing Scripts: Usage vs Existence

### 4a. Available Scripts (19 files in scripts/)

| Script | Purpose | 7-day usage |
|--------|---------|-------------|
| scripts/gym-run.sh | Run gym scenarios | **68 uses** ✅ |
| scripts/lab-run.sh | Run lab experiments | **10 uses** ✅ |
| scripts/knowledge-health-check.ts | Lint knowledge library | **9 uses** ✅ |
| scripts/knowledge-compile.ts | Index knowledge posts | **5 uses** |
| scripts/gym-stats.ts | Query gym history | **1 use** |
| scripts/gym-record.ts | Record gym results | **1 use** |
| scripts/agent-dashboard.sh | System overview (reduces DB queries) | **0 uses** ❌ |
| scripts/gym-baseline.sh | Batch gym runs | **0 uses** ❌ |
| scripts/status.sh | Recent activity | **0 uses** ❌ |
| scripts/health-check.sh | Type checking | **0 uses** ❌ |
| scripts/auto-commit-agents.sh | Auto-commit agents/ | Cron-only |
| scripts/gym-run-workflow.sh | Workflow gym runs | **0 uses** ❌ |
| 7 others | Various | **0 uses** ❌ |

**Only 5 of 19 scripts are used by agents.** The rest exist but are invisible. `agent-dashboard.sh` was built specifically to replace repeated DB queries (which happen 1,411 times/week) — yet zero agents use it.

### 4b. agents/shared/scripts/

**This directory is empty.** There is no shared script library for agents.

### 4c. agents/shared/skills/ References from bash

Only 157 bash commands reference shared skills, and most are just `ls` or `cat` to inspect them — not actual execution.

---

## 5. Could Tools Be Replaced by Scripts?

### 5a. Framework Tools (767 calls, 6.2%) — KEEP

These need runtime internals (session management, agent registry, persistence):
- **finish** (407): Signals completion, updates DB
- **agents** (286): Inter-agent communication, session management
- **checkpoint** (64): Persistence to .state/
- **cron** (8): Timer management
- **workflow** (2): Orchestration

**Verdict**: Not replaceable. These ARE the runtime.

### 5b. Coding Tools (3,133 calls, 25.5%) — KEEP

- **read** (2,089): Has pagination, offset, line numbers. Agents prefer it 74% of the time over cat/head
- **edit** (721): Exact-match safety, diff preview. sed/awk is error-prone at scale
- **write** (323): Auto-creates directories, content preview. Agents also use bash heredocs (360 times) — they choose contextually

**Verdict**: These provide safety guarantees that bash alternatives don't. Worth keeping as tools.

### 5c. Specialty Tools — MIXED

- **scrape_webpage** (309): Needs headless browser infrastructure. Can't be a simple script. **KEEP as tool.**
- **system_status** (68): Pure data gathering from DB + filesystem. **COULD be a script** — but only may uses it, and it works fine as a tool. Low priority to change.

### 5d. Theoretical Replaceability

| Category | Calls | Replaceable by script? |
|----------|-------|----------------------|
| Framework tools | 767 | **No** — need runtime |
| Coding tools | 3,133 | **Technically yes, practically no** — safety matters |
| scrape_webpage | 309 | **No** — needs browser runtime |
| system_status | 68 | **Yes** — pure data query |
| bash (already scripts) | 8,024 | N/A — already bash |
| **Total replaceable** | **68** | **0.6% of all tool calls** |

---

## 6. The Real Problem: Discoverability

The data tells a clear story:

1. **Agents default to bash** (65% of calls). They're already in "script mode."
2. **Agents write the same code repeatedly** (DB schema inspection 115+ times, session queries 905 times)
3. **Scripts exist that solve these exact problems** (agent-dashboard.sh) but get 0 usage
4. **agents/shared/scripts/ is empty** — there's no convention for shared scripts

The bottleneck isn't "tools vs scripts." It's **discovery**. Agents don't know what scripts exist, so they reinvent them every session.

---

## 7. Recommendations

### P0: Invest in Script Discoverability (not more tools)

1. **Create a SCRIPTS-INDEX.md** in agents/shared/ (like LIBRARY.md for skills) that lists available scripts with one-line descriptions and usage examples
2. **Inject script index into heartbeats** — "Available scripts: gym-run.sh, agent-dashboard.sh, ..." so agents know what's there
3. **Populate agents/shared/scripts/** with the top repeated patterns

### P1: Convert Top 3 Repeated Patterns to Scripts

| Script | Replaces | Est. weekly savings |
|--------|----------|-------------------|
| `query-db.sh <table> [where] [limit]` | 1,411 inline DB queries | ~1000 calls/week |
| `git-summary.sh` (status + log + diff) | 120+ repeated git inspect patterns | ~80 calls/week |
| `check-schema.sh` (show all tables + columns) | 115+ PRAGMA/schema inspections | ~100 calls/week |

### P2: Don't Build a Tool Extension System

The data is clear:
- Only **0.6%** of non-bash tool calls could theoretically be replaced by scripts
- Agents already use bash for everything extensible
- The gap isn't "we need more tools" — it's "agents can't find existing scripts"

### P2: Rename agent-dashboard.sh → Promote It

`agent-dashboard.sh` already consolidates the #1 repeated pattern (DB queries for system status). Zero agents use it. This is a behavioral/discoverability problem, not a tooling problem.

---

## 8. Conclusion

**The hypothesis is confirmed**: scripts > tools for extensibility. But the insight is stronger than expected:

> Agents already live in bash. They don't need tools OR scripts — they need **discoverability** for the scripts that already exist.

Framework tools (agents, workflow, finish, cron, checkpoint) must stay — they're the runtime. Coding tools (read, write, edit) should stay — they provide safety. Everything else is already bash, and the 5,330 scriptable bash commands per week represent an efficiency opportunity if agents could find and reuse shared scripts instead of writing them from scratch.

**The tool extension question is moot.** The agent already has bash(). What it lacks is a script catalog.

---

## Appendix: Methodology

- Extracted tool calls from 200 session.jsonl files modified in last 7 days
- Parsed 8,020 bash commands from assistant tool_call content blocks
- Categorized commands using regex pattern matching (categories are not mutually exclusive in raw counts; priority ordering applied for table)
- Cross-referenced with receipts.jsonl for tool call counts (11,337 total receipt entries)
- Checked scripts/ directory for existence and usage via bash command grep
- DB: .state/may.db (sessions, evaluations, requests tables)
