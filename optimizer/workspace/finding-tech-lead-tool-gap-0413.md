# Finding: Tool Gap Analysis — Tech-Lead 84-Op Experiment Session

**Date**: 2026-04-13
**Session analyzed**: `s_1776070334953_93` (84 ops, 12m55s)
**Task**: "P1 Experiment: Harness Engineering — Progress Checkpointing (Layer 4)"
**Cross-referenced**: `s_1776073935553_117` (86 ops, 8m51s, "Session lifecycle state machine audit")

## Session Profile

| Metric | Value |
|--------|-------|
| Total tool calls | 117 |
| bash calls | 91 (77.8%) |
| read() calls | 19 (16.2%) |
| edit() calls | 3 (2.6%) |
| checkpoint() | 2 |
| finish() | 2 (1 failed, 1 success) |
| Unique files read | 7 |
| Total file re-reads | 19 (12 were duplicates) |

## Phase Breakdown

The session falls into 4 distinct phases:

### Phase 1: Code Archaeology (Turns 1-18, ~18 turns)
**What happened**: Read 7 source files to understand checkpoint/digest/completion systems.
**Waste**: Re-read the SAME files after context compaction:
- `harness-engineering-long-running-agents.md`: **6 reads** (turns 1, 9, 10, 17, 18, 50)
- `session-digest.ts`: **4 reads** (turns 8, 13, 14, 46)
- `checkpoint.ts`: **2 reads** (turns 3, 11)
- `manager.ts`: **2 reads** (turns 5, 12)
- `completion.ts`: **2 reads** (turns 6, 15)
- `session-subscribers.ts`: **2 reads** (turns 7, 16)

**Root cause**: Context compaction at ~turn 9 evicted the file contents from the LLM's window. The agent re-read ALL files it had already read. This is a **compaction-driven re-read spiral** — 12 redundant reads consuming ~12 ops.

### Phase 2: Database Discovery Spiral (Turns 20-39, ~20 turns)
**What happened**: Agent tried to find where session/digest data lives in the filesystem.
**Waste**: A massive trial-and-error search across DB files:
- T20: Checked `.state/digests.db` — doesn't exist
- T21: Tried `sqlite3 .state/sessions.db` — empty
- T22: Tried `sqlite3 .state/db.sqlite` — empty  
- T23: Tried `sqlite3 .state/requests.db`, `requests.sqlite` — miss
- T23: `find .state -name "*.db" ...` — found many but couldn't read them
- T24: Tried `sqlite3 .state/sessions.db .schema` — empty
- T24: Searched for session history in filesystem
- T25: Found `.state/sessions/history/` but needed structured data
- T26-29: Tried parsing `session.jsonl` files manually — complex
- T30: Wrote 99-line python script to parse session.jsonl
- T35: Tried `.state/persist/may.db` — wrong one
- T36: Grepped for `getDb` in source code
- T37: Finally narrowed to `.state/may.db` (172MB)
- T38: Tried `sqlite3 .state/may.db` — `sqlite3` not available!
- T39: Discovered need for python3 with sqlite3 module
- T40: Finally running queries against `.state/may.db`

**20 turns to find the database and figure out how to query it.** The agent didn't know:
1. Which DB file contains session data (`.state/may.db`)
2. That `sqlite3` CLI isn't available
3. That `bun:sqlite` or `python3 sqlite3` are the alternatives
4. The schema of session_digests, sessions tables

### Phase 3: Empirical Analysis (Turns 40-49, ~10 turns)
**What happened**: Ran 20 "experiments" (python3 scripts querying the DB). This was productive work.
**Waste**: Minimal — some queries returned empty/None results requiring fixups (T41).

### Phase 4: Writing + Git (Turns 50-67, ~18 turns)
**What happened**: Wrote experiment findings, committed to review branch.
**Waste**: 
- T50: Re-read research project file AGAIN (6th time total)
- T59: Tried `cd /root/project && git ...` — wrong path
- T60-63: Multiple git commit attempts (wrong dir, force-add needed, branch checkout)

## Identified Tool Gaps

### Gap 1: No "DB Quick-Query" Tool (saves ~20 ops)
**Problem**: Agent spent 20 turns just finding where data lives and how to query it.
**Current state**: Agents must discover DB paths, schemas, and available query tools from scratch.
**What exists**: `scripts/session-query.ts` exists but the agent never used it — it wasn't pushed to it.

**Recommendation**: A `db-query` helper script or documented cheat sheet:
```
# .state/may.db — main database (172MB)
# Tables: sessions, session_digests, evaluations, requests, gym_runs, gym_checks, ...
# Query with: bun -e "import {Database} from 'bun:sqlite'; ..."
# OR: python3 -c "import sqlite3; ..."
# sqlite3 CLI is NOT available
```

**Estimated savings**: 15-20 ops per data-investigation session

### Gap 2: Compaction-Driven Re-Read Spiral (saves ~12 ops)
**Problem**: After context compaction, agent lost file contents and re-read all 7 files.
**Current state**: Compaction preserves a "files read" list but not the content. The agent checkpoint'd BEFORE compaction but the checkpoint only captured a summary, not the extracted data.

**Recommendation**: Two options:
1. **Better checkpoint data**: When agents read source files, they should `checkpoint()` their extracted understanding immediately — not just file paths. This way post-compaction, they can resume from the checkpoint rather than re-reading.
2. **Compaction-aware file caching**: If the compaction system could preserve small critical file contents (e.g., <200 lines), the re-read spiral would be eliminated.

**Estimated savings**: 10-12 ops per long session with compaction

### Gap 3: No Session Transcript Analysis Tool (saves ~5 ops)
**Problem**: The session analyzed here IS doing what I'm doing — analyzing tool call patterns from session transcripts. But there's no structured tool for it.
**Current state**: Agents write custom python/bun scripts each time to parse session.jsonl files.

**Recommendation**: Extend `scripts/session-query.ts` with `--tools` flag that outputs tool call statistics:
```bash
bun scripts/session-query.ts --session s_1776070334953_93 --tools
# Output: bash:91, read:19, edit:3, checkpoint:2, finish:2
#         Re-reads: manager.ts(2), digest.ts(4), ...
```

**Estimated savings**: 3-5 ops per session analysis task

### Gap 4: Git Workflow Friction (saves ~3 ops)
**Problem**: Agent tried wrong paths (`/root/project`), needed multiple attempts for branch creation + commit.
**Current state**: Each agent re-discovers git workflow each session.

**What exists**: `scripts/auto-commit-agents.sh` exists but the agent used manual git.

**Estimated savings**: 2-3 ops per session with git commits

## Cross-Reference: 86-Op Session (s_1776073935553_117)

The other high-op tech-lead session today shows the **exact same patterns**:
- **87 bash / 12 read** calls (same ratio)
- `manager.ts` read **5 times** (same re-read problem)
- `heartbeat.md` read **4 times**

This confirms the re-read spiral is systematic, not a one-off.

## Cross-Reference: Other High-Op Sessions (48h)

| Session | Ops | Pattern |
|---------|-----|---------|
| `s_1775991272448_2063` | 96 | Branch cleanup — likely git-heavy |
| `s_1776073935553_117` | 86 | State machine audit — same re-read pattern |
| `s_1776070334953_93` | 84 | **This session** — checkpointing experiment |
| `s_1775951649843_1706` | 81 | Investigation — likely DB spiral |
| `s_1775973259186_1900` | 69 | Workflow fix — likely code+test cycles |
| `s_1776059588245_11` | 63 | Review sprint — multiple branch operations |

## Summary: Estimated Savings

| Gap | Ops Saved | Sessions Affected | Implementation Effort |
|-----|-----------|-------------------|----------------------|
| DB cheat sheet injection | 15-20 | Any data investigation | Low (add to context) |
| Compaction-aware checkpointing | 10-12 | Any session >30 turns | Medium |
| Session transcript analysis tool | 3-5 | Optimizer/analyst sessions | Low (extend existing) |
| Git workflow helper | 2-3 | Any session with commits | Low (docs/alias) |
| **Total** | **30-40 ops** | | |

For the 84-op session specifically, Gaps 1+2 alone would have reduced it to ~50-55 ops — a **36-40% reduction**.

## Concrete Next Steps

1. **Quick win**: Add DB query cheat sheet to agent context injection (push, don't pull — KE-026)
2. **Quick win**: Add `session-query.ts --tools` flag for transcript analysis
3. **Medium effort**: Improve checkpoint() to capture extracted understanding, not just file paths
4. **Research**: Evaluate compaction-aware file caching (would need infra changes)
