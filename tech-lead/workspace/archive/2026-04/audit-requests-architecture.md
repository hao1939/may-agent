# Audit: requests.ts Architecture

**Date**: 2026-04-13  
**Auditor**: tech-lead  
**File**: src/lib/requests.ts (851 lines)  
**Session**: s_1776065237445_55

## Executive Summary

requests.ts has grown from a request tracking module into **the single database gateway for the entire system**. It now owns schema definitions for **12 tables** spanning 6 unrelated domains, but only provides typed accessor functions for 3 of them. The others are accessed via raw SQL through the `getDb()` escape hatch. This is the architectural equivalent of putting your entire house's plumbing, electrical, and HVAC controls behind one panel — it works until you need to change anything.

### Key Findings

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | **God module**: 12 tables, 6 domains, 1 file | Medium | Medium |
| 2 | **4 dead/unreachable exports** | Low | Low |
| 3 | **2 fully dead table schemas** (convention_maturity, cron_history bug) | Low | Low |
| 4 | **getDb() as escape hatch** bypasses typed API in 20+ call sites | Medium | High |
| 5 | **59 lines of migration cruft** that can never be removed | Low | Low |
| 6 | **Schema for tables only written by agent handlers** (convention_checks) | Design smell | — |

---

## 1. Responsibilities Inventory

requests.ts handles **6 distinct responsibility domains**:

### Domain 1: Request Tracking (the original purpose)
- **Tables**: `requests`
- **Functions**: trackRequest, updateRequest, getRequest, getActiveRequests, getRequestsByAgent, getRequestsByAgentAndStatus, getRequestTree, getStaleRequests, isDuplicate, archiveOld
- **Lines**: ~200 (types + CRUD)
- **Consumers**: manager-agents-tool.ts, session-subscribers.ts, db-writer.ts, cron.ts, send-tool.ts, lifecycle.ts, cli-send.ts, may.ts, agent-loader.ts, chat-session.ts
- **Status**: ✅ Active, well-used, core functionality

### Domain 2: Session Index
- **Tables**: `sessions`
- **Functions**: upsertSession, updateSessionDb
- **Lines**: ~76
- **Consumers**: db-writer.ts, web.ts (raw SQL)
- **Status**: ✅ Active

### Domain 3: Evaluations
- **Tables**: `evaluations`
- **Functions**: upsertEvaluation, hasEvaluation, getEvaluation, getEvaluationsSince, getAllEvaluations, getEvaluationStatus
- **Lines**: ~174
- **Consumers**: evaluator.ts, request-status.ts, manager-health.ts (raw SQL), web.ts (raw SQL)
- **Status**: ✅ Active, but getEvaluationStatus is dead

### Domain 4: Gym Benchmarking
- **Tables**: `gym_runs`, `gym_checks`, `gym_prompts`
- **Functions**: NONE (schema only — all access is raw SQL via getDb)
- **Lines**: ~45 schema + ~40 migrations
- **Consumers**: web.ts (raw SQL reads), cron.ts (raw SQL reads)
- **Status**: ⚠️ Active data (714 runs, 4664 checks) but zero typed API

### Domain 5: Convention Compliance
- **Tables**: `convention_checks`, `convention_maturity`
- **Functions**: NONE (schema only)
- **Lines**: ~20 schema
- **Consumers**: convention-check.ts handler (raw SQL writes), health-trend.ts handler (raw SQL reads), coaching-feedback.ts handler (raw SQL reads)
- **Status**: ⚠️ convention_checks actively used (62K rows!), convention_maturity has 0 rows (dead)

### Domain 6: Research System
- **Tables**: `knowledge_entries`, `hypotheses`, `experiments`
- **Functions**: NONE (schema only — research-db.ts has sync functions but they are NEVER CALLED)
- **Lines**: ~30 schema
- **Consumers**: research-db.ts (dead sync functions), nobody else queries these tables
- **Status**: ❌ Fully dead. Tables exist with data (160+51+133 rows) but no code path reads or writes them in production.

### Domain 7: Session Digests
- **Tables**: `session_digests`
- **Functions**: NONE in requests.ts (all typed functions live in session-digest.ts)
- **Lines**: ~20 schema
- **Consumers**: session-digest.ts (typed functions, active)
- **Status**: ✅ Active, but schema definition is orphaned in requests.ts while all access is in session-digest.ts

### Cross-cutting: Database Gateway
- **Functions**: getDb, closeDb
- **Lines**: ~78 (including dbCache, migrations, WAL setup)
- **Consumers**: 20+ files import getDb for raw SQL access
- **Status**: getDb is the most-imported function (45 external references). closeDb has 0 external references.

---

## 2. Dead/Unreachable Code

### Dead Exported Functions (0 external callers)

| Function | Lines | Notes |
|----------|-------|-------|
| `getRequestTree` | 15 | Recursive CTE for request trees. Never called. May have been for a planned UI feature. |
| `archiveOld` | 10 | Request archival. Never called — no cron job invokes it. 24K requests accumulate forever. |
| `getEvaluationStatus` | 18 | Check if eval has usage data. Never called. |
| `closeDb` | 7 | Test cleanup utility. Never called (not even in tests). |

**Total dead function code**: ~50 lines

### Dead Table Schemas

| Table | Rows | Notes |
|-------|------|-------|
| `convention_maturity` | 0 | Created in schema, never written to by any code path |
| `knowledge_entries` | 160 | Schema in requests.ts, sync in research-db.ts — but research-db.ts sync functions are never called (confirmed in Lens C audit). Stale data from some historical sync. |
| `hypotheses` | 51 | Same as above |
| `experiments` | 133 | Same as above |

### Bug: cron_history table referenced but never created

db-writer.ts line 64 does `INSERT INTO cron_history` but this table has no CREATE TABLE anywhere. This INSERT would fail silently or crash depending on error handling.

---

## 3. The getDb() Escape Hatch Problem

requests.ts exports `getDb()` which returns the raw SQLite database handle. This is used in **20+ locations** to write arbitrary SQL against any table. This creates:

1. **Hidden coupling**: Any file can query any table with no type safety
2. **Schema changes are dangerous**: Can't grep for "who uses the `notify` column?" — it could be in any raw SQL string
3. **No query encapsulation**: The same query patterns are duplicated (e.g., `SELECT * FROM requests WHERE status = 'FAILED'` appears in both manager-agents-tool.ts and request-status.ts)

### Major getDb() consumers (raw SQL):
- **web.ts**: 15+ raw queries across requests, sessions, evaluations, gym_runs, gym_checks, gym_prompts
- **cron.ts**: 8+ raw queries across requests, gym_runs, gym_prompts
- **manager-agents-tool.ts**: 4+ raw queries against requests (duplicating typed functions)
- **session-digest.ts**: 6+ raw queries against session_digests (has its own typed API but needs getDb for the handle)
- **convention-check.ts** (handler): 8+ raw queries against convention_checks

---

## 4. Interaction Map

```
                    ┌─────────────┐
                    │ requests.ts │ (851 lines, 12 tables)
                    └──────┬──────┘
                           │
          ┌────────────────┼─────────────────────┐
          │                │                     │
    Typed Functions    getDb() escape       Schema-only
          │                │                     │
  ┌───────┼───────┐   ┌───┼───────┐      ┌──────┼──────┐
  │       │       │   │   │       │      │      │      │
request  eval  session  web cron  20+   gym  convent  research
CRUD     CRUD   CRUD    .ts .ts   files  tables tables  tables
  │       │       │                        │      │      │
10 fns   6 fns  2 fns                     0 fns  0 fns  0 fns
```

### Key Interaction Paths

1. **manager-agents-tool.ts** → imports 9 functions + getDb (heaviest consumer)
2. **session-subscribers.ts** → trackRequest + updateRequest + getDb (for completed_items fuzzy matching)
3. **db-writer.ts** → upsertSession + updateSessionDb + trackRequest + getDb
4. **evaluator.ts** → upsertEvaluation + hasEvaluation + getAllEvaluations
5. **web.ts** → getDb only (all raw SQL for dashboard rendering)

---

## 5. Simplification Opportunities

### 5.1 Remove Dead Code (Easy, ~50 lines saved)
Remove: `getRequestTree`, `archiveOld`, `getEvaluationStatus`, `closeDb`

### 5.2 Remove Dead Table Schemas (Easy, ~60 lines saved)
Remove from SCHEMA: `knowledge_entries`, `hypotheses`, `experiments`, `convention_maturity`
- Research tables: research-db.ts sync functions are already dead (Lens C confirmed). Schema serves no purpose.
- convention_maturity: 0 rows, never written.

### 5.3 Extract Domain Schemas (Medium effort, high clarity)
The fundamental issue: requests.ts is the **database bootstrap file** masquerading as a request tracking module. Split schema ownership:

| Schema | Move to | Rationale |
|--------|---------|-----------|
| `gym_*` | gym-db.ts (new) or extend existing gym code | Self-contained domain, no typed functions in requests.ts |
| `convention_checks` | convention-check handler or new convention-db.ts | Only accessed by handler code in agents/ |
| `session_digests` | session-digest.ts (already has all typed functions) | Schema and functions should live together |

Keep in requests.ts: `requests`, `sessions`, `evaluations` (these have typed functions here).

### 5.4 Replace getDb() Escape Hatch with Domain APIs (High effort, high payoff)
For each raw SQL consumer, create typed query functions in the appropriate module:
- `getGymRunsByBatch()`, `getGymChecksByRun()` in gym-db.ts
- `getConventionPassRate()` in convention-db.ts
- Dashboard queries in a `dashboard-queries.ts`

This is the highest-payoff change but also the riskiest — many files would change.

### 5.5 Consolidate Migration Block (Low effort)
The 59-line migration block (15 try/catch blocks for gym_runs columns) could be replaced with a migration version table + single idempotent migration. But this is cosmetic — the current approach works, it's just ugly.

---

## 6. Risk Assessment

| Change | Risk | Notes |
|--------|------|-------|
| Remove dead functions | Very low | Zero callers confirmed via grep |
| Remove dead schemas | Low | Tables have stale data but no code reads it. Drop tables in migration. |
| Extract schemas | Medium | Must ensure getDb() still initializes all tables. Could use a schema registry pattern. |
| Replace getDb() | High | 20+ files, many raw SQL strings. Wrong SQL migration = runtime crashes. |

---

## 7. Comparison with research-db.ts Audit (Lens C)

| Metric | research-db.ts | requests.ts |
|--------|---------------|-------------|
| Total lines | 400 | 851 |
| Dead functions | 5 query functions | 4 functions |
| Dead tables | 3 (same ones) | 4 (including convention_maturity) |
| Distinct responsibilities | 1 (research sync) | 6+ domains |
| External consumers | 0 | 20+ files |

The research-db.ts dead code is **a subset** of the requests.ts problem — the dead tables are defined in requests.ts and only synced by research-db.ts (which is never called).

---

## 8. Recommendations (Prioritized)

### P0: Quick Wins (do now)
1. **Remove 4 dead functions**: getRequestTree, archiveOld, getEvaluationStatus, closeDb
2. **Remove 4 dead table schemas**: knowledge_entries, hypotheses, experiments, convention_maturity
3. **Fix cron_history bug**: Either add CREATE TABLE or remove the INSERT

### P1: Structural (next sprint)
4. **Move session_digests schema to session-digest.ts** — it already owns all the typed functions
5. **Add archiveOld to cron** — 24K requests with no cleanup is a growing problem

### P2: Strategic (when capacity allows)
6. **Extract gym schema** to a dedicated module
7. **Extract convention_checks schema** closer to its handler consumers
8. **Create typed query APIs** for the most common raw SQL patterns to reduce getDb() usage

---

## Appendix: Function Usage Matrix

| Function | manager-agents-tool | session-subscribers | db-writer | evaluator | cron | web | send-tool | request-status | Other |
|----------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| trackRequest | ✅ | ✅ | ✅ | | ✅ | | ✅ | | cli-send, may, agent-loader, chat-session |
| updateRequest | ✅ | ✅ | | | ✅ | | | | lifecycle |
| getRequest | ✅ | | | | | | | | |
| getActiveRequests | ✅ | | | | | | | ✅ | |
| getRequestsByAgent | ✅ | | | | | | | | |
| getRequestsByAgentAndStatus | ✅ | | | | | | | | |
| getStaleRequests | ✅ | | | | | | | ✅ | |
| isDuplicate | ✅ | | | | | | ✅ | | |
| getDb | ✅ | ✅ | ✅ | | ✅ | ✅ | | ✅ | manager, manager-health, auto-pause, session-digest, system-status, agent-loader |
| upsertEvaluation | | | | ✅ | | | | | |
| hasEvaluation | | | | ✅ | | | | | |
| getEvaluation | | | | | | | | ✅ | |
| getEvaluationsSince | | | | | | | | ✅ | |
| getAllEvaluations | | | | ✅ | | | | | |
| upsertSession | | | ✅ | | | | | | |
| updateSessionDb | | | ✅ | | | | | | manager |
| classifyError | ✅ | ✅ | | | | | | | (re-exported from classify-error.ts) |

Dead: getRequestTree, archiveOld, getEvaluationStatus, closeDb — zero entries in any column.
