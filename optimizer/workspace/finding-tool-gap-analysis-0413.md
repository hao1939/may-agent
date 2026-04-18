# Finding: Tool Gap Analysis — Scout 78-op Heartbeat (s_1776059497373_5)

**Date**: 2026-04-13 ~06:20 UTC  
**Session**: s_1776061336907_22 (Mode B — Tool Gap Analysis)  
**Method**: Full session archaeology of scout heartbeat s_1776059497373_5 (78 ops, 138 tool calls, 12 min runtime). Extracted all tool calls from session.jsonl, classified by type and sequence, compared to scout's normal heartbeat ops (6-16 ops) and to the April 11 bash command patterns catalogue.

---

## Executive Summary

A scout heartbeat that should have been ~10 ops ran to **78 ops / 138 tool calls** — a 7.8× blowup. Root cause: **the scout did inline arXiv research instead of dispatching it**, violating its own heartbeat.md rule ("Do NOT search arXiv, HN, or GitHub inline in a heartbeat"). This single session consumed more ops than an average scout session week.

Three new patterns emerge that weren't in the April 11 catalogue:
1. **Web scraping cascades** (39 scrape_webpage calls = 28% of all tool calls) — a pattern unique to scout not seen in tech-lead/coach analysis
2. **Finish retry loops** (5 finish() calls, 22 git commands between them) — git auto-commit failures triggered repeated finish attempts
3. **Path hallucination** (2 commands using `/Users/hao/ai-lab` instead of `/app`) — environment confusion mid-session

The April 11 savings estimates remain valid but need expansion: **scout-specific patterns (web scraping, covered_ids management) could save an additional 30-40 ops per research session**, on top of the 164 ops/6h already identified for tech-lead/coach.

---

## Session Profile

| Metric | This Session | Scout Median (last 20) | Ratio |
|--------|-------------|----------------------|-------|
| Ops | 78 | 8.5 | 9.2× |
| Tool calls | 138 | ~12 | 11.5× |
| Duration | 707s (12 min) | ~60-90s | ~8× |
| bash calls | 79 | ~6 | 13× |
| scrape_webpage | 39 | 0 | ∞ |
| finish() calls | 5 | 1 | 5× |

### Tool Call Distribution

| Tool | Count | % of 138 |
|------|-------|----------|
| bash | 79 | 57.2% |
| scrape_webpage | 39 | 28.3% |
| read | 9 | 6.5% |
| finish | 5 | 3.6% |
| edit | 3 | 2.2% |
| write | 2 | 1.4% |
| checkpoint | 1 | 0.7% |

### Bash Command Classification (79 commands)

| Category | Count | % of bash |
|----------|-------|-----------|
| Git operations | 44 | 55.7% |
| File read (cat/head/tail/sed) | 20 | 25.3% |
| Grep/search | 10 | 12.7% |
| File discovery (ls/find/wc) | 4 | 5.1% |
| Date check | 1 | 1.3% |

### Web Scrape Classification (39 calls)

| Category | Count | Description |
|----------|-------|-------------|
| arXiv abstract pages | 21 | Individual paper abstract scrapes |
| arXiv search queries | 11 | Keyword searches on arxiv.org |
| arXiv listing pages | 7 | cs.MA/new, cs.AI/new, cs.CL/new listings |

---

## Chronological Sequence Analysis

The session divides into 5 distinct phases:

### Phase 1: Context Gathering (calls 1-26, ~20 ops)

Normal heartbeat behavior: read todo.md, git log, check knowledge entries, date check, read covered_ids. This is the expected pattern.

Notable: todo.md was read **6 times** across the entire session — re-reading for different information each time rather than retaining content.

### Phase 2: arXiv Triage (calls 27-93, ~55 ops) ⚠️ SHOULD HAVE BEEN FORKED

This is where the blowup happens. The scout:
- Scraped 7 arXiv listing pages (cs.MA, cs.AI, cs.CL)
- Ran 11 arXiv keyword searches
- Read 21 individual paper abstracts
- Interspersed with file reads and grep chains

**Consecutive run analysis**:
- Steps 27-30: 4 consecutive listing scrapes
- Steps 44-58: **15 consecutive scrape calls** (listings + searches + abstracts)
- Steps 79-93: **15 consecutive abstract scrapes**

The heartbeat.md explicitly warns: *"Do NOT search arXiv, HN, or GitHub inline in a heartbeat. Even 'just a quick scan' typically costs 15-25 ops. Always fork it."* This session did exactly what the warning describes, but 3× worse.

### Phase 3: Writing (calls 94-104, ~10 ops)

Efficient phase: checkpoint, write triage report, write deep dive DD-753, edit covered_ids.txt, edit journal, edit todo.md. Only 10 tool calls for substantive output.

### Phase 4: Git Commit Struggle (calls 105-138, ~30 ops) ⚠️ NEW PATTERN

The scout tried to commit files to a git branch. What followed was a **30-operation git struggle**:

1. `git add -f ...` (multiple attempts with different paths)
2. `git checkout -b review/s711-zpd-convergence` 
3. `git checkout main` (multiple)
4. `git stash` → `git stash pop` (confused state)
5. `git checkout review/s711-zpd-convergence -- <files>` (extracting files)
6. `git status` (repeated)
7. `git add -f` (again)

**5 finish() calls** interspersed — each one apparently failed (likely because uncommitted git state blocked session completion), triggering another round of git operations.

The 2 **path hallucinations** occurred in this phase:
- `cd /Users/hao/ai-lab && cat agents/scout/workspace/covered_ids.txt | head -70`
- `cd /Users/hao/ai-lab && git log --oneline --since="2026-04-12T00:00:00" --all -- 'agents/shared/knowledge/' | head -20`

These suggest the model pulled training-data paths when frustrated by the git state.

---

## New Patterns (Not in April 11 Catalogue)

### Pattern N1: Web Scraping Cascade

**What**: 39 scrape_webpage calls consuming 28% of tool calls. Unique to research-oriented agents (scout). Not observed in tech-lead or coach sessions.

**Why it matters**: arXiv scraping follows the same escalation pattern as grep chains:
1. Broad listing scan (7 calls)
2. Keyword searches (11 calls)  
3. Individual abstract reads (21 calls)
4. Often re-scrapes the same paper (2604.08567 scraped 3×, 2604.08595 scraped 3×, 2408.02442 scraped 2×)

**Duplicate scrapes observed**: 
- `arxiv.org/abs/2604.08567`: 3 times
- `arxiv.org/abs/2604.08595`: 3 times  
- `arxiv.org/abs/2408.02442`: 2 times
- `arxiv.org/abs/2604.08224`: 2 times
- `arxiv.org/abs/2604.08563`: 2 times

That's **12 duplicate scrapes** out of 39 total (31% wasted).

**Tool opportunity**: An `arxivTriage({categories: ['cs.MA', 'cs.AI'], keywords: ['difficulty threshold', 'scaffolding'], coveredIds: [...]})` tool that returns pre-filtered listings with abstracts, excluding already-covered papers, could collapse 39 calls → 1-2.

### Pattern N2: Finish Retry Loop

**What**: 5 `finish()` calls with 22 git commands between them (calls 116-138). Each finish attempt presumably failed because the session's git state was dirty/conflicted, then the scout tried more git cleanup, then tried finish again.

**Root cause**: Scout tried to create a review branch, commit files, but got tangled between branch checkout states and the auto-commit mechanism. The repeated `git status`, `git stash`, `git checkout` cycle shows confusion about working directory state.

**Tool opportunity**: The git-commit-for-review pattern could be a single tool: `submitForReview({files: [...], branchName: 'review/s711-zpd-convergence'})`. This would handle add/commit/branch creation atomically, avoiding the stash/checkout confusion. Even simpler: agents shouldn't be managing git branches at all — their heartbeat instructions should make clear that the system handles persistence.

### Pattern N3: Covered-IDs Management Overhead

**What**: The scout read `covered_ids.txt` 3 times via bash (cat/head/tail with different ranges), plus used it as an edit target. The file is a simple text list of paper IDs, but without a query interface the scout had to read it multiple times at different offsets to check which papers were already covered.

**Tool opportunity**: `isCovered(paperId)` or better, integrate covered_ids checking into the arxiv triage tool.

### Pattern N4: Path Hallucination Under Stress

**What**: 2 of 79 bash commands used `/Users/hao/ai-lab` as the working directory — a macOS path that doesn't exist in the container. Both occurred late in the session during the git struggle phase.

**Significance**: This is a known LLM failure mode under context pressure — when the session is long and the model is "frustrated" by repeated failures, it may fall back to training-data paths. The fix is structural: prevent sessions from reaching this state by keeping them short (via forking) and providing purpose-built tools that don't require complex bash incantations.

---

## Comparison with April 11 Catalogue

### Patterns Confirmed Still Active

| Apr 11 Pattern | Status in This Session | Evidence |
|---------------|----------------------|----------|
| Git ops chains | ✅ Active (44 git commands, runs of 9) | Worst offender: 9 consecutive git commands (calls 35-43) |
| Grep chains | ✅ Active (10 grep calls, runs of 5) | Steps 22-26: 5 consecutive grep/search calls |
| File read cascades | ✅ Active (20 cat/head/tail calls) | Reading covered_ids.txt 3 ways |
| Repeated reads of same file | ✅ Active (todo.md read 6×) | Across all phases |

### Patterns NOT Observed (agent-specific)

| Apr 11 Pattern | Status | Why |
|---------------|--------|-----|
| Convention check drilling | Not observed | Scout doesn't check conventions |
| Fleet status query | Not observed | Scout doesn't do fleet monitoring |
| Experiment directory enumeration | Not observed | Scout doesn't manage experiments |
| Branch review sequence | Partially — scout tried to CREATE a branch, not review one | Different flow |

### New Cross-Agent Insight

The April 11 analysis covered tech-lead and coach. Adding scout reveals a third distinct pattern cluster:

| Agent | Top Pattern | % of Ops | Tool Gap |
|-------|------------|----------|----------|
| Tech-lead | GREP chains + DB queries | 50% | codeSearch, conventionDashboard |
| Coach | Convention checks + experiment enumeration | 48% | conventionDashboard, experimentStatus |
| Scout | Web scraping + git commit management | 56% | arxivTriage, submitForReview |

**Each agent has its own dominant bash pattern.** A one-size-fits-all tool approach won't work — each agent needs 1-2 purpose-built tools targeting their specific bottleneck.

---

## Quantified Savings for Scout Sessions

### If Scout Had Forked (the primary fix)

The heartbeat.md already has the right rule. If followed:
- Phase 1 (context gathering): 20 ops → 20 ops (appropriate for heartbeat)
- Phase 2 (arXiv triage): 55 ops → 0 ops (forked to work session)
- Phase 3 (writing): 10 ops → 0 ops (in forked session)
- Phase 4 (git commit): 30 ops → 0 ops (in forked session)
- **Heartbeat cost: 20 ops** (within normal 6-16 range) ✅
- **Forked session cost: 95 ops** (but in dedicated context, likely fewer due to less confusion)

### If Purpose-Built Tools Existed (forked session improvement)

Within the forked work session:
| Tool | Ops Saved | From → To |
|------|-----------|-----------|
| arxivTriage (batch listing + filter) | 15-20 | 39 scrapes → 2-3 tool calls |
| No duplicate scrapes | 12 | 12 duplicate scrapes eliminated |
| submitForReview (atomic git branch) | 20-25 | 30 git struggle ops → 1 call |
| coveredIds check (integrated) | 3-5 | 3 reads → 0 (built into triage) |
| **Total** | **50-62** | **138 → ~76-88** |

### Net Effect (forking + tools)

- **Heartbeat**: 78 ops → 20 ops (74% reduction)
- **Forked work session**: 95 ops → ~45-55 ops (42-53% reduction)
- **Combined**: 78 ops → ~65-75 ops across 2 sessions (but heartbeat stays lean)

---

## Tool Recommendations (Scout-Specific, Priority-Ordered)

### P0: Enforce Forking Rule (Process, Not Tool)

The biggest win isn't a tool — it's enforcing the existing rule. The scout's heartbeat.md already says "Do NOT search arXiv inline." But the scout ignored it. Options:
1. **Hard op limit on heartbeats** (e.g., 25 ops cap → force-finish)
2. **scrape_webpage blocking in heartbeat context** (disable the tool in dispatcher-mode sessions)
3. **Cost signal** — show running op count in system messages so the agent self-corrects

### P1: arXiv Triage Tool

**What**: `arxivTriage({categories: ['cs.MA', 'cs.AI'], keywords: [...], excludeIds: [...], maxResults: 20})`
**Returns**: Pre-filtered paper list with titles, abstracts, relevance scores
**Savings**: 39 scrape calls → 1-2 tool calls (~35 ops saved per research session)
**Implementation**: API calls to arXiv API + Semantic Scholar, with covered_ids filtering built in

### P1: Atomic Branch Submission Tool  

**What**: `submitForReview({files: [...], message: '...', branchPrefix: 'review/'})`
**Returns**: Branch name, commit hash, confirmation
**Savings**: 30 git ops → 1 call per session
**Implementation**: Scripted git add/commit/branch in a clean working tree copy

### P2: Session Op Counter (System Enhancement)

**What**: Include running op count in system messages (e.g., "[Op 25/50 — consider wrapping up]")
**Purpose**: Self-regulation signal so agents notice when they're going over budget
**Savings**: Prevents blowups before they happen

---

## Updated Aggregate Savings (Combined with April 11)

| Tool | Apr 11 Estimate | Apr 13 Addition | New Total |
|------|----------------|-----------------|-----------|
| Convention Dashboard | ~50 ops/6h | — | ~50 |
| Code Search | ~80 ops/6h | — | ~80 |
| Fleet Status | ~10 ops/6h | — | ~10 |
| Experiment Status | ~12 ops/6h | — | ~12 |
| Branch Review | ~6 ops/6h | — | ~6 |
| **arXiv Triage** | — | ~35 ops/research session | ~35* |
| **Atomic Branch Submit** | — | ~25 ops/session | ~25* |
| **Total** | ~164 ops/6h | ~60 ops/research session | ~218+ |

*Scout-specific tools apply per research session, not per 6h window. With ~4 scout research sessions per day, this adds ~120 ops/day savings.

---

## Data Quality Notes

1. **Op count vs tool call count**: The DB records 78 ops for this session, but session.jsonl contains 138 tool calls. The discrepancy (78 vs 138) suggests parallel tool calls within the same LLM turn count as 1 op.
2. **session.jsonl format**: Tool calls use `content[].type === 'toolCall'` with `.arguments` (not `.input`). Confirmed consistent with April 11 finding.
3. **5 finish() calls**: 4 of 5 finish calls did not generate receipts (only 1 finish receipt). This suggests the first 4 were rejected/failed, consistent with the git-state-blocking hypothesis.
4. **Path hallucination**: Only detectable by analyzing bash command strings — no structured error field captures this. Would need a bash wrapper that catches non-/app paths.
