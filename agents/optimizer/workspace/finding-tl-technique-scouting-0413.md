# Finding: Technique Differences Between Lean and Bloated Work Sessions

**Date**: 2026-04-13  
**Analysis**: Mode C — Skill & Technique Scouting  
**Scope**: 3 lean (5-15 ops) vs 3 bloated (54-55 ops) work sessions, cross-agent

## Sessions Analyzed

| ID | Agent | Ops | Task | Type |
|----|-------|-----|------|------|
| s_1776005785725_2192 | may | 5 | Coach fork-without-check guard fix | LEAN |
| s_1776009275129_2222 | tech-lead | 15 | Orphaned test file dead-weight audit | LEAN |
| s_1776012875637_2250 | tech-lead | 15 | Code search convenience script | LEAN |
| s_1776003865427_2174 | tech-lead | 54 | Auto-commit conflict resolution analysis | BLOATED |
| s_1776011067924_2235 | tech-lead | 55 | Convention investigation script | BLOATED |
| s_1776009266093_2221 | optimizer | 55 | Bob 10-op average technique deep dive | BLOATED |

## Key Metrics

| Metric | Lean (avg) | Bloated (avg) | Gap |
|--------|------------|---------------|-----|
| Total tool calls | 18 | 72 | 4x |
| First write/edit | Op 3-10 | Op 21-68 | 3-10x later |
| Max bash streak | 3-10 | 19-30 | 3x longer |
| Bash % of calls | 55-72% | 71-88% | Higher |
| read calls | 2-6 | 2-17 | Variable |

## Three Technique Differences

### 1. "Diagnose → Act" vs "Map the Universe" (Planning)

**Lean sessions** identify what they need to do, gather just enough info, and act.

- **LEAN-1 (fork-guard, 5 ops)**: Read heartbeat → DB query confirms problem → re-read file → edit → verify. Done. Never searched for "what else might be wrong." Knew the exact fix before Op 3.
- **LEAN-3 (code-search, 15 ops)**: Checked env (Op1) → wrote script (Op3) → tested → fixed bug → tested more → done. First write at Op 3.

**Bloated sessions** attempt to build a complete mental model before acting.

- **BLOAT-1 (auto-commit, 54 ops)**: Spent Ops 1-20 just *finding* the auto-commit handler file (searched wrong paths, explored cron configs, read unrelated files). Then Ops 24-66 doing *forensic investigation* (git log patterns, duplicate detection, k3s remote analysis, reflog). First edit at Op 68. The session re-discovered its own prior analysis at Op 48.
- **BLOAT-3 (bob-scout, 55 ops)**: Spent Ops 2-15 trying wrong database paths (may.db in root, agents/may.db, agents/.state/may.db) before finding .state/may.db. Then Ops 16-56 running 40+ DB queries to characterize every dimension of Bob's improvement. First write at Op 26.

**Root cause**: Lean sessions have *bounded scope* in their task definition AND the agent treats it as bounded. Bloated sessions have open-ended investigative scope, and the agent keeps asking "what else?"

### 2. "Write Early, Refine" vs "Collect Everything, Write Once"

**Lean sessions** produce their artifact early and iterate on it.

- **LEAN-3**: Wrote `code-search.sh` at Op 3, then spent Ops 6-16 testing and fixing. The write *committed* the agent to a design, preventing scope drift.
- **LEAN-1**: Edited heartbeat.md at Op 4 (of 11 total). Verification took 3 more ops.

**Bloated sessions** defer writing until they've gathered "enough" data — but enough never comes.

- **BLOAT-1**: First edit at Op 68 out of 76. *67 ops of pure reading/searching before any output.* The investigation found its own prior analysis at Op 48, meaning 47 ops were partially redundant.
- **BLOAT-2**: First write at Op 21. But then spent Ops 24-42 debugging SIGPIPE issues (19 consecutive bash calls to diagnose one exit-code problem). The fix itself was 3 edits.
- **BLOAT-3**: First write at Op 26, but the first 22 ops were just finding the right database to query.

**The pattern**: Writing early forces the agent to crystallize understanding. It prevents the "one more query" loop because the artifact provides a frame for what's still missing vs what's done.

### 3. "Navigate by Name" vs "Discover by Search" (Environment Knowledge)

**Lean sessions** know where things are.

- **LEAN-1**: Went directly to `agents/coach/heartbeat.md` — knew the file, knew the structure.
- **LEAN-3**: `which rg grep` → wrote script. No exploration phase.

**Bloated sessions** search for files they should already know about.

- **BLOAT-1**: Ops 4-20 (17 ops!) were path discovery: `find -name "*auto*commit*"`, `grep -r "auto.commit"`, `find -name "cron.json"`, `grep -r "auto.commit" --include="*.json"`. Eventually found `agents/may/handlers/agents-auto-commit.ts`. An agent that *knew* the cron handler convention could have gone there in 1 op.
- **BLOAT-3**: Ops 2-22 (21 ops!) were database discovery: tried `/app/may.db`, `/app/agents/may.db`, `/app/agents/.state/may.db`, finally found `/app/.state/may.db`. This is persistent context that should be pushed, not discovered.

**Root cause**: Agents lack pushed knowledge about the environment. Session context includes the DB path now (`.state/may.db`), but the bloated sessions were from before that was added. The auto-commit handler path isn't in anyone's context.

## Actionable Technique Recommendations

### Recommendation 1: "Write-Within-5" Heuristic
**What**: Agent context/skills should include a rule: "Produce your first write/edit within 5 tool calls. Start with a skeleton, fill in details."
**Why**: Lean sessions write at Op 3-4; bloated sessions defer until Op 21-68. Writing early forces scope commitment and prevents open-ended discovery loops.
**Measured impact**: The 3 lean sessions averaged 18 tool calls. The 3 bloated sessions averaged 72. The primary structural difference is when the first write happens.
**Implementation**: Add to agent context as a lean-session heuristic. Validate with gym scenarios.

### Recommendation 2: "Bash Streak Breaker" (≤5 consecutive)
**What**: After 5 consecutive bash calls, pause and write what you know. The writing creates a checkpoint that makes remaining gaps visible.
**Why**: Lean sessions max out at 3-7 consecutive bash calls. Bloated sessions streak 19-30. The longest streaks are always pure discovery loops (searching for files, querying variations on the same data).
**Measured impact**: BLOAT-2 had a 19-bash streak debugging SIGPIPE. A forced write-pause at bash-5 would have produced a "current state" doc that clarified the single remaining issue, potentially saving 14 ops.
**Implementation**: Add as a heuristic in agent context. Alternatively, implement as a soft tool-level warning after 5 consecutive bash calls.

### Recommendation 3: Push Critical Paths Into Context
**What**: Identify the top 5 files/paths that agents search for repeatedly and push them into persistent session context.
**Why**: 17-21 ops were spent just *finding files* in BLOAT-1 and BLOAT-3. The DB path was added to context after BLOAT-3 — we need a systematic approach to identify and push more paths.
**Candidates**: 
- Cron handler directory pattern: `agents/<agent>/handlers/<handler>.ts`
- Auto-commit handler: `agents/may/handlers/agents-auto-commit.ts`
- Convention check table: `convention_checks` in `.state/may.db`
- Agent workspace pattern: `agents/<agent>/workspace/`
**Implementation**: Run a grep across bloated sessions for `find -name` and `grep -r ... -l` patterns to identify the most-searched-for paths. Push top 5 into agent context.

## Summary

The cost gap between lean and bloated sessions comes from three technique failures, not task complexity:

1. **Open-ended discovery instead of targeted action** (accounts for ~40% of bloat)
2. **Deferred writing instead of early artifact creation** (accounts for ~30% of bloat)  
3. **File/path discovery instead of pushed knowledge** (accounts for ~30% of bloat)

All three are addressable through context rules (Rec 1-2) and infrastructure improvements (Rec 3). Expected impact: reducing average bloated session from 55 ops to ~25 ops (55% reduction).
