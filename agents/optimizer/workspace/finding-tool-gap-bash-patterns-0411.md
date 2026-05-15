# Finding: Recurring Multi-Step Bash Patterns — Tool Gap Analysis

**Date**: 2026-04-11  
**Analyst**: Optimizer (Mode B)  
**Method**: Extracted 1,821 bash commands from 52 high-op sessions (>15 ops) in a 6-hour window; clustered by structural similarity; estimated daily frequency using 7-day average scaling  
**Data Source**: session.jsonl files from .state/sessions/, may.db for session metadata

---

## Executive Summary

Agents spend **~613 ops/day** on repetitive bash boilerplate that could be eliminated by 4 reusable scripts/tools. The top patterns are: (1) DB query boilerplate with schema re-discovery every session, (2) manual git commit cycles in agents/ dir, (3) complex session file analysis scripts, and (4) redundant PATH setup. A 5th pattern (file verification after writes) is structural and intentional — not a tool gap.

**Total daily bash commands in high-op sessions**: ~4,864 (1,821 × 2.67 scale factor)  
**Estimated daily ops saved by automation**: ~613 ops (~9.1% of daily total ~6,731 ops)

---

## Top 5 Automation Opportunities (Ranked by Savings)

### 1. DB Query Wrapper Script — `scripts/db.sh`

**Frequency**: 434 DB queries in 6h → **~1,160/day** across 31 sessions  
**Estimated Daily Savings**: ~174 ops (boilerplate elimination) + ~155 ops (schema discovery) = **~329 ops/day**  
**Agents Affected**: optimizer (203), coach (85), may (69), bob (47), tech-lead (30)  
**Implementation Complexity**: LOW (1-2 hours)

**The Problem**: Every DB query requires agents to manually construct:
```bash
export PATH=".state/.bun/bin:$PATH"
bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('.state/may.db', {readonly: true});
// actual query here
"
```
This is ~80 characters of boilerplate repeated **434 times in 6 hours**. Average command length: 1,005 chars (boilerplate is ~8% of each).

Worse, **48% of DB queries (207/434)** include schema discovery (`sqlite_master` or `PRAGMA table_info`) because agents don't remember table structures between ops. 85 schema discovery commands across 29 sessions.

**DB Query Intent Breakdown**:
| Intent | Count | % |
|--------|-------|---|
| Session queries | 224 | 51.6% |
| Schema checks | 46 | 10.6% |
| Row counts | 45 | 10.4% |
| List tables | 36 | 8.3% |
| Evaluation queries | 31 | 7.1% |
| Convention checks | 14 | 3.2% |
| Digest queries | 11 | 2.5% |
| Other | 27 | 6.2% |

Common session query sub-patterns (from 224 session queries):
- Agent-filtered: 152 (68%)
- Op-count filtered: 150 (67%)
- Recent sessions (ORDER BY DESC LIMIT): 128 (57%)
- Date/time filtered: 124 (55%)
- Error/interrupted checks: 25 (11%)

**Proposed Solution**: `scripts/db.sh` — a wrapper that:
1. Sets PATH, imports Database, connects to may.db automatically
2. Accepts raw SQL as argument: `./scripts/db.sh "SELECT agent, COUNT(*) FROM sessions GROUP BY agent"`
3. Includes `--schema` flag to dump all table schemas once
4. Includes `--sessions` shortcut for common session queries with `--agent`, `--since`, `--min-ops` flags

**Why This Works**: Eliminates 80+ chars of boilerplate per query AND the ~2-3 schema discovery ops per session. Agents already know SQL — they just need the wrapper to stop re-typing connection setup.

**Note**: `scripts/session-query.ts` already exists for session-specific queries, but agents still construct manual DB queries 434 times in 6h. Either agents don't know about it, or it doesn't cover their query needs (evaluation, convention, digest tables). A general SQL wrapper covers all cases.

---

### 2. Session Analysis Tool — `scripts/session-analyze.sh`

**Frequency**: 181 session file scans in 6h → **~484/day** across 12 sessions  
**Estimated Daily Savings**: **~145 ops/day**  
**Agents Affected**: coach (100), optimizer (73), tech-lead (8)  
**Implementation Complexity**: MEDIUM (3-4 hours)

**The Problem**: Coach and optimizer write massive bun -e scripts (avg 1,433 chars, max 11,528 chars!) to parse session JSONL files. Common analyses:
- Count tool calls by type per session
- Find sessions with specific tool call patterns
- Extract bash commands matching a pattern
- Compute ops/turn ratios
- Find blocked/recovered sessions

These scripts are reconstructed from scratch each time — same parsing logic, different parameters.

**Proposed Solution**: `scripts/session-analyze.sh` that wraps common JSONL analysis:
1. `--tool-breakdown <sessionId>` — count tool calls by type
2. `--bash-commands <sessionId>` — extract bash commands
3. `--find-pattern <regex> --since <duration>` — search across sessions
4. `--blocked-sessions --since <duration>` — find guard-blocked sessions
5. `--ops-per-turn <sessionId>` — compute efficiency metrics

**Why This Works**: The 12 sessions doing this analysis average 15 session-scan commands each. A proper tool would reduce each analysis from 3-5 exploratory ops to 1 targeted op.

---

### 3. Git Commit Helper — `scripts/agents-commit.sh`

**Frequency**: 101 git ops in 6h → **~270/day** across 26 sessions  
**Estimated Daily Savings**: **~139 ops/day**  
**Agents Affected**: bob (35), scout (25), tech-lead (15), optimizer (12), may (10), coach (4)  
**Implementation Complexity**: LOW (30 minutes)

**The Problem**: Agents manually construct git commit cycles in the agents/ directory:
```bash
cd agents && git add -A && git status  # check what's staged
cd agents && git commit -m "..."       # commit
```
This is 2-4 ops per commit cycle. The auto-commit script (`scripts/auto-commit-agents.sh`) exists but is a background process — agents still do manual commits when they want specific commit messages or to verify their work was committed.

**Git sub-patterns found**:
| Pattern | Count |
|---------|-------|
| git log (browsing history) | 34 |
| git add + git commit (combined) | 14 |
| git show (viewing commits) | 8 |
| git diff | 7 |
| git status | 5 |
| git add + git status | 4 |
| git add + git diff | 4 |

**Proposed Solution**: `scripts/agents-commit.sh` that:
1. `./scripts/agents-commit.sh "commit message"` — add all + commit in one op
2. `./scripts/agents-commit.sh --status` — show what's changed
3. `./scripts/agents-commit.sh --log N` — show last N commits

**Why This Works**: Converts 2-4 op commit cycles to 1 op. 46 combined add+commit commands already show agents try to minimize ops but still need `cd agents` every time.

---

### 4. PATH Auto-Setup (Environment Fix)

**Frequency**: 394 PATH exports in 6h → **~1,053/day**  
**Estimated Daily Savings**: **~0 ops** (doesn't save ops — saves characters)  
**Agents Affected**: All agents using bun  
**Implementation Complexity**: LOW (15 minutes)

**The Problem**: `export PATH=".state/.bun/bin:$PATH"` appears at the start of 394/1821 (21.6%) of all bash commands. Average 15.2 PATH setups per session. This doesn't cost extra ops (it's part of a compound command) but adds ~40 chars to every bun command.

**Proposed Solution**: Add to the shell profile or create a `/app/.envrc` that auto-sets PATH:
```bash
echo 'export PATH=".state/.bun/bin:$PATH"' >> /app/.bashrc
```

**Why This Works**: Eliminates repetitive typing but doesn't save ops since PATH export is chained with the actual command. Low priority — cosmetic improvement only.

**Savings Note**: Technically 0 ops saved since the PATH is part of compound commands, but it reduces token output by ~40 chars × 394 = ~16K chars in 6h, reducing cost slightly.

---

### 5. File Verification After Write (NOT a Tool Gap)

**Frequency**: 494 verification reads in 6h → **~1,321/day**  
**Estimated Daily Savings**: **0 ops** (intentional behavior)  
**Agents Affected**: All  
**Implementation Complexity**: N/A

**The Problem (that isn't really a problem)**: Agents read back files via `head`/`grep` after writing them. This is the largest single bash pattern (27.1% of all commands).

**Why NOT to automate**: This is the FM-3.3 guard recovery pattern — agents verify their writes before calling finish(). The guard exists specifically to enforce this behavior. Automating it away would defeat the purpose. The verification catches real issues (wrong content written, truncated files, path errors).

**Status**: Working as designed. The high frequency validates that the finish guard is driving verification behavior.

---

## Summary Table

| Rank | Pattern | 6h Count | Daily Est. | Ops Saved/Day | Complexity | ROI |
|------|---------|----------|------------|---------------|------------|-----|
| **1** | DB Query Wrapper | 434 | ~1,160 | ~329 | LOW | ★★★★★ |
| **2** | Session Analysis Tool | 181 | ~484 | ~145 | MEDIUM | ★★★★ |
| **3** | Git Commit Helper | 101 | ~270 | ~139 | LOW | ★★★★ |
| **4** | PATH Auto-Setup | 394 | ~1,053 | ~0* | LOW | ★★ |
| **5** | File Verification | 494 | ~1,321 | 0 | N/A | — |

*PATH setup saves tokens, not ops.

**Total actionable savings**: ~613 ops/day from patterns #1-3  
**As % of daily ops**: 613 / 6,731 = **9.1%**  
**Implementation effort**: ~5-6 hours total for all three scripts

---

## Methodology

1. Queried may.db for sessions with >15 ops started in last 6 hours (52 sessions found)
2. Parsed session.jsonl files for tool calls with name="bash"
3. Extracted 1,821 bash commands across all 52 sessions
4. Classified by structural pattern using regex matching
5. Counted frequencies and computed agent-level breakdowns
6. Estimated daily rates using 7-day average: 138.6 high-op sessions/day vs 52 in sample = 2.67× scale factor
7. Estimated op savings conservatively (replaced ops minus the 1 op the new tool would require)

**Limitations**:
- 6h sample may not represent full-day distribution (night hours have different patterns)
- Op savings estimates assume agents would adopt the tools (adoption rate unknown)
- Some "schema discovery" may be genuine exploration of unfamiliar tables, not boilerplate
- Token/cost savings from shorter commands not quantified

## Tags
`tool-gap`, `bash-patterns`, `automation`, `db-query`, `git-workflow`, `session-analysis`, `ops-savings`
