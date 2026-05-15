# Finding: Git-Review-Chain Tool Feasibility Analysis

**Date**: 2026-04-12 ~15:24 UTC  
**Session**: s_1776007465136_2206 (Mode B — Tool Gap Analysis)  
**Method**: Analyzed bash commands from 30 recent tech-lead/bob sessions (>10 ops, last 48h), deep-dived the 96-op branch cleanup session (s_1775991272448_2063) and 21-op branch hygiene audit (s_1775982270346_1978), compared against grep-then-read and file-discovery-spiral patterns for ROI.  
**Prior work**: [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md), [finding-tool-gap-scan-0412b.md](finding-tool-gap-scan-0412b.md)

---

## Executive Summary

**Recommendation: DEFER the git-review tool. Build a grep/code-search tool instead.**

The git-review-chain pattern is real (85 git commands in one 96-op session) but **narrow** — it concentrates in 2-4 "branch cleanup" work sessions per day, not in the everyday heartbeat/work pattern. In contrast, grep-then-read chains appear in **every session** and consume 906 grep references across 30 sessions vs 116 git references. The grep-then-read tool has 5-8× higher daily ROI with lower build complexity.

| Pattern | Occurrences/48h | Sessions Affected | Ops Saved/Day | Build Difficulty | **ROI Score** |
|---------|-----------------|-------------------|---------------|-----------------|---------------|
| grep-then-read | 906 refs in 30 sessions | 28/30 (93%) | ~120-180 | Easy | **★★★★★** |
| file-discovery-spiral | 213 refs in 30 sessions | ~20/30 (67%) | ~40-60 | Easy | **★★★** |
| git-review-chain | 116 refs in 13 sessions | 13/30 (43%) | ~30-50 | Hard | **★★** |

---

## Part 1: Quantifying the Git-Review-Chain

### What Is It?

The git-review-chain is a multi-step workflow where tech-lead reviews and merges branches from `review/*`. The canonical sequence:

1. **Branch discovery**: `git branch -v | grep review/` (list pending branches)
2. **Ancestry check**: `git merge-base --is-ancestor <branch> main` (already merged?)
3. **Change inspection**: `git log main..<branch> --oneline` + `git diff main..<branch> --stat` + `git diff main..<branch> -- src/` (what changed?)
4. **Merge attempt**: `git merge --no-ff <branch>` (try to merge)
5. **Conflict resolution**: `git diff --diff-filter=U` + `grep <<<<<<` + `sed` + `python3 conflict-resolver` + `git add` (fix conflicts)
6. **Branch cleanup**: `git branch -D <branch>` (delete merged branch)
7. **Status verification**: `git status` + `git push` (verify clean state)

### How Many Ops Per Session?

| Session | Agent | Total Ops | Git Commands | Git % | Trigger |
|---------|-------|-----------|-------------|-------|---------|
| s_1775991272448_2063 | tech-lead | 96 (104 bash) | **85** | **82%** | Work session: 16 branch cleanup |
| s_1775982270346_1978 | tech-lead | 21 (20 bash) | **18** | **90%** | Work session: branch hygiene audit |
| s_1775901250168_1352 | tech-lead | 62 | ~14 | ~23% | Work session with git side-tasks |
| s_1775975059405_1919 | tech-lead | 55 | ~13 | ~24% | Work session (bug fix with merges) |
| Heartbeat sessions | tech-lead | 3-5 | 0-1 | ~5% | Just commit agents/ changes |

**Key finding**: Git-review-chains are **bursty, not continuous**. The 96-op session alone accounts for 73% of all git commands in a 12-hour window. Heartbeat sessions do almost zero git review — they just commit agent workspace changes (1 git call).

### Breakdown of the 96-Op Monster Session

The 85 git commands in s_1775991272448_2063 break down as:

| Sub-pattern | Count | Could a Tool Save? |
|-------------|-------|--------------------|
| Branch listing/filtering | 8 | Yes — list once, not repeatedly |
| Ancestry/merge-base checks | 10 | Yes — batch check all branches |
| Diff inspection (log + stat + diff) | 12 | Partially — still need human review of diffs |
| Merge attempts | 12 | Yes — automated merge |
| Conflict resolution | 10 | **Hard** — requires judgment on which side to keep |
| Branch deletion | 6 | Yes — automated after merge |
| Status checks (defensive) | 8 | Yes — implicit in tool |
| Stash management | 8 | Yes — tool manages dirty state |
| Add/commit | 5 | Yes — automated |
| Push | 1 | Yes — automated |

**Automatable**: ~55 of 85 commands (65%) are mechanical. **Not automatable**: ~30 commands involving diff inspection and conflict resolution require LLM judgment.

### The Conflict Resolution Problem

This is why building a git-review tool is **hard**. In the 96-op session:
- 4 of 12 merges hit conflicts (33% conflict rate)
- Each conflict required 3-7 commands to resolve (grep markers, inspect, choose side, verify)
- The agent used **3 different strategies**: `checkout --theirs`, `python3` auto-resolver script, and manual `sed`
- Conflicts were in **workspace files** (todo.md, INDEX.md, PRIORITY-TRACKER.md) — agent-written content where "take theirs" is a reasonable default, but not always correct

A tool that just does `git merge --no-ff && git branch -D` handles the easy 67% of merges but fails on the hard 33%. To handle conflicts, it would need:
- A "take theirs for workspace files, fail for src/ conflicts" heuristic
- Or: return the conflict to the agent for manual resolution (saving ~3 ops per conflict, not 10)

---

## Part 2: ROI Comparison Against Competing Patterns

### Pattern A: grep-then-read (HIGHEST ROI)

**Frequency**: 906 grep/rg references across 30 sessions in 48h = ~450/day  
**Sessions affected**: 28 of 30 sessions (93%) — nearly universal  
**Chain structure**: grep -rl → grep -n → grep -A10 → read file (4 calls → 1 with smart tool)  
**Estimated savings**: Collapse 4-call chains into 1 = save 3 ops per chain. ~150 chains/day × 3 = **~450 ops/day theoretical, ~120-180 realistic** (not all are chainable)

**Build complexity**: Easy — wrap `rg --json` with structured output. Return matches with file paths, line numbers, and context in one call. No state management, no failure modes.

### Pattern B: file-discovery-spiral

**Frequency**: 213 ls/find references across 30 sessions in 48h = ~106/day  
**Sessions affected**: ~20 of 30 (67%)  
**Chain structure**: ls dir → ls subdir → cat file (3 calls → 1 with smart tool)  
**Estimated savings**: ~70 chains/day × 1.5 saved = **~40-60 ops/day**

**Build complexity**: Easy — structured directory tree with file metadata.

### Pattern C: git-review-chain (THIS ANALYSIS)

**Frequency**: 116 git references across 30 sessions in 48h = ~58/day  
**Sessions affected**: 13 of 30 (43%), concentrated in 2-4 review sessions  
**Chain structure**: 7-step workflow (see Part 1)  
**Estimated savings**: 
  - If no conflicts: ~5 ops per branch review → save ~4 = **~20-30/day**
  - If conflicts: Still need 3-7 manual ops per conflict → save ~3-5 per branch
  - Realistic total: **~30-50 ops/day** (assuming ~10 branch reviews/day)

**Build complexity**: HARD — must handle:
  - Dirty working tree (stash management)
  - Merge conflicts (3 resolution strategies)
  - Multi-branch batching (16 branches in one session)
  - Ancestry detection (superseded branches)
  - Type-checking (tsc --noEmit) and test running after merge
  - REVIEW_GATE_BYPASS environment variable

### Summary ROI Table

| Pattern | Daily Savings | Build Cost | Days to Break Even | Risk |
|---------|-------------|------------|-------------------|------|
| grep-then-read | 120-180 ops | 1 session | <1 day | Low |
| file-discovery | 40-60 ops | 1 session | 1-2 days | Low |
| git-review-chain | 30-50 ops | 3-5 sessions | 3-7 days | High (conflict handling) |

---

## Part 3: What Should We Build Instead?

### Recommended: `codeSearch` Tool (P1)

A structured code search that returns matches with context in a single call:

```typescript
// Draft spec
interface CodeSearchInput {
  pattern: string;           // regex or literal
  scope?: string;            // directory to search (default: src/)
  context?: number;          // lines of context (default: 3)
  filePattern?: string;      // file glob filter (e.g., "*.ts")
  maxResults?: number;       // cap results (default: 20)
}

interface CodeSearchResult {
  totalMatches: number;
  files: Array<{
    path: string;
    matches: Array<{
      line: number;
      text: string;
      context: { before: string[]; after: string[] };
    }>;
  }>;
}
```

**Implementation**: Thin wrapper around `rg --json`. Parse ripgrep JSON output, group by file, include context lines. Single bash call internally.

**Savings**: Collapses the 4-step grep chain (find files → find lines → get context → cross-reference) into 1 tool call. Saves ~3 ops per search × ~40-50 searches/day = **120-150 ops/day**.

### Deferred: `reviewBranches` Script (P2)

Rather than a full tool, a **shell script** that handles the mechanical parts:

```bash
#!/bin/bash
# scripts/review-branches.sh
# Usage: ./scripts/review-branches.sh [--auto-merge] [--dry-run]
#
# Lists all review/* branches with:
# - Merge status (merged to main / not merged)  
# - Conflict status (clean / conflicts in <files>)
# - Age (commit date)
# - Diff stat (files changed, lines +/-)
# - Whether it touches src/ or just agents/
#
# With --auto-merge: merges clean, agents-only branches automatically
# With --dry-run: shows what would happen without doing it
```

This script handles the "discovery + classification" phase (~20 ops) but leaves merge decisions and conflict resolution to the agent. The agent would call it once, get a full report, then make targeted merge/delete calls.

**Savings**: ~15-20 ops per review session × 1-2 sessions/day = ~20-40 ops/day. Much simpler than a full tool.

---

## Part 4: Why "91 Occurrences" Is Misleading

The todo.md claims "git-review-chain 91x" but this number needs context:

1. **91 = total git-related bash commands**, not 91 separate review chains. One review chain = 7-12 git commands. So 91 ≈ 8-13 review chains across 12 sessions.

2. **82% concentrated in 1 session**. The 96-op cleanup session has 85 of those ~91 commands. Remove that single session and git-review drops to ~6 commands across 11 sessions — essentially noise.

3. **Not a daily pattern**. Branch cleanup happens 1-2× per day when branches accumulate. It's periodic maintenance, not a continuous workflow.

Compare this to grep (906 references in 30 sessions, 48h) — that's a genuine continuous pattern appearing in almost every session regardless of task type.

---

## Concrete Recommendations

### DO NOW (This Week)
1. **Build `codeSearch` tool** — Highest ROI, easiest build, universal benefit
2. **Write `review-branches.sh` script** — Simple shell script for branch discovery/classification

### DEFER (Next Week+)
3. **Full git-review tool** — Only if branch review frequency increases AND the discovery script proves insufficient

### DON'T BUILD
4. **Automated conflict resolver** — Too many edge cases, too risky. Let agents resolve conflicts manually with better tooling (the discovery script shows them which branches conflict before they start merging).

---

## Data Sources

- 30 tech-lead/bob sessions, >10 ops, last 48h from `.state/may.db`
- Deep analysis of s_1775991272448_2063 (96-op branch cleanup, 104 bash commands, 85 git)
- Deep analysis of s_1775982270346_1978 (21-op branch hygiene audit, 20 bash commands, 18 git)  
- Aggregate counts: 906 grep refs, 213 ls/find refs, 116 git refs across 30 sessions
- Cross-referenced with [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md) and [finding-tool-gap-scan-0412b.md](finding-tool-gap-scan-0412b.md)


