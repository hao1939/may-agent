# Architecture Review: src/lib/requests.ts (863 LOC)

**Date**: 2026-04-16  
**Reviewer**: tech-lead  
**Severity**: Medium — module is functional but overloaded with 6+ distinct responsibilities

## Summary

requests.ts is the system's "god module" — it started as request tracking but accreted schema definitions, DB lifecycle management, evaluation CRUD, session CRUD, and migration logic for **9 tables** across 5 unrelated domains. It's cohesive only in the sense that everything touches SQLite.

## Responsibility Clusters (6 distinct concerns)

| Cluster | Lines (approx) | Functions |
|---------|----------------|-----------|
| **1. Schema + Migrations** | ~200 | SCHEMA constant, ALTER TABLE migrations in getDb() |
| **2. DB lifecycle** | ~50 | getDb(), closeDb(), dbCache, auto-migrate rename logic |
| **3. Request CRUD** | ~180 | trackRequest, updateRequest, getRequest, getActiveRequests, getRequestsByAgent, getRequestsByAgentAndStatus, getRequestTree, getStaleRequests, isDuplicate, archiveOld |
| **4. Evaluation CRUD** | ~150 | upsertEvaluation, hasEvaluation, hasLLMEvaluation, getEvaluation, getEvaluationsSince, getAllEvaluations, getEvaluationStatus, deserializeEvalRow, parseJsonArray, parseJsonObject |
| **5. Session CRUD** | ~50 | upsertSession, updateSessionDb |
| **6. Types/re-exports** | ~60 | RequestRecord, TrackRequestOpts, ErrorClass re-export, classifyError re-export |

## Dead Exports (6 functions, 0 external consumers)

| Export | Consumers | Notes |
|--------|-----------|-------|
| `getRequestTree()` | 0 | Recursive CTE — never called anywhere |
| `archiveOld()` | 0 | Cleanup function — no cron or caller uses it |
| `getRequest()` | 0 | Single-request lookup — unused |
| `getEvaluationStatus()` | 0 | Returns {exists, hasUsage} — unused |
| `getEvaluation()` | 0 | Single eval fetch — unused |
| `closeDb()` | 0 | Test cleanup — no test imports it |

These 6 functions represent ~80 LOC of dead code.

## Schema Bloat

The SCHEMA constant defines **9 tables** across unrelated domains:
- `requests` — request tracking (core)
- `sessions` — session registry
- `gym_runs`, `gym_checks`, `gym_prompts` — gym benchmarking
- `convention_checks`, `convention_maturity` — convention system
- `evaluations` — eval system
- `session_digests` — digest system
- `knowledge_entries`, `hypotheses`, `experiments` — research system

Only `requests` and `sessions` have CRUD functions in this file. The other 7 tables are defined here but operated on via raw `getDb().prepare()` calls scattered across the codebase. This means requests.ts is the implicit schema owner for tables it doesn't manage.

## Migration Pattern

Lines 253-290: 10 individual try/catch blocks for ALTER TABLE migrations. Each silently catches "column already exists". This is functional but brittle — no versioning, no way to know what's been applied.

## Architectural Assessment

**Is this one module or should it be split?** It should be split into at least 3:
1. **db.ts** (already exists) + schema/migrations — move SCHEMA and getDb() there
2. **requests.ts** — pure request CRUD (trackRequest, updateRequest, queries)
3. **evaluations.ts** — evaluation CRUD (already has evaluator.ts as a consumer)

Session helpers (upsertSession, updateSessionDb) could stay with schema or move to a session-db.ts.

## Key Metric

`getDb()` is imported by **15 files** — it's the real API surface. Most consumers bypass the typed functions and run raw SQL via `getDb().prepare()`. This undermines the abstraction: the module provides typed wrappers nobody uses while exporting the raw DB handle everyone reaches for.

## Recommended Actions (separate sessions)

1. **Delete dead exports**: Remove getRequestTree, archiveOld, getRequest, getEvaluationStatus, getEvaluation, closeDb (~80 LOC)
2. **Extract evaluation CRUD** to `src/lib/evaluation-db.ts` (~150 LOC) — evaluator.ts is the primary consumer
3. **Move schema to db.ts** — centralize schema ownership where the connection is created
4. **No action on migration pattern** — it works, versioning is over-engineering for this scale
