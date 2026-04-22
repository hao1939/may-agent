# Prove the Loop — Project Plan

**Goal**: Prove the coach training loop works end-to-end: identify skill gap → design experiment → run experiment → measure improvement → promote or reject skill.
**Owner**: coach
**Created**: 2026-04-21
**Status**: CLOSED (all 9 milestones complete, case study written 2026-06-24)

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

**M5: Deploy the intervention** ✅ COMPLETE (EXP-198)
- Procedural discovery skill deployed in gym scenarios
- 3 arms tested: baseline, procedural skill, procedural + worked example

**M6: Collect sufficient post-deployment data** ✅ COMPLETE (EXP-198)
- N=30 across 3 arms (10 each). All skill arms: 0% pass rate.
- Combined with EXP-195 data: 200+ total trials across project.

### Phase 4: Measure Improvement

**M7: Analyze results** ✅ COMPLETE (2026-06-23)
- Full analysis in `m7-analysis.md`
- Text skills: 0% improvement. Direct hints: +40pp. Meta-finding: text skills have a boundary.

**M8: Make promote/reject decision** ✅ COMPLETE (2026-06-23)
- REJECT procedural discovery skill. Decision in `m8-decision.md`
- Promoted KE-338. Extended KE-054.

### Phase 5: Close the Loop

**M9: Document the complete cycle** ✅ COMPLETE (2026-06-24)
- Case study: `agents/coach/knowledge/prove-the-loop-case-study.md`
- Meta-finding: loop methodology works, text skills have ceiling at recognition tasks

## Current Status & Blockers

### BLOCKER 1: Insufficient eval volume
- Post-intervention evals accumulate slowly (~1-3/day for targeted failure modes)
- Iter 16 shipped a retry scope-escape fix but only got n=8 evals before the project stalled
- **Need**: Either higher eval throughput, or a more common failure mode to target

### BLOCKER 2: Baseline instability
- Original baseline (0.82) was inflated by gym sessions; production-only baseline is 0.726
- Baselines shift as task mix changes, making before/after comparison unreliable
- **Need**: Stable baseline period (≥7 days, n≥50) before deploying intervention

### BLOCKER 3: No clean A/B mechanism
- Current approach is before/after comparison, which is confounded by time
- Multiple interventions ship simultaneously (finish-guard changes, rule tweaks, etc.)
- **Need**: Either sequential isolated experiments, or a way to tag sessions with active interventions

### Path Forward
1. Pick a **high-frequency** failure mode (appears in ≥20% of evals) so n≥30 accumulates in <3 days
2. Freeze all other interventions during the measurement window
3. Use the simplest possible intervention (single rule addition) to minimize confounders
4. If eval volume remains insufficient, consider synthetic eval runs to boost sample size
