# Workflow Cleanup Results

**Date**: 2026-04-11T11:24
**Session**: s_1775906645391_1392
**Lens**: C (Dead Weight)

## Context

The Lens A audit (10:23) identified 5 workflows with 0 runs in the last 48h:
1. `implement-and-review` — 0 in 48h, 143 all-time
2. `implement-and-adversarial-review` — 0 in 48h, 8 all-time
3. `skill-lifecycle` — 0 in 48h, 41 all-time
4. `research-to-production` — 0 ever
5. `auto-loop` — 0 ever

## Actions Taken

### Already Archived (Batch 2, earlier today)
- `research-to-production.ts` → `archive/` ✅
- `auto-loop.ts` → `archive/` ✅
- `implement-and-adversarial-review.ts` → `archive/` ✅

All 3 confirmed present in `agents/shared/workflows/archive/` and absent from main directory.

### Verified & Kept (have active consumers)
- **`implement-and-review`**: Referenced in 15+ live files — tech-lead SOUL.md, TOOLS.md, DOMAIN.md, coder INDEX.md, QA INDEX.md, optimizer TOOLS.md/DOMAIN.md, may SOUL.md/TOOLS.md, shared protocols, shared skills. 143 all-time runs. **KEEP.**
- **`skill-lifecycle`**: Referenced in optimizer's periodic-tasks.md (actively instructs `workflow.run`), may SOUL.md, shared protocols. 41 all-time runs. **KEEP.**

### Stale References Cleaned
Removed references to archived `research-to-production` and `auto-loop` from:
- `agents/shared/protocols/workflow-first.md` — removed from both workflow tables and description paragraph

### Stale References Requiring Agent Owner Action
Cannot edit other agents' SOUL.md files directly. Stale references remaining:
- `agents/bob/SOUL.md` line 69 — lists `research-to-production` as a key workflow (should be removed)
- `agents/may/SOUL.md` line 55 — lists `research-to-production` dispatch instruction (should be removed)

## Final Active Shared Workflow Inventory

| File | Status | 48h Runs | All-time Runs |
|------|--------|----------|---------------|
| `implement-and-verify.ts` | ✅ Active (workhorse, 85%) | ~79 | 200+ |
| `implement-and-review.ts` | ✅ Active (dormant but wired) | 0 | 143 |
| `parallel-research.ts` | ✅ Active | ~12 | 50+ |
| `skill-lifecycle.ts` | ✅ Active (dormant but wired) | 0 | 41 |
| `fewshot-inject.ts` | ✅ Utility (not a workflow) | N/A | N/A |

## Notes
- `fewshot-inject.ts` is a utility imported by `implement-and-verify.ts`, not a workflow (no `execute()` export). It causes a harmless load error in workflow `list` action. Not worth a code change to filter it — the error is caught silently in `findWorkflow` and shows as `(load error)` only in the `list` response.
- The workflow engine (`listWorkflowFiles`) only scans top-level `.ts` files, so the `archive/` subdirectory is automatically excluded from discovery.
