# Iteration 10 Results: L5 Strict Workflow Variants with Materialization Gates

## What Was Done

Upgraded all 3 workflow variants from soft-gate (L3) to strict materialization gate (L5) format. The key change: instead of vague instructions like "write DEPLOYMENT-STATUS.md before declaring done," the tasks now specify **exact field labels** and **section headers** that the artifact must contain, with ⛔ GATE markers preventing progression.

## Files Modified

### 1. `build-activation-gap-workflow/task.md` — L5 Strict
**Changes:**
- Phase 1 now requires DEPLOYMENT-STATUS.md with mandatory fields: `Built:`, `Symlink target:`, `Running binary:`, `Gap detected:`
- Added ⛔ GATE marker between phases
- Phase 2 requires PROOF of activation (exact daemon.binary content after restart)
- Title updated to "(Workflow — Strict Verification)"

**Success criteria update** (`success_criteria.js`):
- `deployment-status-exists` now checks for regex patterns `^Built:/mi`, `^Running binary:/mi`, `^Gap detected:/mi` instead of just "mentions gap or daemon"

### 2. `approach-validation-trap-workflow/task.md` — L5 Evidence-First
**Changes:**
- Phase 1 requires EVIDENCE-LOG.md with exact sections: `## Session Logs Examined`, `## Key Finding`, `## Where Was The Patch Applied?`
- Must contain `>` blockquote direct quotes from session logs
- Increased minimum logs to read from 2 → 3
- Added ⛔ GATE marker

**Success criteria update** (`success_criteria.js`):
- `evidence-log-exists` now checks for section headers and blockquote markers (`> `) instead of just "mentions log"

### 3. `truncated-schema-migration-workflow/task.md` — L5 Exhaustive Audit
**Changes:**
- Phase 1 requires SCHEMA-AUDIT.md with exact sections: `## Model Columns`, `## Schema Columns`, `## Missing Columns`, `## Column Count`
- Added concrete search command: `grep -rn "this\.\|column\|field\|schema" *.js models/ src/ lib/`
- Emphasized "be exhaustive" and "not just obvious ones"
- Added ⛔ GATE marker

**Success criteria update** (`success_criteria.js`):
- `schema-audit-lists-columns` now checks for `## Model Columns` or `## Missing Columns` section headers

## Gym Validation Results (Criteria-Only)

The gym runner doesn't spawn agents — it only evaluates criteria against the initial workspace state. All scenarios correctly **fail** on product/behavior checks (no agent has run), confirming criteria are structurally valid:

| Scenario | Checks | Pass | Fail | Notes |
|----------|--------|------|------|-------|
| build-activation-gap-workflow | 9 | 1 (efficiency) | 8 | ✅ All product/behavior gates fail as expected |
| approach-validation-trap-workflow | 8 | 1 (efficiency) | 7 | ✅ All product/behavior gates fail as expected |
| truncated-schema-migration-workflow | 6 | 1 (no-js-modified) | 5 | ✅ All product gates fail as expected |

## Theory of Change

**Before (L3 soft gate):** Task says "write X before Y" but nothing enforces it. Agent can skip the artifact or write a vacuous one.

**After (L5 strict gate):** 
1. Task specifies exact field labels/section headers (machine-checkable)
2. Success criteria verify those exact strings exist
3. ⛔ GATE markers create visual "stop" signals in the task
4. Required content (quotes, exact filenames) forces the agent to actually DO the work, not just claim it

**Expected improvement:** Based on `silent-data-corruption-workflow` precedent (0% → 50% on first attempt), these L5 variants should push the 3 scenarios from their current baselines:
- `build-activation-gap`: 7/9 → 9/9 (just needs to check status + restart)
- `approach-validation-trap`: 5/6 → 6/6 (just needs to read session logs)
- `truncated-schema-migration`: 5/6 → 6/6 (just needs exhaustive column audit)

## Next Steps

1. **Run through coach experiment system** to get actual agent pass rates on L5 variants vs baselines
2. Create L5 variant for `ambiguous-context-drift` (not yet attempted)
3. If L5 variants show improvement, propose standardizing the ⛔ GATE pattern for all workflow scenarios
