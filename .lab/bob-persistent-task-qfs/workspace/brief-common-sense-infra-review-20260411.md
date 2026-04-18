# Common Sense Infra Review — 2026-04-11

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-10)
- **common-sense.md**: Unchanged (same 10 items under "How We Think")
- No git commits touching shared/common-sense.md since last review
- No ownership changes needed

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore + pre-commit hook |
| C1.3 Verify every write | ⚠️ STILL REGRESSED | edit() diff preview + finish-guard backstop; coach 0/4 full compliance (unchanged) |
| C12.1 (session-start orientation) | ❌ REGRESSED | No new data since 59.4% measurement |

## New Findings Since Yesterday

### 1. EXP-143 Complete: Checkpoint Decomposition for FM Detection
Coach completed EXP-143 (N=100, heuristic-based). Key results:
- **FM-3.3 detection**: +32.1pp sensitivity (60.4% → 92.5%, p<0.05) — checkpoint decomposition catches verification failures much better
- **FM-3.1 detection**: +34.6pp sensitivity (65.4% → 100%, p<0.05) — ghost deliverables caught perfectly
- **FM-2.1**: Only +2.6pp (not significant) — wrong-approach detection doesn't benefit from decomposition
- **Caveat**: Heuristic patterns, not LLM evaluation. Overall session-level improvement minimal (+1pp accuracy). Strong for sequential-pattern FMs only.

**Implication for common-sense infra**: This is about evaluator quality, not direct enforcement. If checkpoint decomposition is deployed in the evaluator pipeline, it would improve our ability to *measure* C1.3/C1.7 compliance, but wouldn't directly *enforce* it. Still useful — better measurement enables better coaching feedback loops.

### 2. Coach C2.3 Status: Still BLOCKED
Coach todo still shows C2.3 as "Blocked on: Engineering capacity (tech-lead)". The auto-readback v4 brief exists (`brief-infra-c23-auto-readback-v4.md`) but has not been sent via reviewed-delivery workflow.

### 3. Standing Orders Active
Two new standing orders from Hao (ORDER-001: use idle time, ORDER-002: actions over words). No direct impact on common-sense infra, but ORDER-002 reinforces evidence-first culture.

## Highest Priority Unbuilt Mechanism: C2.3 Auto-Readback — UNCHANGED

### Status: Build (7 consecutive days at top priority)

The evidence case has not weakened:
1. **C1.3 confirmed poor** (coach 0/4 fully compliant — unchanged from yesterday's manual check)
2. **0/32+ text interventions successful** for C2.3 (unchanged — no new text experiments attempted)
3. **EXP-128 null** (few-shot doesn't work), **EXP-143** confirms better measurement but doesn't fix enforcement
4. **V4 brief ready**: `agents/bob/workspace/brief-infra-c23-auto-readback-v4.md`

### What's different: EXP-143 opens a parallel track
EXP-143 suggests checkpoint decomposition could be deployed in the evaluator to better detect FM-3.3 (C1.3 violations). This is a *measurement* improvement — complementary to auto-readback (which is *enforcement*). Both are useful, but enforcement remains higher priority because it prevents the failures rather than just detecting them better after the fact.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Brief | Change from Yesterday |
|------|----------|--------|-------|----------------------|
| C2.3 Auto-readback | **P0** | Brief ready (v4) | `brief-infra-c23-auto-readback-v4.md` | No change — 7 days at P0 |
| Checkpoint decomposition eval | P1 | No brief | EXP-143 results ready | **NEW** — could improve FM detection |
| Sub-session commit guard | P2 | No brief | Phase 2 sub-sessions bypass guard | No change |
| C1.5 ID collision protection | P2 | No brief | Concurrent KB sessions cause ghost deliverables | No change |

## Ownership Updates
No changes to common-sense.md ownership. All items correctly categorized.

## Summary
- **common-sense.md**: Unchanged, no ownership updates needed
- **C1.3 still poor**: No new compliance data but no new interventions either — situation unchanged
- **EXP-143 complete**: Checkpoint decomposition improves FM-3.3 detection by +32.1pp (measurement quality improvement, not enforcement)
- **Highest priority unbuilt**: C2.3 auto-readback — 7th consecutive day at top priority, v4 brief still unsent
- **Action**: The auto-readback v4 brief should be sent to tech-lead. Seven days of "brief ready, not sent" is itself a pattern worth noting.
