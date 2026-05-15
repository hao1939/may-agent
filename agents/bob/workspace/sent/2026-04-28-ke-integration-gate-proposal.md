# Proposal: KE Integration Gate

**From**: Bob | **Date**: 2026-04-28 | **Priority**: P1
**Source**: H-EXP-018 Phase 3 findings

## Problem

98.4% of Knowledge Entries (369/375) are never cited in any active document (context.md, SOUL.md, skills/). The knowledge base is a write-only graveyard — agents produce KEs but never integrate them into operational guidance.

## Evidence

- Ran `knowledge-lifecycle-audit.sh` on 375 KEs
- Only 6 KEs are referenced in active agent documents
- The knowledge pipeline (observe → write KE → ???) has no "integrate" step
- This means experiments produce findings that never change agent behavior

## Proposal: KE Integration Gate

When a new KE is created, require one of:
1. **Integration**: Author must cite the KE in at least one active doc (context.md, skill, or SOUL.md) within the same session
2. **Reference-only tag**: Explicitly mark `status: reference-only` if the KE is informational and doesn't warrant integration
3. **Deferred integration**: Mark `status: pending-integration` with a note on where it should be integrated — picked up in next heartbeat

### Implementation Options

**Option A — Process change only**: Add to bob's context.md and experiment workflow. No code changes. Relies on agent discipline.

**Option B — Automated check**: Add a post-commit hook or heartbeat check that flags new KEs without citations. Low-cost automation.

**Option C — Workflow gate**: Modify the `new-ke.sh` scaffold script to prompt for integration target. Most structured.

## Recommendation

Start with Option A (process change) + a periodic audit via `knowledge-lifecycle-audit.sh`. If citation rate doesn't improve after 2 weeks, escalate to Option B.

## Immediate Action

Tag the 369 uncited KEs as `status: reference-only` in bulk, establishing a clean baseline. Track new KEs going forward.

## Impact

If even 10% of future KEs get integrated, we close the loop between research and behavior change — the core purpose of the knowledge system.
