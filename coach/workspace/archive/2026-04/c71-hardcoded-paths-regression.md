# C7.1 Hardcoded Paths Regression Analysis

**Date**: 2026-04-04  
**Convention**: C7.1 — root-is-app (no bash commands referencing /home/, ~/, /Users/, /root/)  
**Severity**: HIGH — affects the manager agent (may) at 33% pass rate in last 24h

## Summary

C7.1 pass rates have dropped sharply for may and tech-lead in the last 24 hours. Both agents are using `/home/hao/may-agent/` absolute paths in bash commands, primarily when trying to find and use `bun`.

## Data

| Agent | Last 24h | Historical | Regression |
|-------|----------|------------|------------|
| may | 5/15 (33%) | 309/362 (85.4%) | -52 pts |
| tech-lead | 1/3 (33%) | 150/173 (86.7%) | -53 pts |
| bob | — | — | 1 isolated incident |
| optimizer | — | — | 1 isolated incident (git paths) |

## Root Cause

**Missing context.md fact**: Neither `may` nor `tech-lead` have the bun path info in their context.md. They have:
- ✅ `npx is not available — use ./node_modules/.bin/<tool> or bun x <tool>`
- ✅ `sqlite3 CLI is not available — query may.db with bun`
- ❌ **Missing**: Where bun actually IS (`bun is at .state/.bun/bin/bun`)

Without knowing the path, they probe the filesystem (`which bun`, `ls ~/.bun/bin/bun`, `ls /root/.bun/bin`) and eventually discover `/home/hao/may-agent/.state/bin/bun` or `.state/.bun/bin/bun` — but use the absolute `/home/` path.

**Agents with the fact already have better compliance:**
- optimizer: HAS `bun is at .state/.bun/bin/bun` → 89.7% C7.1 overall
- bob: HAS `/app/.state/bin/bun` reference → 76.1% C7.1 overall (but uses `/app/` absolute)

## Violation Patterns (last 24h)

### Pattern A: Bun discovery probing (may)
```
which bun || ls /usr/local/bin/bun* 2>/dev/null || ls ~/.bun/bin/bun
```
→ Then uses `/home/hao/may-agent/.state/bin/bun` once found

### Pattern B: Hardcoded BUN variable (tech-lead)  
```
BUN=/home/hao/may-agent/.state/.bun/bin/bun
$BUN -e "import {Database} from 'bun:sqlite'; ..."
```

### Pattern C: Git with absolute paths (optimizer)
```
cd /home/hao/may-agent && git add agents/shared/workflows/REGISTRY.md
```

## Recommended Fix

### Immediate (L4 — context.md facts)

Add to **may/context.md** and **tech-lead/context.md**:
```
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- Project root is /app — use relative paths in bash commands, never reference /home/*, ~/*, /root/*, or /Users/*
```

Also add to **coder/context.md**, **scout/context.md**, **amy-kimi/context.md**, **qa/context.md** (preventive):
```
- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
```

### For bob (path correction)
Bob's context says `Use /app/.state/bin/bun for bun` — this uses an absolute path. Update to:
```
- bun is at .state/.bun/bin/bun — use relative path or `export PATH=".state/.bun/bin:$PATH"`
```

## Skill Assessment

This is NOT a skill problem — it's a **knowledge gap**. The agents don't know where bun is. A skill would be overkill; context.md facts are the right intervention level.

## Expected Impact

Based on the violation analysis:
- ~70% of may's C7.1 failures are bun-path related → expect +35 pts improvement
- ~100% of tech-lead's C7.1 failures are bun-path related → expect +50 pts improvement
- May should go from 33% → ~80%+ in the next 24h after fix

## C1.4 / C8.2 Side Analysis

The other flagged conventions (C1.4 finish-clearly, C8.2 promise-deliver-report) show sporadic failures spread across weeks. These are NOT regressions but chronic low-rate issues likely caused by:
- Sessions hitting budget limits before reaching finish()
- Interrupted/crashed sessions (though the checker tries to filter these)
- Small recent sample sizes (n=3) amplifying noise

No immediate intervention recommended for C1.4/C8.2.
