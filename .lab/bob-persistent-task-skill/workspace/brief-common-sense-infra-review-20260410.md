# Common Sense Infra Review — 2026-04-10

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-09)
- **common-sense.md**: Unchanged (same 10 items under "How We Think")
- No git commits touching shared/common-sense.md since last review
- No ownership changes needed

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore + pre-commit hook |
| C1.3 Verify every write | ⚠️ STILL REGRESSED | edit() diff preview + finish-guard backstop; coach re-confirmed 0/4 full compliance |
| C12.1 (session-start orientation) | ❌ REGRESSED | No new data; yesterday's 59.4% was flagged as possible measurement artifact |

## New Findings Since Yesterday

### 1. Coach C1.3 Re-Check (2026-04-10): 0/4 Fully Compliant
Coach sampled 4 high-edit sessions across 3 agents (tech-lead, coach, optimizer):
- **0/4 fully compliant**, 3/4 partial, 1/4 violated
- **Key pattern**: Consecutive-edit clusters without individual verification
- Optimizer attempted write→finish with zero verification (gate caught it)
- Tech-lead did 4-5 consecutive edits before any verification
- **Conclusion**: Per-edit discipline degrades during complex multi-edit tasks. The finish-guard is the last line of defense and works, but in-session compliance is poor.

### 2. EXP-128 Complete: H-128 REJECTED (0/18)
- Detection coverage in Ch3 few-shot makes no meaningful difference
- Coder's "coding momentum" overwhelms few-shot interventions — once tests pass, agent stops reasoning
- All 18 runs: always passes tests, never creates analysis or identifies contradictions
- **Implication for C1.3**: Reinforces coach's conclusion that text/skill interventions don't work for verification behaviors. Structural enforcement is the only proven path.

### 3. Phase Evaluation Analysis: Measurement Bugs Confirmed
Coach's deep dive found 3 critical evaluator bugs:
- **Scale mismatch**: LLM evaluator uses 0-1 scale, heuristic uses 1-5. Cross-method comparisons are meaningless.
- **Duplicate evaluations**: 100% of pipeline P1/P2 pairs get identical scores (keyed by agent name, not session ID)
- **True gap**: Phase sessions are 19pp worse than non-phase (not 70pp as originally reported)
- **P0 evaluator fixes needed** (not infra-owned — may/tech-lead domain)

### 4. Convention Checks Table Empty
may.db convention_checks table has 0 rows. Yesterday's convention health numbers (4076 sessions, C1.3 at 72.1%) came from a different data source or were calculated differently. The measurement expansion question from yesterday remains unresolved — but coach's manual 4-session sample independently confirms poor C1.3 compliance.

## Highest Priority Unbuilt Mechanism: C2.3 Auto-Readback — STILL URGENT

### Status: Build (unchanged from yesterday)

Evidence stack continues to grow:
1. **C1.3 confirmed poor** by coach's manual re-check (0/4 fully compliant)
2. **EXP-128** adds yet another null result for text-based intervention (cumulative: 0/32+ text interventions successful)
3. **Coach's recommendation**: "Consider adding to growth cycle queue — skill reinforcement for verify each edit individually" — but coach's own data (EXP-020/055/056/093) already proved skills don't work for this
4. **V4 brief ready**: `agents/bob/workspace/brief-infra-c23-auto-readback-v4.md`

### Measurement Caveat (from yesterday, still open)
The system-wide 72.1% number from yesterday may reflect changed measurement scope (4076 sessions in 12h vs ~793/48h). But the qualitative finding is confirmed: C1.3 compliance is genuinely poor during multi-edit sessions.

### Recommendation
**Send auto-readback v4 brief to tech-lead.** The measurement uncertainty around exact rates doesn't change the action: every data source (convention checks, coach manual audits, FM-3.3 trend analysis, gym experiments) converges on the same conclusion — C1.3 needs structural enforcement.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Brief | Change from Yesterday |
|------|----------|--------|-------|----------------------|
| C2.3 Auto-readback | **P0** | Brief ready (v4) | `brief-infra-c23-auto-readback-v4.md` | No change — still top priority |
| Evaluator scale mismatch | **P0** | No brief | 0-1 vs 1-5 makes quality data unreliable | **NEW** — coach phase-eval analysis |
| Pipeline eval dedup | **P0** | No brief | P1/P2 get identical scores | **NEW** — coach phase-eval analysis |
| Sub-session commit guard | P2 | No brief | Phase 2 sub-sessions bypass guard | No change |
| C1.5 ID collision protection | P2 | No brief | Concurrent KB sessions cause ghost deliverables | No change |

### New Items This Review: Evaluator Bugs
The evaluator scale mismatch and pipeline dedup bugs are P0 for data quality — they make ALL quality metrics unreliable for cross-method comparisons. These should go to tech-lead or may as the evaluator owners. Not strictly "common-sense infra" but directly affect ability to measure convention compliance.

## Ownership Updates
No changes to common-sense.md ownership. All items correctly categorized.

## Summary
- **common-sense.md**: Unchanged, no ownership updates needed
- **C1.3 independently confirmed poor**: Coach's manual 4-session re-check found 0/4 fully compliant (consecutive-edit clusters are the failure pattern)
- **EXP-128 rejected H-128**: Yet another null result for text/few-shot intervention — structural enforcement remains the only proven path
- **Evaluator bugs found**: Scale mismatch + pipeline dedup make quality metrics unreliable (P0 for data team, not common-sense infra)
- **Highest priority unbuilt**: C2.3 auto-readback — all evidence converges, v4 brief ready, should escalate to tech-lead
- **Action**: No new brief needed this cycle; yesterday's assessment + v4 brief are still current. Consider sending v4 to tech-lead via reviewed-delivery workflow.
