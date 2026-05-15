# Finding: Coach High-Op Session Tool Gap Analysis (EXP-136, EXP-138)

**Date**: 2026-04-11 ~13:24 UTC  
**Method**: Extracted and classified all tool calls from coach's two highest-op sessions today (EXP-136: 98 ops/116 calls, EXP-138: 87 ops/114 calls) from filesystem session data. Identified repeated multi-step bash patterns, cross-referenced with existing tools, and calculated potential savings.  
**Prior work**: Builds on [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md) (18 sessions, 626 bash commands, general patterns) and [finding-gym-batch-adoption-0411.md](finding-gym-batch-adoption-0411.md) (gym-batch.sh adoption gap).

---

## Executive Summary

**63% of ops in these two sessions (116 of 185) are saveable** with purpose-built tools. Only 13.8% of EXP-136 and 25.4% of EXP-138 ops are productive (directly contributing to deliverables). The dominant waste patterns are: JSONL guard-block scanning (36 ops), gym scenario discovery loops (33 ops), guard code archaeology via git (23 ops), git commit struggles with gitignore (19 ops), and repeated individual gym runs (12 ops).

Critically, **two existing tools would have saved 27 ops combined** but coach used neither:
- `session-query.ts` → 18 ops saved in EXP-136 (38 DB queries → ~3 commands)
- `gym-batch.sh` → 9 ops saved in EXP-138 (12 individual gym runs → ~3 batch commands)

Three **NEW tool gaps** emerge beyond the baseline analysis: guard-block-stats script (33 ops), git-safe-commit helper (16 ops), and gym-scenario-scaffold (20 ops).

---

## Session Profiles

### EXP-136: Guard Reliance Investigation (s_1775904868486_1381)
- **Task**: Investigate why some agents degrade with guards while others improve
- **Ops**: 98 (116 tool calls)
- **Duration**: ~21 minutes
- **Productive ops**: ~16 (13.8%)
- **Core output**: design.md + results/guard-rate-decomposition.md (2 files)

| Category | Count | % |
|----------|-------|---|
| DB_QUERY:SESSION | 33 | 28.4% |
| GREP | 29 | 25.0% |
| GIT:LOG | 11 | 9.5% |
| READ | 8 | 6.9% |
| FILE_READ (cat/head/sed) | 8 | 6.9% |
| GIT:SHOW | 5 | 4.3% |
| DB_QUERY:SCHEMA | 4 | 3.4% |
| Other (write/edit/setup/finish) | 18 | 15.5% |

### EXP-138: verify-wrap Workflow Prototype (s_1775908476406_1409)
- **Task**: Build and gym-test the verify-wrap workflow from EXP-137
- **Ops**: 87 (114 tool calls)
- **Duration**: ~19 minutes
- **Productive ops**: ~29 (25.4%)
- **Core output**: design.md + results.md + verify-wrap.ts + gym scenario (4 files)

| Category | Count | % |
|----------|-------|---|
| GREP | 28 | 24.6% |
| FILE_READ (cat/head) | 24 | 21.1% |
| READ (tool) | 17 | 14.9% |
| FILE_DISCOVERY (ls/find) | 8 | 7.0% |
| WRITE | 7 | 6.1% |
| GIT:COMMIT | 5 | 4.4% |
| GIT:STATUS/check-ignore | 5 | 4.4% |
| Other (setup/gym/inspect) | 20 | 17.5% |

---

## Waste Patterns Identified

### Pattern 1: Schema Discovery Spiral (EXP-136 ops 4-14, 11 ops)

Coach starts every DB investigation by discovering the schema from scratch:
```
Op 4: SELECT name FROM sqlite_master WHERE type='table'  — "what tables?"
Op 5: PRAGMA table_info(evaluations)                       — "what columns?"
Op 6: SELECT MIN/MAX/COUNT from sessions                   — "data range?"
Op 8: SELECT * FROM sessions LIMIT 3                       — "sample data?"
Op 9: SELECT COUNT(*) FROM session_digests
Op 10: SELECT COUNT(*) FROM evaluations
Op 12: SELECT name FROM sqlite_master  ← DUPLICATE of op 4!
Op 13: SELECT name FROM sqlite_master  ← TRIPLICATE!
Op 14: SELECT MIN/MAX from sessions    ← DUPLICATE of op 6!
```

**Root cause**: No persistent schema knowledge. The agent has no memory of the DB structure from prior sessions.  
**Existing tool**: `session-query.ts` would bypass schema discovery entirely.  
**Saveable**: ~8 ops per session with DB investigation.

### Pattern 2: Agent-Session Cross-Referencing (EXP-136 ops 29-35, 48-51, 11 ops)

Seven consecutive DB queries progressively narrowing bob sessions by date range, then four more queries re-doing the same agent→session mapping with slightly different filters:

```
Op 29: SELECT sessionId, agent, kind... FROM sessions  — all sessions
Op 30: ...WHERE startedAt > X AND agent IN (...)        — filter by date + agent
Op 31: ...WHERE agent IN ('bob','coach','tech-lead')    — different agent list
Op 32: ...WHERE agent IN ('bob','coach') AND startedAt  — narrower
Op 33: ...WHERE agent = 'bob' AND startedAt >= X        — single agent
Op 34: ...FROM sessions s WHERE s.startedAt >= X        — same with alias
Op 35: ...WHERE agent = 'bob' AND startedAt >= X        — same again
```

**Root cause**: Query results are insufficient, so agent adds filters progressively.  
**Existing tool**: `session-query.ts --agent bob --since 2d --sort ops` would return all this in 1 call.  
**Saveable**: ~10 ops.

### Pattern 3: Guard Code Archaeology (EXP-136 ops 40-47, 55-69, 23 ops)

The agent traces when the finish-guard was deployed by walking git history:

```
Ops 40-41: git log → git log specific commits — when was guard deployed?
Ops 42-44: git show specific commits — what changed?
Op 45: git show stat — which files?
Op 55-56: git log --oneline for finish-guard.ts — commit history
Op 57-59: DB queries cross-referencing dates with session data
Ops 61-69: git show, sed to read guard source, grep for patterns
```

**Root cause**: No deployment timeline data. Agent reconstructs it from git history.  
**New tool needed**: `deployment-history <file>` — returns commit history with dates and summarized diffs.  
**Saveable**: ~20 ops (collapse to 3: query tool, read current code, done).

### Pattern 4: Session JSONL Guard-Block Scanning (EXP-136 ops 16-28, 46-54, 73-86, 36 ops)

The largest waste pattern. Coach scans session JSONL files across the filesystem to count guard blocks, but hits multiple obstacles:

```
Ops 16-18: grep for FM-3.3 in session files — wrong patterns, refine
Ops 19-21: rg search — glob issues, wrong directory structure
Ops 22-24: find + xargs — too slow, need different approach
Ops 25-26: bun script to scan files — works but needs agent mapping
Ops 27-28: Cross-reference with DB for agent names
Ops 46-51: Refine counting methodology (grep -c vs actual block count)
Ops 53-54: Verify methodology (mentions ≠ blocks, need context)
Ops 73-80: Per-agent guard rate calculations
Ops 82-86: Deep dive into specific block sessions
```

**Root cause**: Guard block data isn't in may.db — it's scattered across thousands of JSONL files.  
**New tool needed**: `guard-block-stats [--agent X] [--since Y] [--fm-code FM-3.3]` — scans session files and returns block rates by agent/date.  
**Saveable**: ~33 ops (collapse 36→3: query, verify, done).

### Pattern 5: Gym Scenario Discovery + Setup (EXP-138 ops 4-17, 35-53, 33 ops)

Before building a gym scenario, coach spends 33 ops understanding the infrastructure:

```
Ops 4-7: ls/find to locate existing workflows and scenarios
Ops 8-10: read existing workflow implementations for reference
Ops 11-14: ls/find/cat to discover verification-related scenarios
Ops 15-17: read existing scenario configs for format reference
Ops 18-23: read gym-runner.ts to understand scenario format
Ops 35-40: write scenario files, discover they need specific format
Ops 41-46: grep gym-runner.ts for "inherits", "scenarioDir" — how to reuse?
Ops 47-53: cp environment, check --list, debug why scenario not found
```

**Root cause**: No documented scenario creation process. Agent reverse-engineers gym-runner.ts each time.  
**New tool needed**: `gym-scaffold <scenario-name> [--from existing-scenario]` — creates scenario.json + environment template + success_criteria.js.  
**Saveable**: ~20 ops (scaffold + copy from existing = 2 ops instead of 33).

### Pattern 6: Repeated Individual Gym Runs (EXP-138 ops 32-34, 68-81, 12 ops)

Coach runs gym trials one at a time:
```
Op 32: gym-run.sh convention-verify-edit --agent scout (first try)
Op 33: gym-run.sh convention-verify-edit --agent scout (retry with grep)
Op 34: gym-run.sh convention-verify-edit --agent scout (retry again)
Ops 68-72: 5x gym-run.sh convention-verify-edit baseline trials
Op 78: gym-run.sh verify-before-finish trial
Op 79: gym-run.sh skip-verification trial
Op 81: gym-run.sh compound-edit-verification trial
```

**Root cause**: Coach doesn't use gym-batch.sh (adoption = zero, known issue).  
**Existing tool**: `gym-batch.sh --trials 5 --agent scout convention-verify-edit` = 1 op.  
**Saveable**: ~9 ops (12 individual runs → 3 batch commands).

### Pattern 7: Git Commit Struggle (EXP-138 ops 91-109, 19 ops)

The git commit that should take 3 ops (add, commit, push) takes 19:
```
Op 91: git add -A (includes files that are gitignored)
Op 92-93: cat .gitignore to understand what's ignored
Op 94: git add specific files (partial success)
Op 95: git status --short (check what staged)
Op 96: ls -la (verify files exist)
Op 97: git add -f (force add gitignored files)
Op 98: git check-ignore -v (why are these ignored?)
Op 99: git ls-files (are they tracked?)
Op 100-101: git check-ignore + ls-files for other files
Op 102: git diff --stat HEAD
Ops 103-107: git diff, git log, git show (investigating dirty file)
Op 108: git add -A + git status
Op 109: git commit
```

**Root cause**: Coach doesn't know which files are gitignored until git refuses to add them.  
**New tool needed**: `git-safe-commit --message "..." [files...]` — pre-checks gitignore, suggests -f for intentional tracked files, handles the add+commit+push in 1 op.  
**Saveable**: ~16 ops.

---

## Tool Gap Summary

### Existing Tools Not Used (ADOPTION PROBLEM)

| Tool | Session | Ops Saveable | Root Cause |
|------|---------|-------------|------------|
| session-query.ts | EXP-136 | 18 | Zero adoption — not in coach context.md or experiment templates |
| gym-batch.sh | EXP-138 | 9 | Zero adoption — in context.md but coach doesn't execute it |
| **Subtotal** | | **27** | **Passive context mentions insufficient** |

### New Tool Gaps (BUILD THESE)

| Tool | Session(s) | Ops Saveable | Frequency Estimate |
|------|-----------|-------------|-------------------|
| guard-block-stats | EXP-136 | 33 | Any guard investigation experiment (~2/week) |
| gym-scenario-scaffold | EXP-138 | 20 | Every new experiment with gym testing (~3/week) |
| deployment-history | EXP-136 | 20 | Any investigation of deployed changes (~3/week) |
| git-safe-commit | EXP-138 | 16 | Any session writing to gitignored dirs (~5/week) |
| **Subtotal** | | **89** | |

### Combined Savings

| Category | Ops Saveable | % of Combined (185) |
|----------|-------------|---------------------|
| Existing tool adoption | 27 | 14.6% |
| New tools needed | 89 | 48.1% |
| **Total** | **116** | **62.7%** |

---

## Comparison with Baseline Analysis (finding-bash-command-patterns-0411.md)

| Metric | Baseline (18 sessions, general) | This Analysis (2 sessions, deep) |
|--------|-------------------------------|----------------------------------|
| Sessions | 18 (6h window, 30-50 ops each) | 2 (high-op: 98 and 87 ops) |
| Savings estimate | 26.2% reduction | **62.7% reduction** |
| Top waste | GREP (26.5%) + DB (23.2%) | JSONL scanning (19.5%) + Gym discovery (17.8%) |
| Existing tool adoption | 10/18 use fleet-status query | 0/2 use session-query or gym-batch |
| New findings | Convention dashboard, fleet-status tool | **guard-block-stats, gym-scaffold, git-safe-commit** |

The savings are much higher in high-op sessions because waste compounds: the agent doesn't just do 5 grep calls — it does 5, gets partial answers, does 5 more, hits a guard, tries a different approach for 5 more, etc. **High-op sessions are exploration spirals**, not just scaled-up versions of normal sessions.

---

## Key Insight: Why High-Op Sessions Have Low Productivity

Both sessions follow the same arc:
1. **Read context** (3-5 ops, productive) ✓
2. **Explore infrastructure** (15-33 ops, waste) — discovering schemas, file formats, tool capabilities
3. **Iterate on methodology** (10-36 ops, waste) — refining queries/greps because initial approach was wrong
4. **Produce output** (5-10 ops, productive) ✓
5. **Commit and finish** (3-19 ops, partially waste) — fighting gitignore, verifying commit

Phases 2-3 are where tools would help most. The agent is **competent at the analysis** (phases 1, 4) but **spends 60-80% of ops on infrastructure friction** (phases 2, 3, 5).

---

## Recommendations (Priority Order)

### P0: Fix Existing Tool Adoption (27 ops saveable/session)
- **session-query.ts**: Add to coach experiment templates. When task mentions "query sessions" or "analyze guard data", inject: "Use `scripts/session-query.ts --agent X --since Y` instead of raw bun -e SQL."
- **gym-batch.sh**: Add to gym-related experiment templates. When task mentions "run N trials", inject: "Use `scripts/gym-batch.sh --trials N --agent X scenario`."
- This is the **highest-ROI fix** — tools already exist, zero build work needed.

### P1: Build guard-block-stats Script (33 ops saveable/experiment)
- Script that scans session JSONL files for guard block patterns
- Inputs: `--agent`, `--since`, `--fm-code`, `--format [table|json]`
- Output: block rate by agent/day, block counts by FM code, sample blocked sessions
- Implementation: ~50 lines of TypeScript, uses `find` + bun JSONL parsing

### P1: Build gym-scenario-scaffold (20 ops saveable/experiment)
- Script that creates new gym scenario from template or existing scenario
- Inputs: `<name> [--from existing-scenario] [--agent target-agent]`
- Output: scenario.json + environment/ + success_criteria.js + task.md
- Implementation: ~40 lines of bash, copies template and substitutes variables

### P2: Build git-safe-commit Helper (16 ops saveable/session)
- Script that pre-checks gitignore, reports which files are ignored, suggests `-f`
- Inputs: `--message "..." [files or --all]`
- Output: Clean commit with no gitignore surprises
- Implementation: ~30 lines of bash

### P2: Build deployment-history Tool (20 ops saveable/investigation)
- Script that shows commit history for a file with dates and diff summaries
- Inputs: `<filepath> [--since date] [--oneline]`
- Output: Commit list with dates, author, and changed lines count
- Implementation: ~20 lines of bash wrapping `git log --follow --stat`

---

## Data Quality Notes

1. Tool calls in session JSONL use `block.type === 'toolCall'` with no tool name at the top level — tool name is inferred from arguments structure (command → bash, path → read/write/edit, action → agents, status → finish, summary → checkpoint).
2. Op count (from meta.json) differs from tool call count (from session JSONL) — 98 ops vs 116 calls for EXP-136, 87 ops vs 114 calls for EXP-138. Likely parallel tool calls count as 1 op.
3. Coach sessions are NOT in may.db (known issue) — all data from filesystem `.state/sessions/` analysis.
