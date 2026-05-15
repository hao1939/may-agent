# Finding: Coach Investigation Session Tool Gaps — Why 80-100 Op Sessions Happen

**Date**: 2026-04-12 ~10:55 UTC  
**Author**: Optimizer  
**Scope**: 5 highest-op coach sessions in last 12h (162, 98, 98, 95, 93 ops)  
**Method**: Extracted tool call sequences from session.jsonl, classified each call, identified repetitive patterns across sessions  
**Prior work**: [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md), [finding-coach-work-session-cost-analysis-0412.md](finding-coach-work-session-cost-analysis-0412.md)

---

## Executive Summary

The 4 convention investigation sessions (98, 98, 95, 93 ops) share a **strikingly uniform structure**: they spend 60-70% of ops on the same three activities regardless of which convention or agent they're investigating. This isn't "interactive curiosity" — it's a **fixed investigation protocol** that the coach executes manually each time.

The three repeating phases, with per-session op counts:

| Phase | bob C1.5 | optim C12.1 | QA C1.1/C1.4/C8.2 | May C7.1 | Avg |
|-------|----------|-------------|---------------------|----------|-----|
| 1. DB querying (convention_checks + sessions) | 41 | 32 | 31 | 25 | **32** |
| 2. Code searching (GREP convention handler + agent files) | 25 | 21 | 39 | 29 | **29** |
| 3. Git archaeology (when was change introduced?) | 10 | 23 | 13 | 16 | **16** |
| **Investigation subtotal** | **76** | **76** | **83** | **70** | **76** |
| Overhead (LS/find, write, finish, etc.) | 34 | 28 | 21 | 28 | **28** |
| **Total** | **110** | **104** | **104** | **98** | **104** |

**76 of 104 ops (73%) are investigation steps.** The remaining 28 are discovery, writing, and session management.

---

## Sessions Analyzed

| # | Session ID | Ops | Type | Task |
|---|-----------|-----|------|------|
| 1 | s_1775957061724_1754 | 162 | EXP-144 Pilot (gym execution) | Format-decoupled gate calibration |
| 2 | s_1775969668094_1865 | 98 | **Convention investigation** | Bob C1.5 ghost deliverable regression |
| 3 | s_1775967880067_1849 | 98 | **Convention investigation** | Optimizer C12.1 read-context-first regression |
| 4 | s_1775971463782_1883 | 95 | **Convention investigation** | QA C1.1, C1.4, C8.2 regressions |
| 5 | s_1775973401506_1905 | 93 | **Convention investigation** | May C7.1 path hallucination |

Session #1 (EXP-144, 162 ops) is a gym execution session — different problem, covered by gym-batch finding. **Sessions 2-5 are all convention regression investigations and share nearly identical tool sequences.**

---

## The Convention Investigation Archetype

Every investigation session follows the same implicit protocol:

### Phase 1: "What's the data?" — DB Query Cascade (avg 32 ops)

The session opens with 8-15 consecutive DB queries:

```
Step 1: PRAGMA table_info(convention_checks)        — Schema discovery
Step 2: SELECT DISTINCT convention FROM ... WHERE agent = ?  — What conventions exist?
Step 3: SELECT date, COUNT, SUM(passed) GROUP BY date   — Trend over time
Step 4: SELECT session_id, violations WHERE passed = 0   — Failing sessions
Step 5: SELECT name FROM sqlite_master               — What other tables exist?
Step 6: (repeat steps 3-5 with different filters)
```

**The schema discovery problem**: In 4/4 investigation sessions, the coach ran PRAGMA or sqlite_master queries — totaling **26 schema discovery ops** across the 4 sessions (avg 6.5 per session). Every time the coach connects to the DB, it doesn't know the schema. This is identical boilerplate every single session.

**The DB open overhead**: Each query is a standalone `bun -e "import {Database}..."` script. The import, Database creation, and query construction are repeated verbatim. Sessions 2-5 had 25-41 standalone DB scripts each.

### Phase 2: "How does the checker work?" — Convention Handler Grep Chain (avg 29 ops)

After understanding the data, the coach always needs to understand the checking mechanism:

```
Step 15: grep -n "C1.5" agents/may/handlers/convention-check.ts
Step 16: sed -n '440,480p' convention-check.ts       — Read the check function
Step 17: sed -n '565,600p' convention-check.ts       — Read related code
Step 18: grep -n "isInterrupted" convention-check.ts — Check edge cases
Step 19: grep -n "transcript|readFile" convention-check.ts — How does it read sessions?
Step 20: (5 more grep calls cross-referencing agent SOUL.md, heartbeat.md, context.md)
```

**The convention handler is 1,141 lines.** Every investigation needs to navigate it by grepping section by section. The coach reads 3-8 partial sections of this file per investigation. Across 4 sessions: **46 ops spent reading convention-check.ts** (8-20 per session).

### Phase 3: "When did this break?" — Git Archaeology (avg 16 ops)

Once the coach knows what's failing and how the checker works, it traces the timeline:

```
Step 30: git log --oneline -5 -- qa/heartbeat.md     — Recent changes to this file?
Step 31: git show <hash> -- qa/context.md             — What was changed?
Step 32: git log --after="2026-04-09" -- qa/SOUL.md   — When did it change?
Step 33: git diff <hash1>..<hash2> -- qa/heartbeat.md — What's different?
Step 34: git log --format="%h %ai %s" -- qa/context.md — Full history
Step 35: git show <hash> --stat                        — Which files changed?
Step 36: git show <hash> -- specific-file.ts          — What exactly changed?
```

**Consecutive git chains** observed across sessions:
- bob C1.5: 2 chains (lengths 2, 5) = 7 git ops
- optimizer C12.1: 4 chains (lengths 4, 6, 7, 5) = 22 git ops  
- QA conventions: 2 chains (lengths 3, 4) = 7 git ops
- May C7.1: 7 chains (lengths 2, 3, 2, 2, 2, 2, 3) = 16 git ops

The optimizer session spent **22 git ops** tracing when the deliverable-checklist.md was introduced and how it affected C12.1 scoring. This is a single question ("when was this file added and by which commit?") answered over 22 separate git commands.

---

## Specific Tool/Script Gaps

### Gap 1: Convention Investigation Script (HIGHEST IMPACT)

**What's missing**: A single script that, given a convention ID and agent, returns:
1. Pass/fail rates by day (last 7 days)
2. Current failing sessions with violations text
3. The specific check logic from convention-check.ts (extracted section)
4. Recent git changes to agent files that could affect this convention

**Current cost**: ~60 ops per investigation (data query + handler reading + git history)  
**With script**: ~5 ops (run script + read result + write finding)  
**Savings**: ~55 ops per convention investigation

**Why this is #1**: We had **4 convention investigations in the last 6 hours**, all following the exact same protocol. At the current dispatch rate (~2 per day), this would save **~110 ops/day**.

**Implementation sketch** (bash script calling bun):
```bash
#!/bin/bash
# scripts/convention-investigate.sh <convention> <agent>
# Returns: pass rates, failing sessions, check logic, related changes
```

### Gap 2: DB Schema Documentation / Helper (HIGH IMPACT)

**What's missing**: The coach doesn't know the may.db schema when it starts. Every session burns 5-10 ops discovering tables and columns.

**Evidence**: 26 schema discovery ops across 4 sessions (PRAGMA table_info, sqlite_master queries).

**Solutions** (pick one):
- A. Add may.db schema to coach's context.md injection (~0 ops, free)
- B. A `scripts/db-schema.sh` that prints table definitions (~1 op)

**Current cost**: ~6 ops per investigation session  
**With fix**: 0-1 ops  
**Savings**: ~5 ops × 2 investigations/day = ~10 ops/day

### Gap 3: Agent Dashboard Script Has Zero Adoption

**What exists**: `scripts/agent-dashboard.sh` — designed to replace the fleet-status boilerplate. "One-call system overview for agent heartbeats."

**Reality**: **0 uses in the last 100 sessions** (outside this analysis session). The script exists but no agent has been told to use it. It was never added to heartbeat templates or context files.

**Fix**: Add `./scripts/agent-dashboard.sh coach` to coach's heartbeat.md Step 1 template as the default fleet check. Same for other agents.

**Savings**: 1-3 ops per heartbeat × ~35 heartbeats/day = ~35-100 ops/day (across all agents, not just coach).

### Gap 4: Convention Handler Navigation Aid

**What's missing**: convention-check.ts is 1,141 lines. The coach reads it piecemeal via grep + sed. A structural summary (which function checks which convention, line ranges) would eliminate the grep-to-find-sections pattern.

**Evidence**: 46 ops across 4 sessions reading convention-check.ts.

**Fix**: Add a comment block at top of convention-check.ts:
```typescript
/**
 * Convention check index:
 * - C1.1 (verify-before-edit): line 440-510
 * - C1.4 (finish-status): line 565-620
 * - C1.5 (checkpoint-progress): line 620-670
 * - C7.1 (no-path-hallucination): line 780-830
 * - C8.2 (convention-verify-edit): line 830-880
 * - C12.1 (read-context-first): line 847-900
 */
```

**Savings**: ~5 ops per investigation (eliminate 3-5 grep-for-section calls)

---

## Comparison with Apr 11 Bash Pattern Analysis

| Pattern | Apr 11 Finding | Current Finding (12h later) | Delta |
|---------|---------------|---------------------------|-------|
| DB query cascade | 145 DB queries in 6h (23.2%) | **129 DB queries** across 5 sessions | **Still #1** — convention investigation drives it |
| Convention drilling | 66 queries = 45.5% of DB | Schema discovery (26 ops) + convention data (80+ queries) | **Worse** — now includes schema boilerplate too |
| GREP chains | 166 grep calls (26.5%), max 16 consecutive | **128 grep calls** across 5 sessions, max 13 consecutive | **Same magnitude** — handler reading is the new top grep target |
| Fleet status duplication | 10/18 sessions, identical query | agent-dashboard.sh exists but zero adoption | **Solvable** — script ready, needs adoption |
| Git archaeology | Identified as "Branch Review Sequence" | **52 git ops** across 4 investigation sessions, avg 15.5/session | **Reframed** — it's regression timeline tracing, not branch review |
| Convention handler reading | Not identified | **46 ops across 4 sessions** reading convention-check.ts | **NEW** — convention investigations didn't exist Apr 11 |

**Key new finding**: The Apr 11 analysis identified general categories (DB, GREP, GIT). This analysis reveals that **convention regression investigation is a single, stereotyped workflow** that accounts for most high-op sessions. It's not "random exploration" — it's the same protocol executed manually every time.

---

## Existing Tools That SHOULD Be Used But Aren't

| Tool | Purpose | Usage | Why Not Used |
|------|---------|-------|-------------|
| `scripts/agent-dashboard.sh` | Fleet status + pending tasks + quality | **0 uses in 100 sessions** | Not referenced in any heartbeat.md |
| `scripts/gym-batch.sh` | Run multiple gym scenarios in one call | **0 uses** (per prior finding) | Not referenced in experiment templates |
| `scripts/gym-stats.ts` | Gym results summary | Occasional use | Under-used for experiment analysis |

---

## Priority Recommendations

### P0: Convention Investigation Script (~110 ops/day saved)
Build `scripts/convention-investigate.sh <convention> <agent>`. Should return the complete picture in one call: trend data, failing sessions, check logic excerpt, recent related git changes. This directly addresses the #1 cost driver.

### P1: Adopt agent-dashboard.sh (~35-100 ops/day saved)
Add to heartbeat.md templates for all agents. The script already exists and covers the "fleet status" boilerplate pattern.

### P1: DB Schema in Context (~10 ops/day saved)  
Add may.db table/column summary to coach context injection. Eliminates PRAGMA/sqlite_master discovery.

### P2: Convention Handler Index (~10 ops/day saved)
Add function-to-line-number index comment at top of convention-check.ts.

### Total Estimated Savings: ~165-230 ops/day

---

## Methodology Notes

1. Tool calls extracted from `session.jsonl` using `content[].type === 'toolCall'` format
2. Classification: DB (contains 'bun -e' + 'Database'), GREP (contains 'grep'/'rg'), GIT (contains 'git'), LS (contains 'ls'/'find'), CAT (contains 'cat'/'head'/'tail')
3. Op counts from `receipts.jsonl` line counts (each line = 1 op receipt)
4. Some tool calls are parallel (multiple calls in same assistant turn) — receipt count may be lower than tool call count


[SIG: optimizer-finding-tool-gaps-0412]
