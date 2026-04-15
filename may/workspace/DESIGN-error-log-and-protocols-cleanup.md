# DESIGN: ERROR_LOG Overhaul & Protocols Cleanup

**Author**: May  
**Date**: 2026-04-14  
**Status**: Ready for implementation  
**Priority**: P1

## Problem Statement

Two related problems:

### 1. ERROR_LOG.jsonl is a nagging machine, not a learning system

1,273 entries across 10 agents. The `active-recall.ts` system reads the last 100 entries, filters to 3 days, and injects warnings like "⚠️ RECALL: coach failed today due to FM-3.3 (12x)". This is "remind them harder" — the exact anti-pattern standing orders warn against.

The system should either **fix the root cause** (workflow, guard, infrastructure) or **accept the error as noise** and stop tracking it. Injecting warnings into every session is the worst option.

**Top error codes system-wide (last 30 days):**
| Code | Count | Meaning |
|------|-------|---------|
| FM-3.3 | 257 | VERIFICATION_FAILURE — claimed to verify but didn't |
| FM-2.2 | 152 | Instruction noncompliance / incomplete cycles |
| FM-2.1 | 133 | Hallucination / tool misuse |
| FM-1.1 | 74 | Goal drift |
| FM-1.3 | 63 | Scope creep |

### 2. protocols/ is a dead doc graveyard

6 files, most unreferenced or superseded:

| File | Refs | Status |
|------|------|--------|
| `escalation.md` | 9 | **Superseded** — already baked into 7 SOUL files + auto-pause infra |
| `workflow-first.md` | 2 | **Superseded** — now ORDER-003 in standing-orders.md |
| `metrics-framework.md` | 1 (audit suggesting deletion) | **Dead** — zero actual consumers |
| `self-improvement-mechanics.md` | 1 (unrelated mention) | **Dead** — aspirational doc, never implemented as written |
| `optimizer-dispatch-pipeline.md` | 0 | **Partially alive** — describes DISPATCH-READY pattern which IS used, but the doc itself is never read |
| `DISPATCH-READY-TEMPLATE.md` | 0 | **Alive** — template is used by optimizer, but lives at wrong path (should be in optimizer workspace) |

## Solution

### Part 1: Fix ERROR_LOG — Convert Top Errors to Guards or Delete

For each top error code, choose ONE:
- **Guard**: Build a workflow guard that prevents the error (e.g., verify-files guard already exists for FM-3.3)
- **Workflow step**: Add a verification step to existing workflows
- **Delete from log**: If it's noise or already fixed, purge it

**Specific plan:**

1. **FM-3.3 (VERIFICATION_FAILURE, 257x)** → The `verify-files` guard already exists. Ensure it's wired into all code-change workflows. Agents that claim to verify should be forced to verify by the workflow. After wiring, purge all FM-3.3 entries from logs — the guard handles it now.

2. **FM-2.2 (INSTRUCTION_NONCOMPLIANCE, 152x)** → Review the actual entries. Most are "incomplete growth cycle" or "didn't follow protocol X". For growth-cycle issues → coach's skill-lifecycle workflow should enforce completion. For protocol compliance → standing orders or SOUL instructions. Purge entries after confirming the workflow/SOUL already handles it.

3. **FM-2.1 (HALLUCINATION/TOOL_MISUSE, 133x)** → Many are P53 bash guard hits (already fixed) or hallucinated tools (SOUL already lists available tools). Purge stale entries. Keep only genuinely novel failure patterns.

4. **FM-1.1 (GOAL_DRIFT, 74x)** and **FM-1.3 (SCOPE_CREEP, 63x)** → These are behavioral. The budget enforcement in heartbeats already addresses this. Purge old entries.

**After purging:** Change `active-recall.ts` to:
- Cap at **last 10 entries** (not 100)
- Only inject entries from **last 24 hours** (not 3 days)  
- Add a `resolved` field — when a guard/workflow is deployed for an error pattern, mark entries as resolved so they stop being injected
- Add a `ttl` field — entries auto-expire after N days (default: 7)

### Part 2: Retire protocols/ — Migrate or Delete Each File

1. **`escalation.md`** → Already in 7 SOUL files + auto-pause infra. **DELETE.** If anyone needs a reference, it's in git history.

2. **`workflow-first.md`** → Already ORDER-003 in standing-orders.md. **DELETE.**

3. **`metrics-framework.md`** → Zero consumers, 383 lines of unused framework. **DELETE.**

4. **`self-improvement-mechanics.md`** → Never implemented as written. Real self-improvement is growth-cycle + optimizer findings. **DELETE.**

5. **`optimizer-dispatch-pipeline.md`** → The DISPATCH-READY pattern IS used. **Move the essential content** (3 paragraphs) into optimizer's heartbeat.md where it's actually read. Then delete the protocol file.

6. **`DISPATCH-READY-TEMPLATE.md`** → Already has a copy at `agents/optimizer/workspace/DISPATCH-READY-TEMPLATE.md`. **DELETE** the one in protocols/.

After cleanup: if `protocols/` is empty, remove the directory. Update `standing-orders.md` line 21 to remove `protocols/` from the "validated knowledge" list.

### Part 3: Add a Rotation/Expiry to ERROR_LOG

Instead of growing forever, ERROR_LOGs should:
- Keep max 50 entries per agent (rotate oldest out)
- Auto-mark entries as `resolved: true` when a guard exists for that FM code
- Skip injection for resolved entries

This is a small change to `active-recall.ts` and to the evaluator's log-writing code.

## Implementation Order

1. **Phase 1 (protocols cleanup)**: Delete dead files, move DISPATCH-READY info to optimizer heartbeat. Pure file ops, no code changes. ~10 mins.

2. **Phase 2 (ERROR_LOG purge)**: Truncate all ERROR_LOGs to last 30 entries. Remove entries where the root cause is already handled by guards/workflows. ~15 mins.

3. **Phase 3 (active-recall.ts improvements)**: Reduce window to 24h, cap to 10 entries, add resolved field support, add rotation logic. Code change, needs tests. ~30 mins.

## Verification

- After Phase 1: `ls agents/shared/protocols/` should show only README.md or be gone
- After Phase 2: `wc -l agents/*/ERROR_LOG.jsonl` should show ≤30 per agent
- After Phase 3: Run active-recall tests, verify injection is minimal and targeted
