# Finding: Tool Gap — Bob 84-op Bayesian Scorecard + Scout 43-op Heartbeat

**Date**: 2026-04-14 ~00:22 UTC  
**Sessions analyzed**:
- Bob s_1776117187894_422 — 84 ops, 51 assistant turns, Bayesian Scorecard Pass 4
- Scout s_1776122498628_453 — 43 ops, 65 assistant turns, heartbeat (event-native guard-workflow research)

**Method**: Extracted all tool calls from session.jsonl transcripts, classified by type and sequence pattern, cross-referenced with existing findings (fresh-scan-0413, tool-gap-analysis-0413).

---

## 1. Bob 84-op Bayesian Scorecard — Pattern Analysis

### Tool Call Distribution (51 turns, 84 ops)

| Tool | Count | % |
|------|-------|---|
| bash (cat/head/tail) | ~55 | 65% |
| bash (grep/find/ls) | ~18 | 21% |
| read | ~7 | 8% |
| edit | ~4 | 5% |
| write | 1 | 1% |

### Pattern A: **Repeated Full-File Reads of Same Files** (NEW severity level)

Bob read the same files multiple times across turns:

| File | Times Read | Turns |
|------|-----------|-------|
| SCORECARD-bayesian-2026-04-11.md | **6×** | Op6, Op10, Op16, Op22, Op25, Op29 |
| PRIORITY-TRACKER.md | **5×** (+ 3 partial) | Op7, Op8, Op10, Op11, Op12, Op17, Op27, Op30 |
| H-103 through H-108 hypothesis files | **2-3× each** | Op23→Op26→Op28 (same files re-read) |
| EXP-152/phase2-results.md | **3×** | Op3, Op14, Op18 |
| EXP-153 results/workspace | **3×** | Op4, Op5, Op18, Op32 |

**Root cause**: Context compaction. Bob's session was compacted (first line shows `[COMPACTED CONTEXT]`), so earlier reads were summarized away. Bob re-reads to recover information lost in compaction. This is a **structural waste** — the model can't control it, the system forces re-reads.

**Waste estimate**: ~20-25 ops spent re-reading files already read earlier in the session. This is ~30% of total ops.

### Pattern B: **Hypothesis File Discovery Spiral**

Ops 22-29 show a clear spiral pattern:

```
Op22: cat SCORECARD (full read #4)
Op22: ls hypotheses/H-1*.md
Op23: cat H-103, H-104, H-105, H-106 (4 files)
Op24: cat H-107, H-108 (2 files)
Op25: cat SCORECARD (full read #5!)
Op26: cat H-103, H-104, H-105, H-106 (SAME 4 files again!)
Op27: ls H-10*.md, tail PRIORITY-TRACKER
Op28: cat H-103, H-104, H-105, H-108 (3 of same 4 AGAIN!)
Op29: ls H-1*.md, cat SCORECARD (full read #6!)
```

This is 8 turns / ~25 bash calls to read ~8 hypothesis files that could have been read in a single combined operation. The agent keeps losing track of what it already read.

**Tool opportunity**: A `hypothesis-summary.sh` that dumps all hypothesis files with their P(H) values in a single call. Or better: a compaction-resistant checkpoint that preserves key file contents.

### Pattern C: **Experiment Status Check Chain**

Op31 shows the right idea — a loop across EXP-139 through EXP-154 checking status. But it was preceded by 5+ turns of ad-hoc experiment checking (Op3-5, Op13-14, Op18). The loop pattern should have been first.

**Tool opportunity**: `experiment-status.sh` — scan all EXP-* directories, report which have results, their status, and key metrics. Single call replaces 10+ ops of manual checking.

### Phase Profile

| Phase | Ops | % | Activity |
|-------|-----|---|----------|
| Initial read + discovery | 1-5 | 10% | Reading scorecard, tracker, new KEs |
| Re-read after compaction | 6-12 | 14% | Re-reading same files (compaction loss) |
| Deep evidence gathering | 13-21 | 18% | Reading experiments, KEs, hypotheses |
| Hypothesis discovery spiral | 22-33 | 22% | Repeated reads of same H-* files |
| Checkpoint | 34 | 2% | Saving progress |
| Final evidence + write | 35-37 | 6% | Last reads, write scorecard |
| Edits + verification | 38-51 | 26% | Editing tracker, verifying counts |

**Key insight**: Only 34% of ops (phases: deep evidence + final write + edits) produced forward progress. The other 66% was discovery, re-reading, and spiral navigation.

---

## 2. Scout 43-op Heartbeat — Pattern Analysis

### Tool Call Distribution (65 tool calls across ~43 ops)

| Tool | Count | % |
|------|-------|---|
| scrape_webpage | 14 | 22% |
| bash (git) | ~16 | 25% |
| bash (ls/find/grep/cat) | ~14 | 22% |
| read | ~10 | 15% |
| write | 3 | 5% |
| edit | 1 | 2% |
| finish | 3 | 5% |
| checkpoint | 1 | 2% |

### Pattern D: **Web Scraping Cascade** (confirmed from 0413 finding)

Ops 10-16 contain **14 scrape_webpage calls** for arXiv + Google Scholar research. This is the same pattern identified in the 78-op scout finding but at smaller scale:

```
Op10: scrape arxiv (event sourcing agent workflow)
Op10: scrape arxiv (reactive workflow guard injection)
Op11: scrape arxiv (event-driven workflow interruption) 
Op11: scrape arxiv (middleware guardrail pipeline)
Op11: scrape scholar (event driven agent workflow)
Op12: scrape scholar cache (specific paper)
Op12: scrape arxiv (2508.07935)
Op13: scrape scholar ("event sourcing" "agent workflow")
Op13: scrape scholar ("durable workflow" saga pattern)
Op14: scrape blog (wordpress)
Op14: scrape arxiv (2602.22724)
Op15: scrape scholar (NeMo Guardrails)
Op15: scrape arxiv (2310.10501)
Op16: scrape scholar cache + arxiv (2603.25097)
```

**Pattern**: Iterative query refinement across multiple search engines. Each query is slightly varied. This consumed **7 turns / 14 tool calls** — 33% of the session.

**Tool opportunity**: `research-search.sh <topic> [--arxiv] [--scholar]` — fan out multiple query variations in a single call, deduplicate results, return ranked list. Would collapse 14 calls → 1-2 calls.

### Pattern E: **Git Commit Struggle** (NEW)

Ops 43-65 (the tail end) show a protracted git commit struggle:

```
Op43: git add (from /app) — fails (submodule issue)
Op44: git add -f — fails 
Op45: git checkout -b review branch + add + commit — works
Op46: git checkout main
Op47: finish (attempt 1)
Op48-49: git log + verify — checking commit
Op50: finish (attempt 2)
Op51: git stash + checkout review branch + stash pop + add + commit — amend attempt
Op52-53: git diff + status — checking state
Op54: finish (attempt 3)
Op55-56: cd agents/ + git add + commit — correct approach finally
Op57-58: git show + cat — verifying
Op59-60: grep + edit — updating counters  
Op61: git commit --amend — updating commit
Op62-64: git status + verify across repos
Op65: finish (attempt 4 — final)
```

**22 ops** spent on git operations after the actual work was done. That's **51% of the session** spent on committing and verifying. The scout tried 4 different git approaches before finding the right one (commit from agents/ dir).

**Root cause**: The scout doesn't know that `agents/` is a submodule with its own git repo. It tried committing from `/app` first (wrong repo), then a review branch (unnecessary), then finally the correct `cd agents/ && git add && git commit`.

**Tool opportunity**: `agent-commit.sh <agent-name> <message> [files...]` — handles submodule-aware commits correctly in one call. Would collapse 22 ops → 1-2 ops.

### Pattern F: **Todo File Navigation Spiral**

Ops 17-34 show a navigation pattern through scout's workspace:

```
Op17: read todo.md (again, after reading at Op1)
Op18-19: read todo.md offset:382, offset:846 (again, after Op2-3)
Op20-21: ls workspace/research, ls deep-dives, ls scout/ 
Op22-23: ls workspace/, ls knowledge/, ls deep-dives/, ls cross-references/
Op24-26: tail INDEX.md × 3 different locations
Op27-34: grep for DD/CR numbering in INDEX — 8 ops to find the next DD number
```

**18 ops** to navigate scout's own workspace structure and find the next DD/CR number. The scout doesn't know its own directory layout.

**Tool opportunity**: `scout-workspace-status.sh` — report current DD#, CR#, session#, directory structure, and recent entries. Would collapse 18 ops → 1 call.

---

## 3. Cross-Reference with Existing Findings

| Pattern | First Identified | Status | This Analysis |
|---------|-----------------|--------|---------------|
| DB query chains | Apr 11 | Persists | NOT seen in these sessions (bob/scout don't do DB work) |
| code-search.sh adoption gap | Apr 13 fresh scan | Persists | Neither bob nor scout use it |
| session-query.ts zero adoption | Apr 13 fresh scan | Persists | Not relevant to these sessions |
| Web scraping cascade | Apr 13 analysis | **Confirmed** at smaller scale (14 vs 39 calls) |
| Finish retry loops | Apr 13 analysis | **Confirmed** — scout 3 finish attempts |
| Git commit struggle | NEW | — | **22 ops / 51% of scout session** |
| Repeated file re-reads after compaction | NEW severity | — | **25 ops / 30% of bob session** |
| Workspace navigation spiral | NEW | — | **18 ops / 42% of scout non-research time** |
| Hypothesis discovery spiral | NEW | — | **25 ops / 30% of bob session** |

### NEW Patterns Not Previously Catalogued

1. **Git submodule commit confusion** (Pattern E) — agents don't know agents/ is a separate repo. 22 ops wasted.
2. **Compaction-induced re-reads** (Pattern A) — systematic re-reading of files whose contents were compacted away. 25 ops wasted.
3. **Self-workspace navigation spiral** (Pattern F) — agent doesn't know its own directory layout or numbering scheme. 18 ops wasted.

---

## 4. Savings Estimates

### Bob 84-op Session

| Pattern | Current Ops | With Tool | Savings |
|---------|------------|-----------|---------|
| Compaction re-reads | ~25 | ~5 (checkpoint w/ content) | **20 ops** |
| Hypothesis spiral | ~25 | ~3 (hypothesis-summary.sh) | **22 ops** |
| Experiment status chain | ~10 | ~2 (experiment-status.sh) | **8 ops** |
| **Total** | 84 | **~34** | **50 ops (60%)** |

### Scout 43-op Session

| Pattern | Current Ops | With Tool | Savings |
|---------|------------|-----------|---------|
| Web scraping cascade | 14 calls / 7 turns | 2 calls | **12 calls** |
| Git commit struggle | 22 ops | 2 ops | **20 ops** |
| Workspace navigation | 18 ops | 1 op | **17 ops** |
| **Total** | 43 | **~10** | **33 ops (77%)** |

### Combined Impact

If these tools existed:
- **Bob's scorecard** would be a ~34 op session (60% reduction)
- **Scout's heartbeat** would be a ~10 op session (77% reduction) — back to normal heartbeat range
- **Cross-agent savings**: Git commit tool helps ALL agents that commit to agents/ repo. Workspace navigation tool helps scout specifically.

---

## 5. Priority Tool Recommendations

### P0: `agent-commit.sh` (Highest ROI)

**Impact**: Every agent that commits to agents/ submodule. Scout lost 22/43 ops (51%). Previous findings show similar git struggles in other agents.
**Spec**: Takes agent name, commit message, optional file list. Handles cd to correct repo, git add, git commit. Reports success/failure.
**Estimated effort**: Simple bash script, <30 lines.

### P1: `hypothesis-summary.sh` (Bob-specific but high frequency)

**Impact**: Bob runs scorecard sessions regularly. Each one re-reads hypothesis files 3-6×.
**Spec**: Dumps all H-*.md files with extracted P(H) values, status, and last-updated date. Single output.
**Estimated effort**: Medium bash script, ~50 lines.

### P2: `scout-workspace-status.sh` (Scout-specific)

**Impact**: Scout heartbeats that do research. Eliminates numbering search spiral.
**Spec**: Reports current DD#, CR#, session# from workspace files. Lists recent entries in each directory.
**Estimated effort**: Simple bash script, ~30 lines.

### P3: Compaction-resistant checkpoints (System-level)

**Impact**: Any long-running session that gets compacted. Bob lost 25/84 ops (30%) to re-reads.
**Spec**: Checkpoint system that preserves full file contents (not just summaries) through compaction. May require changes to the session management system.
**Estimated effort**: Architecture change — not a simple tool.

---

## 6. Key Insight

The two most wasteful patterns in these sessions are fundamentally different:

- **Bob's waste** is **information loss** — compaction destroys read context, forcing re-reads. This is a *system* problem, not a *skill* problem.
- **Scout's waste** is **procedural ignorance** — doesn't know the git repo structure, doesn't know its own workspace numbering. This is a *knowledge* problem solvable with tools + context.md entries.

Both are high-impact: Bob at 60% waste, Scout at 77% waste. But the remedies are different — Bob needs architectural changes (compaction-resistant state), while Scout needs simple shell scripts and context.md updates about the submodule structure.
