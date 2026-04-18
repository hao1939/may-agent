# Finding: Tool Gap Analysis — Repetitive Multi-Step Bash Patterns
**Mode**: B (Tool Gap Analysis) | **Scan window**: 6h | **Date**: 2026-04-18T14:06Z

## Sessions Analyzed
Sampled 5 sessions with opCount>25 from last 6h (57, 49, 38, 38, 31 ops):
- `s_1776515111675_166` — coach, 57 ops (gym scenario work)
- `s_1776518709125_231` — coach, 49 ops (gym scenario creation)
- `s_1776507762393_100` — bob, 38 ops (hypothesis batch-resolve)
- `s_1776510063707_126` — scout, 38 ops (DD storage cleanup)
- `s_1776500605996_6` — bob, 31 ops (hypothesis resolution)

## Pattern 1: Git Archaeology Spirals (3/5 sessions)
**Sessions**: bob×2, scout
**Pattern**: Agent needs to find/restore files from git history. Executes 5-10 bash calls: `git log --all --oneline --name-only -- 'pattern'`, then `git show <sha> --stat`, then `git checkout <sha> -- <path>`, often with multiple retries for path typos.

**Example** (scout s_126): 8+ bash calls to locate and restore DD-763-768 files from git history — `git log --all --diff-filter=D`, `git log --all --oneline --name-only`, `git show`, `git checkout` with path corrections.

**Example** (bob s_6): 7 bash calls for git add/commit cycle with status checks, log checks, re-adds after failures.

**Automation opportunity**: `scripts/git-restore.sh <pattern>` — find deleted files matching a glob, show their last commit, optionally restore. Would save 4-6 calls per occurrence.

## Pattern 2: Hypothesis File Multi-Inspection (2/5 sessions)
**Sessions**: bob×2
**Pattern**: Sequential `head -N` and `tail -N` on 5+ hypothesis files to check status/metadata. Each file gets 2-3 reads (head for title, tail for status, grep for keywords).

**Example** (bob s_100): 10+ sequential `head -3`/`tail -5` calls across H-009, H-043, H-053, H-058, H-089 files, then individual `grep -l` and `grep -c` passes.

**Automation opportunity**: `scripts/hypothesis-status.sh [H-NNN...]` — dump title + status + last-updated for a batch of hypothesis files in one call. Would save 8-12 calls per batch-resolve session.

## Pattern 3: Gym Run Inspection Chains (2/5 sessions)  
**Sessions**: coach×2
**Pattern**: After gym runs, agent hunts through `/tmp/gym-run-*` and `/tmp/gym-batch-*` directories for results, transcripts, and judge verdicts. Multiple `ls`, `find`, `cat` calls to locate the right temp directory and extract results.

**Example** (coach s_166): 6+ calls: `ls /tmp/gym-batch-*`, `cat /tmp/gym-batch-*/results.jsonl`, `for d in /tmp/gym-run-*/; do...`, `cat /tmp/gym-run-*/work/transcript.jsonl`.

**Automation opportunity**: `scripts/gym-last-result.sh [scenario]` — show the most recent gym run result for a scenario (verdict, score, transcript excerpt). Would save 4-5 calls per gym iteration.

## Pattern 4: PATH Setup Repetition (3/5 sessions)
**Sessions**: coach×2, bob
**Pattern**: `export PATH=".state/.bun/bin:$PATH"` appears multiple times per session (coach s_231 had it 5 times). Each standalone PATH export is a wasted call.

**Automation opportunity**: Already in context.md but agents re-execute it. Could be auto-injected as shell init. Low priority — 1 call waste each time.

## Summary & Recommendations

| Pattern | Frequency | Calls Saved | Priority |
|---------|-----------|-------------|----------|
| Hypothesis batch inspection | 2 sessions/6h | 8-12/session | **HIGH** — bob does this daily |
| Git file archaeology | 3 sessions/6h | 4-6/session | **MEDIUM** — common across agents |
| Gym result inspection | 2 sessions/6h | 4-5/session | **MEDIUM** — coach-specific but frequent |
| PATH re-export | 3 sessions/6h | 1-2/session | LOW — minor waste |

**Top recommendation**: Build `scripts/hypothesis-status.sh` first — bob runs batch-resolve sessions ~3x/day, each wasting 8-12 calls on serial file inspection. Estimated savings: 24-36 calls/day.
