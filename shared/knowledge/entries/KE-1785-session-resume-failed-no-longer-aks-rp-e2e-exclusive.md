<ai_context>
The events.md design doc claimed session.resume_failed events were "exclusively aks-rp-e2e task sessions." As of 2026-06-10, 172 total events span planner_control (23), model-validator (7), coverage-gap (6), planned-maintenance (4+), deployment-safeguards (4), and many other task types. Fixed in events.md lines 625 and 754.
Triggers: session.resume_failed, events.md, design doc drift, aks-rp-e2e, session-recovery
</ai_context>

# KE-1785: `session.resume_failed` No Longer aks-rp-e2e Exclusive

**Status**: resolved
**Discovered**: 2026-06-10
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1780 (handler lifecycle doc gap), KE-1782 (tool.executed doc drift)

## Claim

The `events.md` design doc (line 625 and line 753–755) stated that
`session.resume_failed` events were "exclusively aks-rp-e2e task sessions"
with "97 rows." This is no longer true.

## Evidence

### Current production data (2026-06-10)

- **Total rows**: 172 (up from documented 97)
- **24h count**: 172 (all within retention window)
- **6h count**: 113

### Session type breakdown (24h)

| Session pattern | Count |
|----------------|-------|
| `planner_control` | 23 |
| `model-validator-evidence-hygiene` | 7 |
| `coverage-gap-*` | 6 |
| `planned-maintenance-*` | 4+ |
| `deployment-safeguards-*` | 4 |
| `knowledge-map-judgment-*` | 4 |
| Various other task sessions | ~124 |

All are `category: session_not_found` — the session-recovery handler tries to
resume a session whose ID was never registered in the sessions table.

## Fix Applied

Updated `events.md`:
1. **Line 625** (status table): Updated row count to 172, noted the broader
   scope across planner_control and various project task types.
2. **Lines 753–755** (narrative): Updated count and removed the
   "exclusively aks-rp-e2e" claim.

## Pattern

This is the third doc-drift fix in events.md this heartbeat cycle (after
KE-1780 and KE-1782). Design docs with hardcoded row counts and
scope-limiting claims go stale silently as the system evolves. The
`session.resume_failed` population shifted from a single project's task
sessions to a broad cross-project pattern as the project execution engine
expanded usage.
