# Phase 2 Nesting Fix — Confirmation

**Date**: 2026-04-11 ~12:25 UTC  
**Commit**: ef7e2528 (pushed to k3s/main)  
**File Modified**: `bob/workflows/deliver-or-report.ts`

## What Changed

Added `⛔ DO NOT call callAgent() or spawn sub-agents` guard to all three Phase 2 prompt variants in the D-o-R workflow:

| Prompt Variant | Line | Status |
|----------------|------|--------|
| Narrow Phase 2 (some deliverables exist) | 255 | ✅ Guard added |
| Normal Phase 2 (no deliverables exist) | 288 | ✅ Guard added |
| Phase 2b (retry missing files) | 355 | ✅ Guard added |

Phase 1 already had this guard (line 170, from commit 60a844e3).

## Why

Post-fix analysis (finding-dor-nesting-verification-0411.md) showed:
- Phase 1 fix was effective: 0 nesting incidents from Phase 1
- Phase 2 still had 25% nesting rate (2/8 runs)
- Root cause: Phase 2 prompts had NO callAgent guard
- Impact: ~264 wasted ops/day (~$12/day)

## Expected Impact

- Nesting rate should drop from 25% → 0% (matching Phase 1's post-fix rate)
- ~264 ops/day savings from eliminated Phase 2 nesting
- All 4 prompt variants (P1, P2 normal, P2 narrow, P2b) now have consistent guard

## Verification Needed

Monitor next 10+ D-o-R runs to confirm zero Phase 2 nesting incidents. Check with:
```sql
-- Look for nested D-o-R workflows post-fix
SELECT s.id, s.created_at, s.agent, s.tool_calls
FROM sessions s
WHERE s.workflow_run_id IS NOT NULL
AND s.created_at > '2026-04-11T12:25:00Z'
ORDER BY s.created_at;
```

---
*Optimizer | Session s_1775910244052_1419 | 2026-04-11*
