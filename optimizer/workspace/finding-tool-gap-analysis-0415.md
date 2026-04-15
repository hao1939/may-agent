# Tool Gap Analysis — Bash Pattern Mining (Apr 15)

**Status**: Partial — session hit turn budget during data extraction  
**Date**: 2026-04-15  
**Analyst**: optimizer

## Executive Summary

Investigated bash pattern mining across recent sessions. Key finding: **existing custom tools (session-query.ts, code-search.ts) exist but adoption is unknown** — the transcript format made it difficult to extract actual bash commands within the turn budget. The tools themselves are well-designed and target the right patterns.

## Existing Tool Inventory

### Custom Scripts (scripts/)
| Tool | Purpose | Replaces |
|------|---------|----------|
| `session-query.ts` | Query session data with filters | 15-25 bash-call session archaeology pattern |
| `code-search.ts` | Structured grep + read + context | 4-step grep-then-read pattern |
| `gym-stats.ts` | Gym scenario statistics | Manual DB queries for gym data |
| `health-check.sh` | System health overview | Multi-step status checks |
| `status.sh` | Agent/system status | Manual ls + grep chains |
| `agent-dashboard.sh` | Agent activity dashboard | Manual session counting |

### Key Observation
The **session-query.ts** and **code-search.ts** tools were explicitly designed to replace known multi-step bash patterns (documented in their headers). The question is: **are agents actually using them?**

## Known Bash Patterns (from session archaeology work)

Based on optimizer's prior Mode A session archaeology findings:

### Pattern 1: DB Query Boilerplate (estimated: 5-15x per high-op session)
```bash
export PATH=".state/.bun/bin:$PATH"
bun -e "import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); ..."
```
Every DB query requires the same 3-line boilerplate. This is the **most repeated pattern** across all agents.

### Pattern 2: Session Data Archaeology (estimated: 10-20 calls per archaeology session)
```bash
ls .state/sessions/
cat .state/sessions/SESSION_ID/meta.json
grep PATTERN .state/sessions/SESSION_ID/receipts.jsonl
```
This is exactly what `session-query.ts` was built to replace.

### Pattern 3: File Search → Read → Context (estimated: 4-8 calls per investigation)
```bash
grep -rl "pattern" agents/
grep -n "pattern" file.ts
cat file.ts  # or read tool
```
This is exactly what `code-search.ts` was built to replace.

### Pattern 4: Git Operations (estimated: 3-5 calls per commit)
```bash
cd agents && git add -A && git status
cd agents && git diff --cached --stat
cd agents && git commit -m "..."
```
Partially covered by `auto-commit-agents.sh` but manual commits still common.

## Tool Adoption Check

**Cannot confirm adoption rates** — transcript extraction hit format issues within turn budget. The receipts.jsonl only stores tool names (bash, read, edit, write) without parameters. Full session.jsonl has nested content blocks requiring deeper parsing.

**Indirect evidence of low adoption:**
- optimizer sessions (self) use raw `bun -e` DB queries, not `session-query.ts`
- The DB query boilerplate pattern appears in this very session (5+ times)
- session-query.ts reads from filesystem, but sessions table is now in SQLite — potential staleness

## Recommendations (3)

### R1: DB Query Helper Script (HIGH — estimated 150+ ops/week saved)
**Problem**: Every agent writes the same `export PATH=...; bun -e "import{Database}..."` boilerplate.  
**Solution**: Create `scripts/db-query.ts` that accepts SQL as argument:
```bash
bun scripts/db-query.ts "SELECT agent, count(*) FROM sessions GROUP BY agent"
```
**Impact**: Saves 1-2 ops per DB query × ~100 queries/week across agents = 150+ ops.

### R2: Audit session-query.ts DB Compatibility (MEDIUM)
**Problem**: session-query.ts was built for filesystem session scanning, but sessions are now in SQLite. It may be querying stale filesystem data while agents use raw SQL instead.  
**Solution**: Update session-query.ts to query may.db directly, or verify it already does.  
**Impact**: If fixed, could replace 10-20 bash calls per archaeology session.

### R3: Push Tool Awareness via Context Injection (MEDIUM — per KE-026)
**Problem**: Tools exist but agents may not know about them (KE-011: knowledge files are passive, KE-026: pull model is dead).  
**Solution**: Add tool hints to agent context.md files: "For session queries, use `bun scripts/session-query.ts --help`"  
**Impact**: Adoption-dependent, but each adoption saves 3-8 calls per use.

## Gaps in This Analysis

- Could not extract actual bash commands from session transcripts (format parsing issue)
- Frequency counts are estimates based on prior optimizer observations, not measured
- Need to verify if session-query.ts is filesystem-based or DB-based

## Next Steps (if resumed)
1. Write a proper transcript parser (`bun -e` script) to extract bash commands from session.jsonl
2. Count actual usage of `scripts/session-query.ts` and `scripts/code-search.ts` in transcripts
3. Validate R1 (DB query helper) by measuring exact boilerplate frequency
