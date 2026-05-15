# Finding: Tech-Lead 86-op & 84-op Work Session Bash Dissection

**Date**: 2026-04-13 ~13:30 UTC  
**Session**: s_1776086529189_206 (Mode B — Tool Gap Analysis)  
**Method**: Extracted all tool calls from `session.jsonl` transcripts for the two highest-cost tech-lead work sessions in recent history. Categorized bash commands, identified waste patterns, and compared against the Apr 11 findings.  
**Prior work**: Builds on [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md) (626 bash commands across 18 sessions)

---

## Sessions Analyzed

| Session | Ops | Task | Bash Calls | Bash % |
|---------|-----|------|------------|--------|
| s_1776073935553_117 | 86 | Lens A: Session lifecycle state machine audit (manager.ts) | 87 | 85% |
| s_1776070334953_93 | 84 | P1 Experiment: Harness Engineering — Progress Checkpointing | 91 | 78% |

Both are **deep code/data investigation sessions** — not builds, not reviews. They're studying complex systems and writing findings. This is the most bash-intensive task type.

---

## Session 1: 86-op — "Session Lifecycle State Machine Audit"

### Tool Call Breakdown

| Tool | Count | % |
|------|-------|---|
| bash | 87 | 85.3% |
| read | 12 | 11.8% |
| write | 1 | 1.0% |
| checkpoint | 1 | 1.0% |
| finish | 1 | 1.0% |

### Bash Category Breakdown

| Category | Count | % of bash |
|----------|-------|-----------|
| FILE_READ_VIA_BASH (sed -n, cat, head, tail) | 43 | 49.4% |
| GREP_SEARCH | 41 | 47.1% |
| FILE_DISCOVERY (ls, find, wc) | 3 | 3.4% |

### The Core Anti-Pattern: sed -n Paging Through manager.ts

The agent read `src/lib/manager.ts` (2,471 lines) using **21 separate `sed -n` calls** plus **5 read() calls** — totaling **26 ops just on one file**. That's 30% of the entire session.

The sed ranges, in order:

```
640-710, 646-710, 709-835, 830-895, 835-900, 843-870,
925-1100, 985-1095, 1160-1270, 1241-1330, 1270-1340, 1330-1470,
1640-1730, 1757-1815, 1760-1820, 1820-1900, 1900-1960, 1960-1980,
1978-2045, 2060-2120, 2060-2140
```

**Analysis:**
- Total lines read via sed: 1,686
- Unique lines covered: 1,209 (48.9% of file)
- **Overlapping re-reads: 477 lines wasted** — ranges like 640-710 and 646-710, or 1757-1815 and 1760-1820 overlap heavily
- With read(offset/limit), this could be done in ~5 calls (read 200-line chunks)
- **Savings: 21 ops → 5 ops = 16 ops saved (19% of session)**

### Why sed Instead of read()?

The agent knows `read()` exists — it uses it 12 times. But it falls into `sed -n` for targeted ranges because:
1. After a grep that returns line numbers, `sed -n '640,710p'` feels natural
2. `read(path, {offset: 640, limit: 70})` is available but less "obvious" after grep output
3. The agent never reads the whole file at once — it does grep → sed-range → grep → sed-range in a loop

### Grep Chain Pattern

11 consecutive-grep runs, lengths: 5, 2, 2, 2, 3, 2, 2, 2, 3, 4, 4

Total grep calls: 41. These follow the classic pattern from the Apr 11 analysis:
1. Broad search: `grep -rn "pattern" src/lib/` 
2. Narrow: `grep -n "pattern" specific-file.ts`
3. Context: `grep -A 10 "pattern" specific-file.ts`
4. Cross-ref: `grep -rn "related-pattern" src/lib/`

### Unique Files Targeted (via grep)

The greps target `manager.ts` overwhelmingly:
- manager.ts: ~18 grep calls (44% of grep ops)
- persistence.ts, session-subscribers.ts, completion.ts: ~5-8 each
- Other (types.ts, event-bus.ts, manager-utils.ts): 1-3 each

### Session Phase Structure

| Phase | Ops | Description |
|-------|-----|-------------|
| Context reading | 6 | Read heartbeat, initial file reads |
| Grep discovery | 10 | Find function locations, cross-references |
| Deep-read via sed | 37 | Read function bodies through the file |
| More grep + cross-reference | 31 | Follow call chains, verify relationships |
| Write-up | 3 | Write audit findings, checkpoint, finish |
| **Total** | **87 bash + 15 other** | |

**Key insight**: 79% of the session (68 ops) is grep→sed→grep→sed loops through a single large file. This is a "reading comprehension" task executed with line-level tools.

---

## Session 2: 84-op — "Harness Engineering: Progress Checkpointing"

### Tool Call Breakdown

| Tool | Count | % |
|------|-------|---|
| bash | 91 | 77.8% |
| read | 19 | 16.2% |
| edit | 3 | 2.6% |
| checkpoint | 2 | 1.7% |
| finish | 2 | 1.7% |

### Bash Category Breakdown

| Category | Count | % of bash |
|----------|-------|-----------|
| FILE_READ_VIA_BASH (sed, cat, head, tail) | 35 | 38.5% |
| GREP_SEARCH | 25 | 27.5% |
| FILE_DISCOVERY (ls, find, wc) | 12 | 13.2% |
| DB_QUERY (sqlite3, python3) | 12 | 13.2% |
| GIT_OPS | 5 | 5.5% |
| OTHER | 2 | 2.2% |

### Anti-Pattern 1: DB Tool Confusion Spiral (ops 35-52, 18 ops wasted)

The session needed to query `.state/may.db` for session data. But the agent **didn't know** that:
- `sqlite3` CLI is not available in this environment
- `bun -e` with `bun:sqlite` is the correct DB query tool
- The database is at `.state/may.db` (not sessions.db, db.sqlite, requests.db, persist/may.db, etc.)

The resulting confusion consumed **18 ops**:

```
Op 35: sqlite3 .state/sessions.db ".tables" → fails silently
Op 36: sqlite3 .state/sessions.db ".schema" → fails
Op 40: sqlite3 .state/main.db → doesn't exist
Op 41: sqlite3 .state/db.sqlite → doesn't exist
Op 42: sqlite3 .state/requests.db → doesn't exist
Op 43: sqlite3 .state/requests.sqlite → doesn't exist  
Op 44: find .state -name "*.db" → finds files but can't read them
Op 45: sqlite3 .state/sessions.db again → still fails
Op 46: find .state -name "session-history*" → wrong approach
Op 47: grep -r "task_history" → searching source code for clues
Op 48: ls .state/sessions/history/ → found filesystem sessions
Op 49: grep "history" src/lib/manager.ts → still searching
...
Op 78: file .state/persist/may.db → exists but can't query
Op 79: sqlite3 .state/may.db → STILL fails (no sqlite3!)
Op 80: which sqlite3 → "no sqlite3" → finally tries python3
Op 81: python3 with sqlite3 → FINALLY WORKS
```

This is a **knowledge gap, not a tool gap**. The agent's persistent context should include:
- "sqlite3 CLI is not available — use `bun -e` with `bun:sqlite` or `python3` with `sqlite3`"
- "Session database is at `.state/may.db`"

**Note**: Tech-lead's context.md actually DOES include DB access instructions (`bun:sqlite`, `.state/may.db`). Yet this session still hit the 18-op spiral — the agent used `sqlite3` CLI and `python3` instead of `bun -e`. This means either: (a) context.md wasn't injected into this work session (it was a sub-call), or (b) the agent ignored it under investigation pressure. Either way, the knowledge needs to be pushed harder — perhaps into the task prompt itself for research sessions, or as a system-level tool hint.

**Savings: 18 ops → 2 ops = 16 ops saved (19% of session)**

### Anti-Pattern 2: 20 Numbered "Experiments" as Discovery Steps

The session ran "Experiment 1" through "Experiment 20" — each a bash call doing a slightly different query. Many of these are:
- Experiment 3: Try to find session_digests → fails
- Experiment 6: Try to find session data in main.db → doesn't exist
- Experiment 7: Try db.sqlite → doesn't exist
- Experiment 14-17: Finally working queries but asking one question per python3 invocation

A well-structured research session would:
1. Read the DB schema once (1 op)
2. Run a comprehensive multi-query analysis script (1-2 ops)
3. Interpret and follow up (2-3 ops)

Instead: 20 individual "experiments" = 20 ops for what could be 5.

### Anti-Pattern 3: Git Commit Confusion (ops 109-113, 5 ops)

```
109: cd /root/project && git add ... → wrong path
110: cd /app && git add ... → file not tracked
111: cd /app && git add -f ... → still fails
112: cd /app && git stash && git checkout -b review/... → finally works
113: cd /app && git checkout main → back to main
```

The agent tried `/root/project` (doesn't exist), then `git add` (file gitignored), then `git add -f` (wrong), before finally creating a review branch.

**This is the same commit-path confusion we see across agents.** The persistent context should include git workflow instructions.

### Anti-Pattern 4: Double finish() + Post-finish Work (ops 114-117)

The agent called `finish(success)` at op 114, then continued with 2 more bash calls and another `finish(success)` at op 117. The first finish was likely rejected (harness guards?) or the agent second-guessed itself.

### Session Phase Structure

| Phase | Ops | Waste | Description |
|-------|-----|-------|-------------|
| Read context + source | 32 | ~8 (re-reads) | Read research doc 6x, read source files |
| DB confusion spiral | 18 | **18** | Hunting for database path + tool |
| Data analysis (python3) | 30 | ~10 | 20 experiments as individual bash calls |
| Source grep for digest impl | 12 | ~3 | Understanding digest system |
| Write findings + edit | 6 | 0 | Actually writing output |
| Commit confusion | 5 | **4** | Wrong path, gitignore issues |
| Double finish | 4 | **2** | Post-finish work |
| Checkpoint | 2 | 0 | |
| **Total** | **117*** | **~45** | |

*117 tool calls but 84 opCount — some parallel calls counted as 1 op.

---

## Cross-Session Comparison

| Metric | 86-op (Code Audit) | 84-op (Research) |
|--------|-------------------|-------------------|
| Primary waste | sed -n paging (21 ops) | DB confusion spiral (18 ops) |
| Secondary waste | Grep chains (41 ops, ~20 avoidable) | Individual experiments (20 ops, ~10 avoidable) |
| Tertiary waste | — | Git commit confusion (4 ops) |
| Estimated avoidable ops | **~36 ops (42%)** | **~32 ops (38%)** |
| Hypothetical lean version | ~50 ops | ~52 ops |
| Could reach <30 ops? | No — task genuinely complex | No — task genuinely complex |

Both sessions have a **floor of ~50 ops** even with perfect tool usage — these are legitimately complex investigations. But ~35-40% of ops are avoidable waste.

---

## Comparison with Apr 11 Findings

| Pattern | Apr 11 (18 sessions) | Today (2 sessions) | Still Active? |
|---------|---------------------|---------------------|---------------|
| Grep chains | 166 calls, 26.5% | 66 calls, 37% | **Yes, worse in deep-dive sessions** |
| Convention drilling | 66 DB queries | 0 (different task type) | Not observed (task-dependent) |
| Fleet status duplication | 10/18 sessions | 0 (work sessions, not heartbeats) | Not applicable |
| sed -n file paging | Not measured | **21 calls in 1 session** | **New finding** |
| DB tool confusion | Not measured | **18 wasted ops** | **New finding** |
| Git commit confusion | Under "Git Archaeology" | **5 wasted ops** | **Confirmed** |

**Key new findings not in Apr 11 analysis:**
1. **sed -n as file reader** — agents use `sed -n 'start,endp'` instead of `read(path, {offset, limit})`, causing 21+ ops for a single large file
2. **DB tool/path confusion** — agents don't know sqlite3 is unavailable or where may.db lives, causing 18-op spiral
3. **Incremental experiment pattern** — agents structure research as numbered individual experiments instead of batching queries

---

## Concrete Fixes (2 Recommendations)

### Fix 1: Push DB Query Knowledge to All Agents (P0 — 16-18 ops/session saved)

**Problem**: Tech-lead used `sqlite3` CLI (12 attempts!) and `python3` for DB queries despite `bun:sqlite` being documented in its own context.md.  
**Root cause investigation**: Tech-lead's context.md already has `bun:sqlite` instructions, AND these were confirmed injected into this session's prompt (verified: "bun:sqlite" appears in session.jsonl first message). Yet the agent still used `sqlite3` CLI 12 times and `python3` for all DB queries. **Hypothesis 2 confirmed: context burial.** The agent ignores pushed context during deep investigation and reverts to "familiar" tools.

**Fix**: Two-pronged approach:
1. ~~Verify context injection~~ — **already injected, not the problem**
2. Add environment-aware error handling: when a `bash` call with `sqlite3` fails, the harness could inject a nudge: "sqlite3 CLI is not available. Use bun -e with bun:sqlite instead." This catches the failure at the point of use rather than relying on pre-read context.

**Why this works**: Context push (KE-026) failed here because agents ignore pre-loaded knowledge during deep investigation. Error-time nudges are harder to ignore — they appear at the exact moment the agent hits the wall, not 50 ops earlier in a prompt they've scrolled past.

**Estimated impact**: Eliminates the 18-op DB confusion spiral. Could affect many work sessions that do ad-hoc queries.

**Validation**: 
- ~~Check: does the 84-op session's system prompt include context.md content?~~ **YES — confirmed, context was injected, agent ignored it**
- Next: implement error-time nudge in harness (when bash output contains "sqlite3: command not found" or similar, append hint)
- After fix: measure tech-lead work session DB query efficiency

### Fix 2: Prompt Agents to Use read() with offset/limit Instead of sed -n (P1 — 15-20 ops/session saved)

**Problem**: When agents get a line number from grep, they reach for `sed -n 'X,Yp' file` instead of `read(file, {offset: X, limit: Y-X})`. This causes:
- No pagination hints (sed doesn't tell them what comes next)
- Small windows (average 70 lines per sed call)
- Overlapping ranges (477 wasted lines in this session)

**Fix**: Add to system prompt or agent context:
```
- To read specific sections of a file, use read(path, {offset: lineNum, limit: numLines}) — not sed/cat/head/tail. The read tool paginates and tells you what's left.
```

**Why this works**: The agent already uses `read()` 12 times — it just doesn't think to use it after getting a grep line number. A simple nudge should redirect behavior.

**Estimated impact**: Reduces 21 sed calls → ~5 read calls. For sessions that deep-dive into large files, saves 15-20 ops.

**Validation**: Run the same task type (code audit) after the change and measure. Target: <70 ops.

---

## Summary

These two sessions tell a clear story: **bloated sessions aren't doing unnecessary work — they're doing necessary work with unnecessarily expensive tool sequences.** The actual investigation tasks are valid and productive. The waste comes from:

1. **Missing environment knowledge** (38% of waste) — agents don't know what tools/paths are available
2. **Wrong tool for the job** (42% of waste) — sed -n instead of read(), individual bash calls instead of batched scripts
3. **Retry confusion** (20% of waste) — git commit failures, double finish()

The two proposed fixes target #1 and #2 respectively. Together they could reduce 84-86 op sessions to ~55-60 ops — still above the 5-15 op "lean" range (because the tasks are genuinely complex), but a meaningful 30-35% reduction.
