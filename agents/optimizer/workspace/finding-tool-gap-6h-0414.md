# Finding: Tool Gap Analysis — High-Op Sessions (6h Window, Apr 14)

**Date**: 2026-04-14 ~13:52 UTC  
**Session**: s_1776174730102_148 (Mode B — Tool Gap Analysis)  
**Method**: Extracted bash commands from session.jsonl of the 575-op may session (the only session with on-disk transcripts in the 6h window). Classified 544 bash commands into categories, identified consecutive streaks and multi-step patterns.  
**Prior work**: Builds on [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md) (Apr 11, 18 tech-lead/coach sessions, 626 bash commands)

---

## Executive Summary

The 575-op may session burned **544 bash calls** (95% of ops) across a 4-hour workspace governance task. Three patterns dominate: **grep chains (35%, 190 cmds)**, **file read cascades (25%, 134 cmds)**, and **git operations (17%, 95 cmds)**. The session hit a **33-command consecutive bash streak** — a workspace survey that iterated through every agent directory with `echo "=== X ===" && ls/du/find`.

Compared to the Apr 11 analysis, two of three recommended tools were built (convention-investigate.sh, review-merge.sh). The remaining gap is a **workspace/fleet survey tool** that eliminates the agent-dir iteration pattern (82 echo-survey commands in this session alone). A new gap emerged: **git commit cycles** with rollback-and-retry patterns consuming 34+ git-add ops.

## Data Source

Only 1 of 8 high-op sessions from the last 6h had transcripts on disk:

| Session | Agent | Ops | Task | Transcript |
|---------|-------|-----|------|------------|
| s_1776159729124_0 | **may** | **575** | Workspace governance / guard system | ✅ 1,549 lines |
| s_1776172958751_129 | tech-lead | 86 | P0 workflow.run() directive | ❌ |
| s_1776169082223_80 | optimizer | 88 | QA 58% interrupt rate investigation | ❌ |
| s_1776167530842_75 | tech-lead | 63 | Scenario oracle generator | ❌ |
| s_1776171153688_110 | tech-lead | 61 | Branch merge | ❌ |
| s_1776163966393_44 | bob | 69 | EXP-RECOGNITION design | ❌ |
| s_1776171148167_109 | coder | 44 | Branch merges | ❌ |
| s_1776171098049_103 | coach | 43 | Common-sense verify | ❌ |

**Limitation**: Only the persistent may session (which ran >4h) retains its full transcript. Child sessions' `.state/sessions/` dirs don't have transcripts. This analysis is therefore concentrated on the may session — the patterns found are representative of may's long-running governance work, not necessarily of all agents.

## Command Category Distribution (544 bash commands)

| Category | Count | % | Change from Apr 11 |
|----------|-------|---|--------------------|
| GREP_SEARCH | 190 | 35% | ↑ from 26.5% |
| FILE_READ (cat/head/tail/wc) | 134 | 25% | ↑ from 11% |
| GIT_OPS | 95 | 17% | ↑ from 5.9% |
| FILE_DISCOVERY (find) | 42 | 8% | ≈ same (9.3%) |
| DIR_LIST (ls) | 32 | 6% | New sub-category |
| FILE_OPS (sed/cp/mv/rm/mkdir) | 19 | 3% | — |
| DB_QUERY | 18 | 3% | ↓↓ from 23.2% |
| OTHER | 13 | 2% | — |
| TEST_RUN | 1 | 0% | — |

**Key shift**: DB queries dropped from 23.2% to 3% — may's governance task didn't need convention_checks. Git ops surged from 5.9% to 17% due to complex multi-commit workspace reorganization with rollbacks.

## Consecutive Bash Streaks

| Streak Length | Count | Total Ops | Notable |
|---------------|-------|-----------|---------|
| 1 | 28 | 28 | Single isolated bash calls |
| 2-3 | 37 | 93 | Normal investigation pairs |
| 4-5 | 21 | 93 | Moderate chains |
| 6-10 | 12 | 87 | Extended investigation loops |
| 11-15 | 7 | 88 | Agent-dir surveys, cron exploration |
| 19-25 | 3 | 64 | Major exploration bursts |
| 33 | 1 | 33 | Workspace survey mega-streak |
| **Total** | **112** | **544** | — |

**48% of bash ops are in streaks of 6+** (272 ops in 23 streaks). These are the automation targets.

## Top 3 Multi-Step Patterns

### Pattern 1: Agent Directory Survey (82 ops, 15% of all bash)

The session executed 82 commands using the `echo "=== X ===" && ls/du/find` format to survey agent workspaces. The longest streak (33 consecutive bash calls) was entirely this pattern:

```bash
echo "=== BOB workspace (1203 files) ===" && ls agents/bob/workspace/ | head -30
echo "=== COACH workspace (399 files) ===" && for d in agents/coach/workspace/*/; do echo ...
echo "=== OPTIMIZER workspace (475 files) ===" && for d in agents/optimizer/workspace/*/; do echo ...
# ... repeated for all 8 agents
```

Additionally, 13 `for agent in agents/*` loops iterated all agent dirs. Combined: **~95 ops on workspace surveying**.

**Why this happens**: May does workspace governance — understanding file counts, disk usage, staleness per agent. No tool exists that provides a structured workspace overview.

**Tool proposal**: `scripts/workspace-survey.sh [agent]` — produces a structured report:
```
Agent       Files  Size    Stale(>7d)  Archive
bob         1203   48M     412         yes (32M)
coach        399   12M     88          yes (8M)
optimizer    475   18M     201         yes (14M)
...
```
**Estimated savings**: 40-60 ops per governance session (collapse 82 echo-surveys + 13 for-loops into 1-2 calls)

### Pattern 2: Git Commit Spirals (95 ops, 17% of all bash)

The session had multiple commit-retry cycles:
- 34 `git add` commands (most individually adding specific files)
- 5 `git commit` attempts (some failed due to review gate)  
- 6 `REVIEW_GATE_BYPASS=1 git commit` commands
- 4 `git reset` rollbacks
- 8 `git checkout` file-level restores

**The anti-pattern**: Stage files → try commit → blocked by review gate → reset → re-stage subset → bypass commit. This happened at least 3 times:

```bash
git add -A && git commit -m "..."         # Fails: review gate
git reset HEAD -- file1 file2             # Unstage problematic files  
git reset HEAD -- file3 file4             # Unstage more
REVIEW_GATE_BYPASS=1 git commit -m "..."  # Force it through
git status --short                        # Check what's left
```

**Why this happens**: The review gate hook rejects commits that touch certain paths. May doesn't know a priori which paths will trigger it, so it trial-and-errors.

**Tool proposal**: `scripts/smart-commit.sh [-m "message"] [--bypass] [--exclude pattern]` — stages, checks which files would trigger the review gate, auto-excludes them or prompts, then commits. Or at minimum: `scripts/review-gate-check.sh` that shows which staged files would trigger the gate _before_ attempting the commit.

**Estimated savings**: 15-25 ops per multi-file commit (collapse 34 git-add + 5 failed commits + 4 resets into 1-2 calls)

### Pattern 3: Cross-Reference Grep Chains (72 consecutive grep-to-grep transitions)

72 times, a grep was immediately followed by another grep in the same directory. The top search areas:

| Target Directory | Grep Count |
|------------------|-----------|
| src/lib | 51 |
| agents/shared | 39 |
| agents/may | 35 |
| src/app | 8 |

The most-repeated search terms reveal investigation cascades:
- 7× `shared/research-projects` — tracking references during a rename  
- 4× `runFunction` — investigating workflow plumbing
- 4× `drops|drop` — investigating dropped data
- 4× `knowledge-base` — tracking stale references

**Why this happens**: Despite `code-search.ts` existing, the may session used raw grep 190 times. The tool isn't being adopted — likely because agents reach for `grep` out of habit, and the code-search tool requires remembering its interface.

**Partial mitigation already exists**: code-search.sh/code-search.ts were built after the Apr 11 analysis. The adoption gap is the real problem — the tool exists but isn't used.

**Recommendation**: Don't build another tool. Instead, inject a reminder into may's context.md: "Use `bun scripts/code-search.ts 'pattern' -s src/` instead of grep chains". The tool already does what's needed — it just needs promotion.

**Estimated savings if adopted**: 50-80 ops (collapse 3-5 grep chains per investigation into single code-search calls)

## Comparison with Apr 11 Finding

| Recommended Tool (Apr 11) | Status | Impact |
|----------------------------|--------|--------|
| Convention Dashboard | ✅ Built: `scripts/convention-investigate.sh` | Reduced coach convention drilling from 66 queries to ~5 |
| Fleet Status Tool | ❌ Not built (low priority) | Still duplicated, but only 10 ops/6h |
| Branch Review Tool | ✅ Built: `scripts/review-merge.sh` | Collapsed tech-lead 7-step merge into 1 call |
| Code Search | ✅ Already existed: `scripts/code-search.ts` | **NOT ADOPTED** — may still uses raw grep (190 times) |
| Experiment Status | ❌ Not built | Coach pattern — not visible in may session |

**New gaps identified today** (not in Apr 11 analysis):

| Gap | Ops Burned | Why New |
|-----|-----------|---------|
| Workspace survey | 95 | May's governance role is new (Apr 14 task) |
| Git commit spiral | 95 | Review gate interactions weren't analyzed before |
| Code-search adoption | 190 (potential) | Tool existed but wasn't promoted |

## Tool Recommendations (Priority-Ordered)

### P0: Workspace Survey Script

**Pattern**: 95 ops on agent-dir iteration (15% of session)  
**Implementation**: Bash script that runs `find` + `du` + `stat` across all agent workspaces, outputs structured table  
**Savings**: 40-60 ops per governance session  
**Difficulty**: Easy — pure bash, no DB, no complex logic  
**ROI**: Immediate for may's governance tasks

### P1: Smart Commit / Review Gate Pre-Check

**Pattern**: 95 git ops with 6 REVIEW_GATE_BYPASS and 4 rollbacks  
**Implementation**: Script that (a) checks which staged files trigger the review gate, (b) auto-excludes or reports before committing  
**Savings**: 15-25 ops per multi-file commit  
**Difficulty**: Medium — needs to understand the review gate's path rules  
**ROI**: High for may and tech-lead (both do complex multi-file commits)

### P2: Code-Search Adoption Push

**Pattern**: 190 raw grep calls despite code-search.ts existing  
**Implementation**: Add to may's context.md: `Use scripts/code-search.ts for multi-file searches`  
**Savings**: 50-80 ops if adopted (based on 3-5 grep chain collapse ratio from Apr 11 data)  
**Difficulty**: Trivial — one line in context.md  
**ROI**: Highest potential savings, but depends on agent compliance

## Total Potential Savings

| Tool | Ops Saved | % of Session |
|------|-----------|-------------|
| Workspace Survey | 40-60 | 7-11% |
| Smart Commit | 15-25 | 3-5% |
| Code-Search Adoption | 50-80 | 9-15% |
| **Combined** | **105-165** | **19-30%** |

A 575-op session could potentially run in **410-470 ops** with these three interventions — a **19-30% reduction**. The Apr 11 analysis estimated 37-69% savings for tech-lead/coach; the may session shows somewhat lower savings because its task (workspace governance) is inherently exploratory and less pattern-repetitive than heartbeat-style work.
