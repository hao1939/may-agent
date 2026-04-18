# Tool Gap Analysis — Apr 15 Evening (6h Window)

**Date**: 2026-04-15 22:00 UTC  
**Scope**: 203 sessions, 2,782 bash calls in last 6 hours  
**Method**: Parsed all session.jsonl transcripts, extracted+categorized bash commands, computed per-agent breakdowns

## Executive Summary

Three **infrastructure-level** fixes could eliminate ~1,600 of 2,782 bash calls (57%). Unlike previous tool-gap findings that required agent adoption (which hit 0% adoption), these are environment-level changes agents can't avoid.

## Top Patterns Found

### 1. PATH Setup Boilerplate — 574 calls (20.6%)

Every bash command that needs `bun` starts with `export PATH=".state/.bun/bin:$PATH"`. This accounts for **1 in 5** bash calls being pure setup overhead.

| Agent | PATH calls |
|-------|-----------|
| tech-lead | 145 |
| coach | 139 |
| optimizer | 137 |
| bob | 128 |
| may | 121 |
| scout | 3 |
| qa | 0 |

**Fix (infrastructure)**: Add `.state/.bun/bin` to the session environment's PATH before the agent starts. This is a one-line change in the session launcher — no agent adoption required.

**Impact**: -574 calls/6h, saves ~50 chars × 574 = 28.7K tokens of input overhead.

### 2. DB Query Boilerplate — 547 calls (19.7%)

Nearly identical to PATH setup — 525 of these 547 include both `export PATH` and `import{Database}from'bun:sqlite'`. The average DB command is **688 characters** — mostly boilerplate:

```
export PATH=".state/.bun/bin:$PATH" && bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db',{readonly:true});
console.log(db.query('SELECT ... ').all());
"
```

Only ~100 chars of that 688 is the actual query. The rest is repeated ceremony.

| Agent | DB calls |
|-------|---------|
| coach | 137 |
| optimizer | 127 |
| may | 111 |
| tech-lead | 110 |
| bob | 62 |

**Additional waste**: 53 attempts using wrong DB APIs (better-sqlite3, node:sqlite) that always fail. These are agents who haven't internalized the correct approach.

**Fix (infrastructure)**: Create `scripts/db-query.sh` that accepts raw SQL:
```bash
#!/bin/bash
# Usage: scripts/db-query.sh "SELECT * FROM sessions LIMIT 5"
export PATH=".state/.bun/bin:$PATH"
bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});const r=db.query(\`$1\`).all();console.log(JSON.stringify(r,null,2));"
```

**Impact**: -525 calls/6h reduced to ~100 chars each (from 688). Saves 525 × 588 = 308K chars/6h.

### 3. `cd /app` Prefix — 755 calls (27.1%)

Agents prefix commands with `cd /app &&` even though they're already in `/app`. This is the single most frequent pattern across all agents.

| Agent | cd /app calls |
|-------|-------------|
| tech-lead | 264 |
| may | 235 |
| coach | 106 |
| bob | 66 |
| optimizer | 39 |
| scout | 35 |
| qa | 22 |

**Fix (infrastructure)**: Ensure bash tool always executes in `/app` (likely already the case — agents just don't trust it). Alternatively, add to context.md: "You are always in /app. Do not cd /app."

**Impact**: Minor token savings (~4 chars each) but signals agents lack confidence in their CWD.

### 4. Git Ceremony — 659 calls (23.7%)

| Pattern | Count |
|---------|-------|
| git add | 215 |
| git log | 177 |
| git diff | 83 |
| git status | 55 |
| git commit | 22 |
| git show/branch/other | 104 |
| git rev-parse | 11 |
| git push | 9 |

The `git add` (215) + `git commit` (22) pair is interesting: agents add files 10× more than they commit. 58 add→commit sequences were found. Many git-adds are speculative or preparatory.

`git log` (177) is used primarily for checking recent changes — a repeated pattern of `cd agents && git log --oneline -5 -- <path>`.

**Fix (infrastructure)**: Create `scripts/recent-changes.sh <path> [count]` that wraps `git log --oneline -n <count> -- <path>`.

### 5. Manual grep on src/ — 210 calls (7.5%)

Despite `scripts/code-search.sh` existing, agents still manually grep:
```
grep -rn 'pattern' src/ --include='*.ts' | head -30
```

**Adoption failure reason**: `code-search.sh` was built but never pushed into agent context.md. Per KE-026 (pull model is dead), agents won't self-discover tools.

**Fix**: Push tool awareness into context.md for all agents.

### 6. Consecutive Grep Refinements — 122 instances

Agents frequently run 2+ consecutive greps, refining their search pattern each time. Example from tech-lead 108-op session:
```
grep -n 'computeHeuristic...' src/lib/evaluator.ts
grep -n 'quality.system...' src/lib/evaluator.ts  
grep -rn 'quality.*system...' src/ --include='*.ts'
```

This is normal exploration but signals that a `code-search` tool with fuzzy matching could reduce iteration.

## Compound Pattern Summary

| Pattern | Count | Automatable? | Level |
|---------|-------|-------------|-------|
| PATH + bun:sqlite DB query | 525 | ✅ db-query.sh | Infrastructure |
| PATH + other bun command | 49 | ✅ env PATH fix | Infrastructure |
| git add → commit → push | 58 sequences | ⚠️ Partial (auto-commit) | Infrastructure |
| grep → cat/head (search then read) | 13 | ❌ Normal workflow | — |
| ls → cat/head (discover then read) | 45 | ❌ Normal workflow | — |
| Consecutive grep refinements | 122 | ⚠️ Better search tool | Tool |
| Wrong DB API attempts | 53 | ✅ Context.md fix | Context |

## NEW Patterns Not in Previous Scans

1. **DB boilerplate at scale** (547 calls): Previous scans identified grep-then-read (87x) and git-review-chain (91x). DB boilerplate is 6× larger and was missed.

2. **PATH ceremony ubiquity** (574 calls): Not previously flagged as a tool gap — it's an environment gap.

3. **cd /app paranoia** (755 calls): The most frequent single pattern. Agents don't trust their CWD.

4. **Wrong-API-attempt waste** (53 calls): Agents trying `better-sqlite3` or `node:sqlite` and failing. Pure waste from incomplete context injection.

## Priority Recommendations

### P0: Fix PATH in environment (saves 574+ calls/6h)
One-line change in session launcher. Zero adoption risk. Immediate impact.

### P1: Create db-query.sh (saves 300K+ chars/6h)  
Simple wrapper script. Even if agents don't use it, push the example into context.md to standardize the boilerplate.

### P2: Push code-search.sh awareness (saves 210 grep calls/6h)
Add to all agent context.md files. Per KE-026, agents cannot self-discover tools.

### P3: Add "CWD is /app" to context (saves 755 cd calls/6h)
Low effort, moderate token savings. Addresses agent uncertainty.

---

*Analysis based on 203 sessions across bob(33), tech-lead(36), coach(23), may(17), scout(14+), qa(10+), optimizer(8+), evaluator(5+) from 16:00-22:00 UTC Apr 15.*
