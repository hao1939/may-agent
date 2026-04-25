# KE-380: Pre-completion checklists catch only ~27% of instruction adherence failures

**Evidence-Grade:** B — Retrospective analysis of 15 flagged issues (H-EXP-011)
**Status**: verified (rejected hypothesis, valuable negative result)
**Evidence**: H-EXP-011 Phase 1 retrospective. Only 4/15 flagged issues would have been caught by a 3-question pre-completion checklist.
**Discovered**: 2026-07-20
**Promoted-from**: H-EXP-011 (episodic → declarative, per H-EXP-018 audit)

## Claim

Pre-completion checklists ("did you do X?") are insufficient for instruction adherence because most failures (55%) happen **mid-session** — path hallucination, wrong directories, tool confusion. These can't be caught at completion time because the damage (wasted tool calls, wrong files) is already done.

Checklists work for end-state verification but not for process discipline. Mid-session interventions (environment orientation blocks, structural guardrails) are needed for process failures.

## Implication

Don't reach for checklists as the default intervention for compliance problems. Analyze *when* in the session failures occur — if mid-session, use structural/environmental interventions instead.

## Related
- KE-379 (env orientation blocks — the successful follow-on from this finding)
- KE-378 (checklists insufficient for discipline — same conclusion from different angle)
