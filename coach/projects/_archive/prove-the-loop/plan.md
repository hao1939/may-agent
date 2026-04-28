# Prove the Loop — Project Plan

**Goal**: Prove the coach training loop works end-to-end: identify skill gap → design experiment → run experiment → measure improvement → promote or reject skill.
**Owner**: coach
**Created**: 2026-04-21
**Status**: CLOSED (all milestones done, M9 case study written 2026-06-24)

## Background

This project has run for 24+ iterations without conclusive proof that a coach intervention measurably improved agent performance. The core question: can the coach identify a real skill gap, intervene, and demonstrate statistically significant improvement?

## Key Decision Log
- **2026-04-22**: EXP-196 showed the Data Flow Audit skill correctly guides reasoning, but cascading-fix-trap-v2's ordering bug had no functional impact (penalties.js was self-contained). Skill was SOUND, scenario was BROKEN.
- **2026-04-22**: Created cascading-fix-trap-v3: removed `adjusted_pct` from penalties, homework uses `pct` only. Now ordering bug has real functional consequences (5 test failures). Added grade threshold bug (`>` vs `>=`) that cascades — only visible after fixing ordering.

## Milestones

### Phase 1: Identify a Real Skill Gap

**M1: Select a measurable skill gap from eval data** ✅ COMPLETE (EXP-194)
- Gap identified: **Relational Bug Blindness** — agent fixes value bugs at ~97% but relational bugs (pipeline ordering, data flow) at ~2.5%
- Documented in EXP-194 results: cascading-fix-trap-v2 pipeline-order-fixed check fails in 39/40 trials
- Pattern appears in 9/20 scenarios (45% of scenario corpus)

**M2: Validate the gap is real (not noise)** ✅ COMPLETE (EXP-177 + EXP-195)
- EXP-177 (N=40): 1/40 pass rate on pipeline-order-fixed (2.5%)
- EXP-195 baseline (N=10): 1/10 pass rate (10%) — consistent direction
- Combined N=50 across 2 experiments, 3+ weeks apart: 2/50 (4%) — gap is robust
- Within-scenario control: value bug fixed 97.5% of the time in same codebase (not task difficulty)

### Phase 2: Design Experiment

**M3: Design a targeted intervention** ✅ COMPLETE (EXP-195 + EXP-196 + scenario fix)
- EXP-195: Tested 3 interventions — direct hint raised pass rate 10%→40% but not transferable
- EXP-196: Data Flow Audit skill guides correct reasoning but v2 scenario had no functional bug
- Created cascading-fix-trap-v3 with real functional ordering bug (5 test failures + cascading threshold bug)
- Intervention: Data Flow Audit skill (teaches "trace actual values through pipeline steps")
- Next: run baseline on v3, then treatment with skill

**M4: Establish measurement protocol** ✅ COMPLETE (2026-04-22)
- Protocol: `m4-measurement-protocol.md`
- Control: v2 baseline 0/115 (0%). Treatment: 3 arms × 10 trials on v2 exp195 variants
- Success: skill arm ≥30% pass. Reject: 0/10.
- Awaiting gym batch execution on k3s

### Phase 3: Run Experiment

**M5: Deploy the intervention** ✅ COMPLETE (2026-06-23)
- EXP-198 deployed procedural discovery skill in gym scenarios
- 3 arms run: baseline (reused 125 runs), procedural skill (10), skill+example (10)
- Result: 0% improvement across both skill arms — intervention FAILED

**M6: Collect sufficient post-deployment data** ✅ COMPLETE (2026-06-23)
- Total data: 200+ gym trials across 4 experiments (EXP-177, 194, 195, 198)
- Sufficient N for statistical confidence (Fisher exact p<0.001 for direct hint vs baseline)
- Raw data in experiment logs; analysis in m7-analysis.md

### Phase 4: Measure Improvement

**M7: Analyze results** ✅ COMPLETE (2026-06-23)
- Full analysis in m7-analysis.md
- Skill arms: 0/20 (0%), direct hint: 4/10 (40%), baseline: 0/125 (0%)
- Fisher exact: skill vs baseline p=1.0, hint vs baseline p<0.001

**M8: Make promote/reject decision** ✅ COMPLETE (2026-06-23)
- Decision: REJECT procedural discovery skill
- Meta-finding: text skills work for implementation bottlenecks, not recognition bottlenecks
- KE-338 written, KE-054 extended

### Phase 5: Close the Loop

**M9: Document the complete cycle** ✅ COMPLETE (2026-06-24)
- Case study written: `agents/coach/knowledge/prove-the-loop-case-study.md`
- Meta-lessons extracted: text skills have a ceiling at recognition tasks
- Full loop documented: gap → 4 experiments → reject skill → confirm methodology

## Current Status

**PROJECT CLOSED** — All 9 milestones complete (2026-06-24).

Key outcome: The training loop methodology works, but text-based skills have a ceiling — they help with implementation tasks but not recognition/discovery tasks. See case study for details.
